/**
 * 官網本身是純靜態資源；這個 Worker 只處理三件事：影片的 Range 請求、/api/geo（cookie 同意用）、/go/* 追蹤連結。
 *
 * Workers 靜態資源不處理 HTTP Range（分段請求）——對 `Range: bytes=0-1023` 會照樣回整檔 200。
 * Safari（含 iPhone）播 <video> 一定要伺服器支援 Range，否則播不出來；章節跳轉也需要它。
 * 所以 mp4 走這裡：從 ASSETS 讀整檔（幾 MB，在記憶體內切片沒問題），照 Range 回 206。
 * 其他路徑不會進到這個 Worker（見 wrangler.jsonc 的 run_worker_first）。
 */
// 需要先取得同意才能放分析 cookie 的地區：歐洲經濟區（EU 27 + 冰島、列支敦斯登、挪威）＋英國＋瑞士
const CONSENT_REGIONS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH',
]);

// 行銷管道追蹤連結 /go/<管道>：記一筆點擊（只有管道、國家、手機種類）再轉走。
// 任何符合格式的管道名都收，新管道不用重新部署；後台「註冊與活躍」頁看數字。
// 表與函式在 App repo migration 20261006_link_clicks.sql。
const APP_STORE_URL = 'https://apps.apple.com/tw/app/id6761771211';
// Android 版還在封閉測試，先帶去官網首頁（FAQ 有說明）
const ANDROID_URL = 'https://littlestep.me/';
// 連結預覽爬蟲（Threads／FB／LINE 貼連結時會先抓一次）不算點擊
const BOT_UA = /bot|crawl|spider|preview|facebookexternalhit|meta-externalagent|line-poker|whatsapp|telegram|slack|discord|curl|wget/i;

async function handleGo(request, env, ctx, slug) {
  const ua = request.headers.get('User-Agent') || '';
  const platform = /iPhone|iPad|iPod|Macintosh/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other';
  if (!BOT_UA.test(ua) && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    // 不等寫入完成就轉址；失敗也不影響使用者
    ctx.waitUntil(
      fetch(`${env.SUPABASE_URL}/rest/v1/rpc/log_link_click`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_slug: slug, p_country: (request.cf && request.cf.country) || null, p_platform: platform }),
      }).catch(() => {}),
    );
  }
  return new Response(null, {
    status: 302,
    headers: { Location: platform === 'android' ? ANDROID_URL : APP_STORE_URL, 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env, ctx) {
    const go = /^\/go\/([a-z0-9-]{1,30})\/?$/i.exec(new URL(request.url).pathname);
    if (go) return handleGo(request, env, ctx, go[1].toLowerCase());

    // analytics.js 用來決定要不要先跳 cookie 同意彈窗（見 analytics.js）。
    // 只回一個布林值，不回國家代碼，也不記錄任何東西。
    if (new URL(request.url).pathname === '/api/geo') {
      const country = request.cf && request.cf.country;
      return new Response(JSON.stringify({ consentRequired: CONSENT_REGIONS.has(country) }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    // 向靜態資源取檔時不要帶 Range，拿到的才是完整檔案
    const upstream = await env.ASSETS.fetch(new Request(request.url, { method: 'GET' }));
    if (upstream.status !== 200) return upstream;

    const headers = new Headers(upstream.headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.delete('Content-Encoding');

    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }

    const range = request.headers.get('Range');
    const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === '' && m[2] === '')) {
      return new Response(upstream.body, { status: 200, headers });
    }

    const buf = await upstream.arrayBuffer();
    const total = buf.byteLength;
    let start, end;
    if (m[1] === '') {            // bytes=-500 → 最後 500 bytes
      start = Math.max(0, total - Number(m[2]));
      end = total - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
    }
    if (start >= total || start > end) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${total}`, 'Accept-Ranges': 'bytes' },
      });
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(buf.slice(start, end + 1), { status: 206, headers });
  },
};
