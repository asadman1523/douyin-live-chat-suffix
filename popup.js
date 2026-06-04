// 抖音直播发言自动后缀 Popup Settings
document.addEventListener("DOMContentLoaded", () => {
  const enabledToggle = document.getElementById("enabled-toggle");
  const suffixInput = document.getElementById("suffix-input");
  const suffixContainer = document.getElementById("suffix-container");
  const statusText = document.getElementById("status-text");

  let statusTimeout;

  // 显示保存成功提示
  function showStatus() {
    statusText.classList.add("show");
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      statusText.classList.remove("show");
    }, 1500);
  }

  // 加载初始设置
  chrome.storage.sync.get({ enabled: true, suffix: " /西红柿" }, (items) => {
    enabledToggle.checked = items.enabled;
    suffixInput.value = items.suffix;
    
    // 如果未启用，则淡化后缀输入框
    updateSuffixInputVisibility(items.enabled);
  });

  // 更新后缀输入框可用性
  function updateSuffixInputVisibility(enabled) {
    if (enabled) {
      suffixContainer.style.opacity = "1";
      suffixContainer.style.pointerEvents = "auto";
      suffixInput.disabled = false;
    } else {
      suffixContainer.style.opacity = "0.4";
      suffixContainer.style.pointerEvents = "none";
      suffixInput.disabled = true;
    }
  }

  // 监听启用开关改变
  enabledToggle.addEventListener("change", () => {
    const enabled = enabledToggle.checked;
    updateSuffixInputVisibility(enabled);
    chrome.storage.sync.set({ enabled: enabled }, () => {
      showStatus();
    });
  });

  // 监听后缀输入内容改变
  let inputDebounce;
  suffixInput.addEventListener("input", () => {
    clearTimeout(inputDebounce);
    inputDebounce = setTimeout(() => {
      chrome.storage.sync.set({ suffix: suffixInput.value }, () => {
        showStatus();
      });
    }, 300); // 300ms 防抖保存，避免频繁写入
  });
});
