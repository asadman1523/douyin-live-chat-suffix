// 抖音直播发言自动后缀 Popup Settings
document.addEventListener("DOMContentLoaded", () => {
  const {
    DEFAULT_SETTINGS,
    SUFFIX_PRESETS,
    normalizeCustomPresets,
    normalizeSettings
  } = globalThis.DouyinSuffixConfig;
  const enabledToggle = document.getElementById("enabled-toggle");
  const convertToggle = document.getElementById("convert-toggle");
  const prefixSelect = document.getElementById("suffix-prefix");
  const presetSelect = document.getElementById("suffix-preset");
  const customPresetInput = document.getElementById("custom-preset-input");
  const addPresetButton = document.getElementById("add-preset");
  const deletePresetButton = document.getElementById("delete-preset");
  const suffixContainer = document.getElementById("suffix-container");
  const statusText = document.getElementById("status-text");
  let statusTimeout;
  let customPresets = [];
  const syncStorage = globalThis.chrome?.storage?.sync;

  function getStoredSettings(callback) {
    if (syncStorage) {
      syncStorage.get(null, callback);
      return;
    }

    const previewSettings = JSON.parse(
      localStorage.getItem("douyinSuffixPreview") || "{}"
    );
    callback(previewSettings);
  }

  function setStoredSettings(values, callback = () => {}) {
    if (syncStorage) {
      syncStorage.set(values, callback);
      return;
    }

    const current = JSON.parse(
      localStorage.getItem("douyinSuffixPreview") || "{}"
    );
    localStorage.setItem(
      "douyinSuffixPreview",
      JSON.stringify({ ...current, ...values })
    );
    callback();
  }

  function showStatus() {
    statusText.classList.add("show");
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      statusText.classList.remove("show");
    }, 1500);
  }

  function updateSuffixControls(enabled) {
    suffixContainer.classList.toggle("disabled", !enabled);
    prefixSelect.disabled = !enabled;
    presetSelect.disabled = !enabled;
    customPresetInput.disabled = !enabled;
    addPresetButton.disabled = !enabled;
    updateDeleteButton(enabled);
  }

  function updateDeleteButton(enabled = enabledToggle.checked) {
    deletePresetButton.disabled = !enabled ||
      !customPresets.includes(presetSelect.value);
  }

  function renderPresetOptions(selectedValue) {
    presetSelect.replaceChildren();

    SUFFIX_PRESETS.forEach((preset) => {
      presetSelect.append(new Option(preset, preset));
    });

    if (customPresets.length) {
      const separator = new Option("----------------", "");
      separator.disabled = true;
      presetSelect.append(separator);

      customPresets.forEach((preset) => {
        presetSelect.append(new Option(preset, preset));
      });
    }

    presetSelect.value = [...SUFFIX_PRESETS, ...customPresets].includes(selectedValue)
      ? selectedValue
      : DEFAULT_SETTINGS.suffixPreset;
    updateDeleteButton();
  }

  function saveSetting(key, value) {
    setStoredSettings({ [key]: value }, showStatus);
  }

  getStoredSettings((items) => {
    const normalized = normalizeSettings(items);
    enabledToggle.checked = normalized.enabled;
    convertToggle.checked = normalized.convertToSimplified;
    prefixSelect.value = normalized.suffixPrefix;
    customPresets = normalized.customSuffixPresets;
    renderPresetOptions(normalized.suffixPreset);
    updateSuffixControls(normalized.enabled);

    setStoredSettings(normalized, () => {
      if (items.suffix !== undefined && syncStorage) {
        syncStorage.remove("suffix");
      }
    });
  });

  enabledToggle.addEventListener("change", () => {
    updateSuffixControls(enabledToggle.checked);
    saveSetting("enabled", enabledToggle.checked);
  });

  convertToggle.addEventListener("change", () => {
    saveSetting("convertToSimplified", convertToggle.checked);
  });

  prefixSelect.addEventListener("change", () => {
    saveSetting("suffixPrefix", prefixSelect.value);
  });

  presetSelect.addEventListener("change", () => {
    updateDeleteButton();
    saveSetting("suffixPreset", presetSelect.value);
  });

  function addCustomPreset() {
    const value = customPresetInput.value.trim();
    if (!value) {
      customPresetInput.focus();
      return;
    }

    if (!SUFFIX_PRESETS.includes(value) && !customPresets.includes(value)) {
      customPresets = normalizeCustomPresets([...customPresets, value]);
    }

    renderPresetOptions(value);
    customPresetInput.value = "";
    setStoredSettings({
      customSuffixPresets: customPresets,
      suffixPreset: presetSelect.value
    }, showStatus);
  }

  addPresetButton.addEventListener("click", addCustomPreset);
  customPresetInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addCustomPreset();
    }
  });

  deletePresetButton.addEventListener("click", () => {
    const selected = presetSelect.value;
    if (!customPresets.includes(selected)) {
      return;
    }

    customPresets = customPresets.filter((preset) => preset !== selected);
    renderPresetOptions(DEFAULT_SETTINGS.suffixPreset);
    setStoredSettings({
      customSuffixPresets: customPresets,
      suffixPreset: DEFAULT_SETTINGS.suffixPreset
    }, showStatus);
  });
});
