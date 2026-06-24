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

function getTextNodeSnapshot(editor) {
  return getTextNodes(editor)
    .map((node) => node.nodeValue || "")
    .join("\u0000");
}

function replaceTextRange(node, startOffset, endOffset, value) {
  const range = document.createRange();
  range.setStart(node, startOffset);
  range.setEnd(node, endOffset);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  return document.execCommand("insertText", false, value);
}

function waitForEditorUpdate() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 20);
      });
    });
  });
}

async function replaceEditorText(editor, value) {
  const textNodes = getTextNodes(editor).filter((node) => {
    return (node.nodeValue || "").replace(/\u200b/g, "").length > 0;
  });
  if (!textNodes.length) {
    console.error("[Douyin Suffix Helper] No Slate text nodes found.");
    return false;
  }

  const firstNode = textNodes[0];
  const lastNode = textNodes[textNodes.length - 1];
  const range = document.createRange();
  range.setStart(firstNode, 0);
  range.setEnd(lastNode, (lastNode.nodeValue || "").length);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  // Slate keeps its own selection model. Give its selectionchange listener time
  // to observe the browser range before issuing the native replacement.
  await waitForEditorUpdate();

  return document.execCommand("insertText", false, value);
}

function findLastConversion(editor) {
  const nodes = getTextNodes(editor);

  for (let nodeIndex = nodes.length - 1; nodeIndex >= 0; nodeIndex -= 1) {
    const node = nodes[nodeIndex];
    const value = node.nodeValue || "";
    const characters = Array.from(value);

    for (let characterIndex = characters.length - 1;
      characterIndex >= 0;
      characterIndex -= 1) {
      const original = characters[characterIndex];
      const converted = toSimplified(original);
      if (converted === original) {
        continue;
      }

      const startOffset = characters
        .slice(0, characterIndex)
        .join("")
        .length;

      return {
        node,
        startOffset,
        endOffset: startOffset + original.length,
        original,
        converted
      };
    }
  }

  return null;
}

// Replacing a complete Slate text node can be partially reverted by React.
// Convert one character from the end at a time and verify every mutation.
async function convertEditorText(editor) {
  for (let replacements = 0; replacements < 500; replacements += 1) {
    const conversion = findLastConversion(editor);
    if (!conversion) {
      return true;
    }

    const beforeSnapshot = getTextNodeSnapshot(editor);
    if (!replaceTextRange(
      conversion.node,
      conversion.startOffset,
      conversion.endOffset,
      conversion.converted
    )) {
      console.error("[Douyin Suffix Helper] Browser rejected text conversion.");
      return false;
    }

    await waitForEditorUpdate();
    if (getTextNodeSnapshot(editor) === beforeSnapshot) {
      console.error("[Douyin Suffix Helper] Editor did not accept text conversion.");
      return false;
    }
  }

  return !hasTraditionalText(editor);
}

function placeCursorAtEnd(editor) {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function appendSuffix(editor, suffix) {
  placeCursorAtEnd(editor);
  return document.execCommand("insertText", false, suffix);
}

function editorEndsWith(editor, suffix) {
  return getEditorText(editor)
    .replace(/\u200b/g, "")
    .trim()
    .endsWith(suffix.trim());
}

function normalizeEditorText(value) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .trim();
}

function dispatchEditorChange(editor) {
  editor.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "insertText",
    data: null
  }));
  editor.dispatchEvent(new Event("change", { bubbles: true }));
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
  const currentText = getEditorText(editor).replace(/\u200b/g, "").trim();
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
    !comparableText.endsWith(outgoingSuffix.trim());

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

  const currentText = getEditorText(editor);
  const hasSurrogatePairs = Array.from(currentText).length !== currentText.length;
  const hasImageContent = Boolean(editor.querySelector("img"));
  const isComplexContent = hasImageContent || hasSurrogatePairs;

  // A single native edit is the most reliable way to update Slate's internal
  // value. Use it for normal text messages so conversion and suffix insertion
  // cannot be split across competing React updates.
  if (!isComplexContent && (plan.needsConversion || plan.needsSuffix)) {
    if (!await replaceEditorText(editor, plan.finalText)) {
      isSending = false;
      console.error("[Douyin Suffix Helper] Browser rejected message replacement.");
      return false;
    }

    await waitForEditorUpdate();
    await waitForEditorUpdate();

    if (normalizeEditorText(getEditorText(editor)) !==
        normalizeEditorText(plan.finalText)) {
      isSending = false;
      console.error("[Douyin Suffix Helper] Editor did not accept final message.");
      return false;
    }
  } else if (plan.needsConversion) {
    const converted = await convertEditorText(editor);
    if (!converted) {
      isSending = false;
      return false;
    }
  }

  if (isComplexContent && plan.needsSuffix) {
    if (!appendSuffix(editor, plan.outgoingSuffix)) {
      isSending = false;
      console.error("[Douyin Suffix Helper] Browser rejected suffix insertion.");
      return false;
    }
    await waitForEditorUpdate();
    if (!editorEndsWith(editor, plan.outgoingSuffix)) {
      isSending = false;
      console.error("[Douyin Suffix Helper] Editor did not accept the suffix.");
      return false;
    }
  }

  dispatchEditorChange(editor);
  await waitForEditorUpdate();

  if (settings.convertToSimplified && hasTraditionalText(editor)) {
    isSending = false;
    console.error("[Douyin Suffix Helper] Traditional text remained before send.");
    return false;
  }

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
