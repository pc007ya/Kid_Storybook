# Kid_Storybook
Kid_Storybook

## 故事工房

純 HTML / CSS / JavaScript 的故事書編輯器，無建置依賴、無後端。

線上使用：https://pc007ya.github.io/Kid_Storybook/

### 操作

- 左欄以 ＋ 新增、垃圾桶刪除故事書與頁面，並切換故事書，展開目前故事的各頁。以 ⠿ 拖曳排序，或使用 ↑ / ↓ 按鈕。
- 右上角顯示目前頁面尺寸，支援 2048×1536、1024×768、1600×1200、1920×1080、1536×2048；中央依所選比例預覽，上一頁／下一頁有滑動動畫，尊重系統減少動態效果設定。
- 右欄編輯文字、字體、顏色、字級、位置、區塊寬度、對齊、行距及段落間隔；文字框可調整底色、不透明度、邊框顏色與粗細。
- 文字可直接拖曳；聚焦文字後也能使用方向鍵微調。
- 上傳 PNG / JPEG / WebP / GIF 原圖，可完整顯示或裁切填滿；「預覽原圖」顯示完整圖片。
- 上方可收折書架，增加工作空間。適用桌面與 iPad 橫向，小螢幕改為直向排列。

### 保存與備份

文字、順序與編輯狀態存於 localStorage 的 `kid-storybook.v1`；原始圖片以 Blob 存於 IndexedDB 的 `kid-storybook` / `images`，不重新壓縮。資料只保存在同一瀏覽器與網站來源，不會上傳至 GitHub，也不會自動跨裝置同步。清除網站資料會刪除作品，請定期匯出備份。

「匯出備份」下載 version 1 JSON，含所有故事、樣式與原圖。「匯入備份」以新 ID 加入故事，不覆蓋現有作品。「匯出 HTML」下載目前故事的單一離線 HTML，內嵌原圖與樣式，含翻頁及右上角尺寸選單。之後可基於此資料格式擴充 PDF / EPUB 匯出。

字級和段落間隔以 1024px 寬畫布為基準，預覽等比例縮放。字體使用系統字體，實際外觀依裝置已安裝字體而異。每次換行建立一個段落，過長內容超出畫布會裁切，請調整字級或位置。

### 本機使用與部署

透過任意靜態 HTTP 伺服器開啟根目錄；例如 `python3 -m http.server 8765` 後開啟 `http://localhost:8765`。勿直接使用 file://，瀏覽器儲存行為可能不同。

`.github/workflows/pages.yml` 在 main 更新時部署 GitHub Pages，發布 index.html、styles.css、app.js、story-library.js 與 stories/ 素材。GitHub 設定 Pages 的來源為 GitHub Actions。既有 README 內容保留。
