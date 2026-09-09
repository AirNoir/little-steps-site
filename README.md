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
