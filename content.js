// 抖音直播发言自动后缀 Content Script

const {
  buildSuffix,
  normalizeSettings
} = globalThis.DouyinSuffixConfig;

const toSimplified = globalThis.OpenCC.Converter({ from: "t", to: "cn" });
let rawSettings = {};
let settings = normalizeSettings(rawSettings);
let isSending = false;
const redispatchedEvents = new WeakSet();

chrome.storage.sync.get(null, (data) => {
  rawSettings = data || {};
  settings = normalizeSettings(rawSettings);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  Object.entries(changes).forEach(([key, change]) => {
    if (change.newValue === undefined) {
      delete rawSettings[key];
    } else {
      rawSettings[key] = change.newValue;
    }
  });

  settings = normalizeSettings(rawSettings);
});

function getEditor() {
  return document.querySelector('[data-slate-editor="true"]') ||
         document.querySelector('[contenteditable="true"]');
}

function getSendButton() {
  return document.querySelector(".webcast-chatroom___send-btn") ||
         document.querySelector('[data-e2e="chat-send-btn"]');
}

// Includes emoji image labels when checking whether the editor has content.
function getEditorText(editor) {
  let text = "";

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (node.tagName === "IMG") {
      text += node.getAttribute("alt") || node.getAttribute("title") || "";
      return;
    }

    for (const child of node.childNodes) {
      traverse(child);
    }
  }

  traverse(editor);
  return text;
}

function getTextNodes(editor) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;

  while ((node = walker.nextNode())) {
    nodes.push(node);
  }

  return nodes;
}

function hasTraditionalText(editor) {
  return getTextNodes(editor).some((node) => {
    const value = node.nodeValue || "";
    return toSimplified(value) !== value;
  });
}


function waitForEditorUpdate() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function safeInsertText(target, value) {
  const inputEvent = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
    data: value
  });

  if (target.dispatchEvent(inputEvent)) {
    return document.execCommand("insertText", false, value);
  }

  return true;
}

async function replaceEditorText(editor, value) {
  const range = document.createRange();
  range.selectNodeContents(editor);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  await waitForEditorUpdate();

  return safeInsertText(editor, value);
}

function dispatchSendButtonClick() {
  const sendButton = getSendButton();
  if (!sendButton) {
    isSending = false;
    console.error("[Douyin Suffix Helper] Send button not found.");
    return;
  }

  const rect = sendButton.getBoundingClientRect();
  const options = {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  };
  const events = [
    new PointerEvent("pointerdown", options),
    new MouseEvent("mousedown", options),
    new PointerEvent("pointerup", options),
    new MouseEvent("mouseup", options),
    new MouseEvent("click", options)
  ];

  events.forEach((event) => {
    redispatchedEvents.add(event);
    sendButton.dispatchEvent(event);
  });
  isSending = false;
}

function getPreparationPlan(editor) {
  const currentText = getEditorText(editor).replace(/\u200b/g, "");
  if (!currentText) {
    return null;
  }

  const suffix = buildSuffix(settings);
  const outgoingSuffix = settings.convertToSimplified ? toSimplified(suffix) : suffix;
  const comparableText = settings.convertToSimplified
    ? toSimplified(currentText)
    : currentText;
  const needsConversion = settings.convertToSimplified && hasTraditionalText(editor);
  const needsSuffix = settings.enabled &&
    !comparableText.endsWith(outgoingSuffix);

  return {
    currentText,
    needsConversion,
    needsSuffix,
    outgoingSuffix,
    finalText: `${settings.convertToSimplified
      ? toSimplified(currentText)
      : currentText}${needsSuffix ? outgoingSuffix : ""}`
  };
}

async function prepareAndSend(editor, plan) {
  if (!plan || (!plan.needsConversion && !plan.needsSuffix)) {
    return false;
  }

  isSending = true;
  editor.focus();

  if (!await replaceEditorText(editor, plan.finalText)) {
    isSending = false;
    console.error("[Douyin Suffix Helper] Browser rejected message replacement.");
    return false;
  }

  await waitForEditorUpdate();
  await waitForEditorUpdate();

  setTimeout(dispatchSendButtonClick, 300);
  return true;
}

window.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  const editor = getEditor();
  if (!editor ||
      !getSendButton() ||
      (event.target !== editor && !editor.contains(event.target))) {
    return;
  }

  if (event.isComposing) {
    return;
  }

  if (isSending) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return;
  }

  const plan = getPreparationPlan(editor);
  if (!plan || (!plan.needsConversion && !plan.needsSuffix)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const handled = await prepareAndSend(editor, plan);
  if (!handled) {
    isSending = false;
    console.error("[Douyin Suffix Helper] Message preparation failed.");
  }
}, true);

async function handleSendButtonEvent(event) {
  if (redispatchedEvents.has(event)) {
    return;
  }

  const sendButton = getSendButton();
  if (!sendButton ||
      (event.target !== sendButton && !sendButton.contains(event.target))) {
    return;
  }

  const editor = getEditor();
  if (!editor) {
    return;
  }

  if (isSending) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return;
  }

  const plan = getPreparationPlan(editor);
  if (!plan || (!plan.needsConversion && !plan.needsSuffix)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const handled = await prepareAndSend(editor, plan);
  if (!handled) {
    isSending = false;
    console.error("[Douyin Suffix Helper] Message preparation failed.");
  }
}

window.addEventListener("pointerdown", handleSendButtonEvent, true);
window.addEventListener("mousedown", handleSendButtonEvent, true);
window.addEventListener("click", handleSendButtonEvent, true);
