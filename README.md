# 抖音直播发言自动后缀助手 (Douyin Live Chat Suffix Helper)

一个轻量、高效的 Google Chrome 浏览器外掛，专门为 `live.douyin.com`（抖音直播网页版）设计。它能在您送出聊天訊息時，**自動在末尾加上指定的後綴**（例如 ` /西红柿` 或其他自訂文字），支援在控制面板中隨時開啟、關閉或修改後綴。

---

## 🌟 功能特點

- **自動追加自訂後綴**：按下 Enter 鍵送出或點擊「傳送」按鈕時，自動為發言追加自訂後綴。
- **防止重複追加**：若輸入框文字已以該後綴結尾，外掛會自動略過追加，避免重複。
- **完美相容 React & Slate.js**：透過模擬原生的 `beforeinput` 和 `input` 事件，完美同步 Slate.js 編輯器的 React 狀態，確保傳送按鈕能被正確啟用。
- **智慧過濾輸入法組字**：自動過濾中文輸入法（IME）組字時的 Enter 鍵，避免在選字過程中誤送出。
- **精美控制面板**：使用現代的磨砂玻璃風格（Glassmorphic）設計，支援一鍵切換啟用狀態與實時儲存自訂後綴（使用 `chrome.storage.sync`）。

---

## ⚙️ 安裝指南

1. **下載本專案**至您的本機電腦。
2. 開啟 **Google Chrome 瀏覽器**。
3. 在網址列輸入 `chrome://extensions/` 並按下 Enter 前往擴充功能管理頁面。
4. 將頁面右上角的 **「開發人員模式」** 切換為開啟。
5. 點擊左上角的 **「載入已解壓的擴充程序」**。
6. 選擇本專案資料夾，點擊「選擇資料夾」即可完成安裝。
7. 前往 [live.douyin.com](https://live.douyin.com/) 直播間網頁並**重新整理頁面**，外掛即會生效。

---

## 🛠️ 技術實作細節

由於抖音網頁端採用 Slate.js 富文本編輯器，傳統直接修改 DOM 節點 `.textContent` 或 `.innerText` 的方式會導致 React 內部狀態無法更新，進而使「傳送」按鈕維持禁用狀態。

本外掛採用了以下核心技術解決該問題：
1. **Selection & Range 游標控制**：在插入文字前，先將 DOM 游標折疊至輸入框最末端。
2. **`document.execCommand` 模擬輸入**：使用 `execCommand('insertText')` 插入後綴，此方法能觸發瀏覽器最底層的文字輸入，保留 Slate 內建的歷史紀錄鏈。
3. **事件派發（Event Dispatching）**：手動派發 `beforeinput`、`input` 及 `change` 事件，通知 React 虛擬 DOM 更新節點樹。
4. **事件攔截（Event Interception）**：在 DOM 捕獲階段（Capture Phase）監聽鍵盤與滑鼠點擊，確保在抖音原生發送邏輯執行前完成後綴追加與事件重發。

---

## 🚀 CI/CD 自動化發佈 (GitHub Actions)

本專案已設定 GitHub Actions 工作流（位於 `.github/workflows/release.yml`）。每當您推送（`git push`）程式碼至 `main` 分支時，系統將會：
1. 自動讀取 `manifest.json` 中的版本號。
2. 將所有必備外掛檔案壓縮為 `douyin-chat-suffix.zip`。
3. **自動建立一個 GitHub Release**，並將 ZIP 壓縮包作為 Release 資源上傳。

---

## 📝 授權條款


本專案採用 [MIT License](LICENSE) 授權條款。

