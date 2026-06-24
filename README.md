# 抖音直播发言自动后缀与繁转简助手 (Douyin Live Chat Suffix & Converter)

一個輕量、高效的 Google Chrome 瀏覽器外掛，專門為抖音直播網頁版設計。送出聊天訊息時，它能自動追加選定後綴，並可在瀏覽器本機將繁體字轉換為簡體字。


從Chrome Store[下載](https://chromewebstore.google.com/detail/njjjholfogmchmcnnckmgbkmlmeahkim?authuser=0&hl=zh-TW)。

---

## 🌟 功能特點

- **多組預設後綴**：可選擇 `/` 或 `(` 符號，搭配 `黑絲`、`13`、`皇后`、`彎彎`、`灣灣`。
- **自訂內容清單**：可新增及刪除自訂後綴內容，內建預設清單會持續保留。
- **送出前繁轉簡**：Enter 與點擊「傳送」都可將訊息和後綴轉成簡體，並可使用獨立開關停用。
- **防止重複追加**：若輸入框文字已以該後綴結尾，外掛會自動略過追加，避免重複。
- **保留表情內容**：繁簡轉換只處理文字節點，不會覆蓋聊天框內的圖片表情。
- **相容 React & Slate.js**：透過原生文字輸入與事件派發同步編輯器狀態。
- **智慧過濾輸入法組字**：自動過濾中文輸入法（IME）組字時的 Enter 鍵，避免在選字過程中誤送出。
- **自動儲存設定**：後綴、符號及功能開關會透過 `chrome.storage.sync` 儲存。

---

## ⚙️ 安裝指南

1. **下載本專案**至您的本機電腦。
2. 開啟 **Google Chrome 瀏覽器**。
3. 在網址列輸入 `chrome://extensions/` 並按下 Enter 前往擴充功能管理頁面。
4. 將頁面右上角的 **「開發人員模式」** 切換為開啟。
5. 點擊左上角的 **「載入已解壓的擴充程序」**。
6. 選擇本專案資料夾，點擊「選擇資料夾」即可完成安裝。
7. 前往 [抖音網頁版](https://www.douyin.com/) 或 [抖音直播](https://live.douyin.com/)，進入直播間後外掛即會生效，無需重新整理直播間。

---

## 🛠️ 技術實作細節

由於抖音網頁端採用 Slate.js 富文本編輯器，傳統直接修改 DOM 節點 `.textContent` 或 `.innerText` 的方式會導致 React 內部狀態無法更新，進而使「傳送」按鈕維持禁用狀態。

本外掛採用了以下核心技術解決該問題：
1. **Selection & Range 游標控制**：在插入文字前，先將 DOM 游標折疊至輸入框最末端。
2. **`document.execCommand` 模擬輸入**：使用 `execCommand('insertText')` 插入後綴，此方法能觸發瀏覽器最底層的文字輸入，保留 Slate 內建的歷史紀錄鏈。
3. **事件派發（Event Dispatching）**：手動派發 `input` 及 `change` 事件，通知 React 虛擬 DOM 更新節點樹。
4. **事件攔截（Event Interception）**：在 DOM 捕獲階段（Capture Phase）監聽鍵盤與滑鼠點擊，確保在抖音原生發送邏輯執行前完成後綴追加與事件重發。
5. **站內跳轉與子頁面支援**：腳本會從抖音首頁預先載入，並支援直播聊天區使用子 Frame 載入的情況，因此由首頁首次跳轉直播間時也能立即生效。
6. **本機 OpenCC 轉換**：使用隨擴充功能打包的 OpenCC-JS 標準繁轉簡字典，不載入遠端腳本，也不進行地區用語替換。

## 🧪 測試

```bash
node tests/run-tests.js
```

---

## 🚀 CI/CD 自動化發佈 (GitHub Actions)

本專案已設定 GitHub Actions 工作流（位於 `.github/workflows/release.yml`）。每當您推送（`git push`）程式碼至 `main` 分支時，系統將會：
1. 自動讀取 `manifest.json` 中的版本號。
2. 將所有必備外掛檔案與本機 OpenCC 資源壓縮為 `douyin-chat-suffix.zip`。
3. **自動建立一個 GitHub Release**，並將 ZIP 壓縮包作為 Release 資源上傳。

---

## 📝 授權條款


本專案採用 [MIT License](LICENSE) 授權條款。OpenCC-JS 與其字典資料的授權內容位於 [`vendor/opencc-js`](vendor/opencc-js)。
