# 小步腳印 官網

App Store 送審用的三個 URL 欄位都由這個站台提供：

| ASC 欄位 | 對應頁面 |
|---|---|
| 行銷 URL（Marketing URL） | `index.html` |
| 技術支援 URL（Support URL） | `support.html` |
| 隱私權政策 URL（Privacy Policy URL） | `privacy.html` |

## 為什麼獨立成一個 repo

App 原始碼在 `AirNoir/little-steps-v2`，是私有 repo。GitHub Pages 從私有 repo
發布需要付費方案，所以官網拆出來放公開 repo，只公開這幾頁靜態檔案。

## 純靜態，沒有建置步驟

唯一的例外是 `worker.js`：Cloudflare Workers 靜態資源不支援 HTTP Range，
而 Safari／iPhone 播 `<video>` 一定要 Range，所以 mp4 路徑會先進這個 Worker 切片回 206
（`wrangler.jsonc` 的 `run_worker_first`）。其他頁面與圖片仍是純靜態，改完直接部署。

直接改 HTML 與 `style.css`，push 上去 GitHub Pages 就會更新。

本機預覽：

```bash
python3 -m http.server 8899
# 開 http://localhost:8899
```

## 上架後要改的一處

`index.html` 的 hero 區塊目前是「即將在 App Store 上線」的靜態文字，
上架後換成註解裡那行 App Store 連結（App ID：6761771211）。

## 素材來源

`assets/` 的截圖來自 App repo 的 `appstore/screenshots/iphone-6.7/`，
已用 `sips -Z 620` 縮圖；App 圖示縮為 256px。更新截圖時記得一起縮，
不然單張會是 500KB 以上。

## 隱私政策的單一來源

政策本文與 App repo 的 `docs/privacy.html` 相同。**改的時候兩邊要一起改**，
App 內的隱私頁讀的是 App repo 那一份。

## 宣傳影片

首頁 `#video` 區塊播的是 App repo `marketing/promo` 用 Remotion 渲染的 90 秒直式影片
（`out/promo90.mp4`，1080×1920）。官網放的是縮成 720p 的網頁版，
含 `faststart` 讓它邊下載邊播；海報圖取第 14 秒那一格。重新渲染後照下面重做：

```bash
# 在 App repo 的 marketing/promo 目錄
ffmpeg -y -i out/promo90.mp4 \
  -vf "scale=720:1280:in_range=full:out_range=limited,format=yuv420p" \
  -c:v libx264 -profile:v high -level 4.0 -preset slow -crf 23 \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 128k -movflags +faststart ../../../little-steps-site/assets/promo90.mp4
ffmpeg -y -i out/promo90.mp4 -vf "select='eq(n\,420)',scale=720:1280" -fps_mode passthrough \
  -frames:v 1 -q:v 3 ../../../little-steps-site/assets/promo-poster.jpg
```

章節時間點寫在 `index.html` 的 `.chapters` 裡（`data-t` 秒數），
場景長度改了要跟著調；`Promo90.tsx` 的 `S` 物件是各幕的幀數，除以 30 就是秒。
Cloudflare Workers 靜態資源單檔上限 25 MB，影片請維持在幾 MB 的規模。

## 網站分析（GA4 / GTM）

三頁都掛 `analytics.js`。**只要在檔案最上面填 ID**，其他不用動：

| 變數 | 填什麼 | 說明 |
|---|---|---|
| `GTM_ID` | `GTM-XXXXXXX` | 建議路線。GA4 在 GTM 裡用「Google 代碼」設定，網頁只掛 GTM |
| `GA4_ID` | `G-XXXXXXXXXX` | 只在不用 GTM、想直接掛 GA4 時填。兩邊都有 GA4 會重複計算 page_view |

兩個都空白時不會載入任何第三方腳本。

### GA4 自動就有的

開啟 GA4 資源的「加強型評估」（預設開）就有：`page_view`、捲動 90%、外連點擊
（App Store 按鈕是外連，會以 `click` 事件帶 `link_url` 出現）、檔案下載。

### 自訂事件怎麼接到 GA4（GTM 三步）

`analytics.js` 送到 dataLayer 的事件見檔頭註解。在 GTM 裡：

1. **變數**：新增「資料層變數」`cta_location`、`nav_location`、`link_text`、`link_url`、`question`、`video_title`、`percent`、`chapter_title`、`chapter_time`。
2. **觸發條件**：類型「自訂事件」，事件名稱勾「使用規則運算式比對」，填
   `^(cta_click|nav_click|contact_click|faq_open|video_start|video_progress|video_complete|video_chapter)$`。
3. **代碼**：類型「Google Analytics：GA4 事件」，事件名稱填 `{{Event}}`，
   事件參數逐一對應上面的變數（參數名＝變數名），觸發條件選第 2 步那個。

發布容器後，GA4 的「即時」報表點一下網站的 App Store 按鈕，應該立刻看到 `cta_click`。

### 之後可以加的

- 海報與頁尾的 QR 目前直接指向 App Store 商品頁。若要在 App Store Connect 分辨「QR 掃描」與「按鈕點擊」，
  可用 App Analytics 的行銷活動連結（`?pt=<provider token>&ct=site_qr&mt=8`）重產 QR。
- 隱私權政策目前只寫 App 的資料處理，沒提到官網用 Google Analytics；正式啟用前建議補一段「官網瀏覽統計」
  （三份複本一起改，見 App repo CLAUDE.md）。
