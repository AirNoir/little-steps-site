/**
 * 官網分析（GA4 / GTM）
 *
 * 只要填 ID，其他都不用動：
 *   GTM_ID  → Google Tag Manager 容器 ID（建議路線：GA4 在 GTM 裡設定，網頁只掛 GTM）
 *   GA4_ID  → 只在「不用 GTM、想直接掛 GA4」時填。兩個都填且 GTM 裡也有 GA4，page_view 會算兩次。
 * 兩個都空白時，這支檔案不會載入任何第三方腳本，只會在本機 dataLayer 留事件。
 *
 * 送出的事件（dataLayer，GTM 用「自訂事件」觸發即可接到；直掛 GA4 時同時以 gtag 送出）：
 *   cta_click      { cta_location: topbar | hero_poster | hero_qr | hero_mobile | footer_cta | other, link_url }
 *   nav_click      { nav_location: topbar | footer, link_text, link_url }
 *   contact_click  { link_url }                    mailto 連結
 *   faq_open       { question }                    展開常見問題
 *   video_start    { video_title }                 第一次按播放
 *   video_progress { video_title, percent }        25 / 50 / 75
 *   video_complete { video_title }
 *   video_chapter  { video_title, chapter_title, chapter_time }
 * page_view、捲動深度、外連點擊（含 App Store 連結）由 GA4 的「加強型評估」自動記錄，不在這裡重複送。
 */
(function () {
  var GTM_ID = '';   // 例：'GTM-ABC1234'
  var GA4_ID = 'G-FG24RGC1FE';   // 2026-09-18 起直掛；之後切到 GTM 時要清空，避免重複計算

  window.dataLayer = window.dataLayer || [];
  var useGtm = /^GTM-[A-Z0-9]+$/.test(GTM_ID);
  var useGa4 = /^G-[A-Z0-9]+$/.test(GA4_ID);

  if (useGtm) {
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
    document.head.appendChild(g);
  }
  if (useGa4) {
    var a = document.createElement('script');
    a.async = true;
    a.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(a);
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
  }

  function track(name, params) {
    params = params || {};
    var row = { event: name };
    for (var k in params) row[k] = params[k];
    window.dataLayer.push(row);
    if (useGa4) window.gtag('event', name, params);
  }

  function text(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80); }
  function ctaLocation(a) {
    if (a.closest('.poster-qr')) return 'hero_qr';
    if (a.closest('.poster-cta')) return 'hero_poster';
    if (a.closest('.hero-mobile')) return 'hero_mobile';
    if (a.closest('.topbar')) return 'topbar';
    if (a.closest('.cta-band')) return 'footer_cta';
    return 'other';
  }

  // 點擊：一律用事件委派，頁面載到一半也接得到
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/apps\.apple\.com/.test(href)) return track('cta_click', { cta_location: ctaLocation(a), link_url: href });
    if (/^mailto:/.test(href)) return track('contact_click', { link_url: href });
    if (a.closest('.mainnav')) return track('nav_click', { nav_location: 'topbar', link_text: text(a), link_url: href });
    if (a.closest('footer nav')) return track('nav_click', { nav_location: 'footer', link_text: text(a), link_url: href });
  }, true);

  // 常見問題展開（toggle 不會冒泡，用捕捉階段接）
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d && d.tagName === 'DETAILS' && d.open) {
      var sm = d.querySelector('summary');
      track('faq_open', { question: sm ? text(sm) : '' });
    }
  }, true);

  // 宣傳影片
  var started = false, marks = {};
  var TITLE = '小步腳印 90 秒介紹影片';
  document.addEventListener('play', function (e) {
    if (e.target.id !== 'promo' || started) return;
    started = true;
    track('video_start', { video_title: TITLE });
  }, true);
  document.addEventListener('ended', function (e) {
    if (e.target.id === 'promo') track('video_complete', { video_title: TITLE });
  }, true);
  document.addEventListener('timeupdate', function (e) {
    var v = e.target;
    if (v.id !== 'promo' || !v.duration) return;
    var pct = Math.floor((v.currentTime / v.duration) * 100);
    [25, 50, 75].forEach(function (p) {
      if (pct >= p && !marks[p]) { marks[p] = true; track('video_progress', { video_title: TITLE, percent: p }); }
    });
  }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.chapters button');
    if (!b) return;
    var sp = b.querySelector('span');
    track('video_chapter', { video_title: TITLE, chapter_title: sp ? text(sp) : text(b), chapter_time: Number(b.getAttribute('data-t')) || 0 });
  }, true);
})();
