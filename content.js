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
const DEBUG_STORAGE_KEY = "douyinSuffixDebug";
const DEBUG_MESSAGE_TYPE = "douyinSuffixDebug";
let debugEnabled = false;

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

function getStoredDebugEnabled() {
  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
  } catch (_error) {
    return false;
  }
}

function setDebugEnabled(enabled, persist) {
  debugEnabled = enabled;

  if (!persist) {
    return;
  }

  try {
    if (enabled) {
      localStorage.setItem(DEBUG_STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(DEBUG_STORAGE_KEY);
    }
  } catch (_error) {
    // Some Douyin frames can block storage access; in-memory debug still works.
  }
}

function isDebugEnabled() {
  return debugEnabled || getStoredDebugEnabled();
}

function broadcastDebugMessage(enabled) {
  for (const frame of document.querySelectorAll("iframe")) {
    try {
      frame.contentWindow.postMessage({
        type: DEBUG_MESSAGE_TYPE,
        enabled
      }, "*");
    } catch (_error) {
      // Ignore frames that are not reachable yet.
    }
  }
}

function handleDebugMessage(event) {
  const data = event.data;
  if (!data || data.type !== DEBUG_MESSAGE_TYPE) {
    return;
  }

  const enabled = data.enabled === true || data.enabled === "1";
  setDebugEnabled(enabled, true);
  broadcastDebugMessage(enabled);

  console.log("[Douyin Suffix Helper] debug " + (enabled ? "enabled" : "disabled"), {
    url: location.href
  });
}

function getElementDebugAttributes(element) {
  const attributes = {};

  for (const name of element.getAttributeNames()) {
    if (name === "class" ||
        name === "style" ||
        name.startsWith("data-") ||
        name === "contenteditable" ||
        name === "role" ||
        name === "aria-label") {
      attributes[name] = element.getAttribute(name);
    }
  }

  return attributes;
}

function getCleanNodeText(node) {
  return (node.textContent || "").replace(/\u200b/g, "");
}

function hasMentionMarker(element) {
  if (element.getAttribute("contenteditable") === "false" ||
      element.getAttribute("data-slate-void") === "true" ||
      element.getAttribute("data-slate-inline") === "true") {
    return true;
  }

  const className = element.getAttribute("class") || "";
  const ariaLabel = element.getAttribute("aria-label") || "";
  return /mention|at-user|at_user|atuser/i.test(className) ||
    /@|mention|提及|艾特/.test(ariaLabel);
}

function getMentionMarker(element) {
  if (hasMentionMarker(element)) {
    return element;
  }

  return Array.from(element.querySelectorAll("*")).find(hasMentionMarker) || null;
}

function isMentionElement(element) {
  if (element.hasAttribute("data-slate-editor") ||
      element.getAttribute("contenteditable") === "true") {
    return false;
  }

  const cleanText = getCleanNodeText(element);
  if (!cleanText.startsWith("@") || cleanText.length <= 1 || cleanText.length > 80) {
    return false;
  }

  const marker = getMentionMarker(element);
  if (!marker) {
    return false;
  }

  return getCleanNodeText(marker) === cleanText;
}

function getEditorDebugSnapshot(editor) {
  const rows = [];

  function traverse(node, path, depth) {
    if (rows.length >= 80) {
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      rows.push({
        path,
        type: "text",
        value: node.textContent
      });
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    rows.push({
      path,
      type: "element",
      tag: node.tagName.toLowerCase(),
      attrs: getElementDebugAttributes(node)
    });

    if (depth >= 8) {
      return;
    }

    Array.from(node.childNodes).forEach((child, index) => {
      traverse(child, `${path}.${index}`, depth + 1);
    });
  }

  traverse(editor, "0", 0);
  return rows;
}

function debugPreparation(editor, plan) {
  if (!isDebugEnabled()) {
    return;
  }

  console.log("[Douyin Suffix Helper] preparation", {
    url: location.href,
    rawTextContent: editor.textContent,
    extractedText: plan.currentText,
    finalText: plan.finalText,
    needsConversion: plan.needsConversion,
    needsSuffix: plan.needsSuffix,
    outgoingSuffix: plan.outgoingSuffix,
    snapshot: getEditorDebugSnapshot(editor)
  });
}

setDebugEnabled(getStoredDebugEnabled(), false);
window.addEventListener("message", handleDebugMessage);

// Includes emoji image labels when checking whether the editor has content.
function getEditorText(editor) {
  let text = "";
  let lastWasMention = false;

  function appendText(value, options = {}) {
    if (!value) {
      return;
    }

    const cleanValue = value.replace(/\u200b/g, "");
    if (lastWasMention && cleanValue && !/^\s/.test(cleanValue)) {
      text += " ";
    }

    text += value;

    if (cleanValue) {
      lastWasMention = options.isMention === true;
    }
  }

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.textContent);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (node.tagName === "IMG") {
      appendText(node.getAttribute("alt") || node.getAttribute("title") || "");
      return;
    }

    if (isMentionElement(node)) {
      appendText(node.textContent, { isMention: true });
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

function isInsideMention(node, editor) {
  let element = node.nodeType === Node.ELEMENT_NODE
    ? node
    : node.parentElement;

  while (element && element !== editor) {
    if (isMentionElement(element)) {
      return true;
    }
    element = element.parentElement;
  }

  return false;
}

function getConvertibleTextNodes(editor) {
  return getTextNodes(editor).filter((node) => {
    const value = node.nodeValue || "";
    return value &&
      !isInsideMention(node, editor) &&
      toSimplified(value) !== value;
  });
}

function hasTraditionalText(editor) {
  return getConvertibleTextNodes(editor).length > 0;
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

async function replaceTextNode(editor, node, value) {
  const range = document.createRange();
  range.selectNodeContents(node);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  await waitForEditorUpdate();

  return safeInsertText(editor, value);
}

async function convertEditorText(editor) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const nodes = getConvertibleTextNodes(editor);
    if (nodes.length === 0) {
      return true;
    }

    const node = nodes[nodes.length - 1];
    const originalValue = node.nodeValue || "";
    if (!await replaceTextNode(editor, node, toSimplified(originalValue))) {
      return false;
    }

    await waitForEditorUpdate();
  }

  return getConvertibleTextNodes(editor).length === 0;
}

async function appendEditorText(editor, value) {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);

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

  const plan = {
    currentText,
    needsConversion,
    needsSuffix,
    outgoingSuffix,
    finalText: `${settings.convertToSimplified
      ? toSimplified(currentText)
      : currentText}${needsSuffix ? outgoingSuffix : ""}`
  };

  debugPreparation(editor, plan);
  return plan;
}

async function prepareAndSend(editor, plan) {
  if (!plan || (!plan.needsConversion && !plan.needsSuffix)) {
    return false;
  }

  isSending = true;
  editor.focus();

  if (plan.needsConversion && !await convertEditorText(editor)) {
    isSending = false;
    console.error("[Douyin Suffix Helper] Browser rejected text conversion.");
    return false;
  }

  if (plan.needsSuffix && !await appendEditorText(editor, plan.outgoingSuffix)) {
    isSending = false;
    console.error("[Douyin Suffix Helper] Browser rejected suffix insertion.");
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
