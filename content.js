// 抖音直播发言自动后缀 Content Script
console.log("[Douyin Suffix Helper] Content script loaded.");

let isEnabled = true;
let chatSuffix = " /西红柿";

// 从存储加载设置
chrome.storage.sync.get(["enabled", "suffix"], (data) => {
  if (data.enabled !== undefined) {
    isEnabled = data.enabled;
  }
  if (data.suffix !== undefined) {
    chatSuffix = data.suffix;
  }
  console.log("[Douyin Suffix Helper] Initial settings loaded:", { isEnabled, chatSuffix });
});

// 监听设置变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync") {
    if (changes.enabled !== undefined) {
      isEnabled = changes.enabled.newValue;
    }
    if (changes.suffix !== undefined) {
      chatSuffix = changes.suffix.newValue;
    }
    console.log("[Douyin Suffix Helper] Settings updated:", { isEnabled, chatSuffix });
  }
});

// 获取编辑器元素
function getEditor() {
  return document.querySelector('[data-slate-editor="true"]') ||
         document.querySelector('[contenteditable="true"]');
}

// 获取发送按钮元素
function getSendButton() {
  return document.querySelector('.webcast-chatroom___send-btn') ||
         document.querySelector('[data-e2e="chat-send-btn"]');
}

// 附加后缀并发送
function appendSuffixAndSend(editor, suffix) {
  console.log("[Douyin Suffix Helper] Appending suffix:", JSON.stringify(suffix));
  editor.focus();

  // 选择文本末尾
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false); // 折叠到末尾
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  // 插入后缀文字
  document.execCommand('insertText', false, suffix);

  // 派发事件，确保 React / Slate.js 状态更新，并使发送按钮可用
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));
  editor.dispatchEvent(new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText'
  }));

  console.log("[Douyin Suffix Helper] Events dispatched. Triggering click in 50ms...");

  // 延迟一小段时间点击发送按钮
  setTimeout(() => {
    const sendBtn = getSendButton();
    if (sendBtn) {
      console.log("[Douyin Suffix Helper] Triggering send button click.");
      sendBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } else {
      console.error("[Douyin Suffix Helper] Send button not found during programmatic click.");
    }
  }, 50);
}

// 1. 拦截回车键发送
window.addEventListener('keydown', (event) => {
  if (!isEnabled) return;
  
  if (event.key === 'Enter' && !event.shiftKey) {
    const editor = getEditor();
    if (editor && (event.target === editor || editor.contains(event.target))) {
      if (event.isComposing) {
        console.log("[Douyin Suffix Helper] Enter key ignored due to active IME composition.");
        return;
      }
      
      // 移除零宽空格并去除首尾空格
      const text = (editor.textContent || editor.innerText || "").replace(/\u200b/g, '').trim();
      const targetSuffix = chatSuffix;
      
      console.log("[Douyin Suffix Helper] Keydown intercepted. Current text:", JSON.stringify(text));
      
      // 如果输入框有内容，且内容不以指定的后缀结尾，则进行拦截与追加
      if (text && !text.endsWith(targetSuffix.trim())) {
        event.preventDefault();
        event.stopPropagation();
        appendSuffixAndSend(editor, targetSuffix);
      } else {
        console.log("[Douyin Suffix Helper] Suffix already present or empty. Letting event pass.");
      }
    }
  }
}, true); // 使用捕获阶段以在抖音原生监听器之前处理

// 2. 拦截点击发送按钮
window.addEventListener('click', (event) => {
  if (!isEnabled) return;

  const sendBtn = getSendButton();
  if (sendBtn && (event.target === sendBtn || sendBtn.contains(event.target))) {
    const editor = getEditor();
    if (editor) {
      const text = (editor.textContent || editor.innerText || "").replace(/\u200b/g, '').trim();
      const targetSuffix = chatSuffix;

      console.log("[Douyin Suffix Helper] Click intercepted. Current text:", JSON.stringify(text));

      // 如果输入框有內容，且不以指定后缀结尾，则拦截点击，追加后缀，然后模拟点击
      if (text && !text.endsWith(targetSuffix.trim())) {
        event.preventDefault();
        event.stopPropagation();
        appendSuffixAndSend(editor, targetSuffix);
      } else {
        console.log("[Douyin Suffix Helper] Click let pass (suffix present, empty, or event recursion).");
      }
    }
  }
}, true); // 使用捕获阶段

