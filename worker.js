/**
 * 官網本身是純靜態資源；這個 Worker 只處理兩件事：影片的 Range 請求，以及 /api/geo（cookie 同意用）。
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

export default {
  async fetch(request, env) {
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
