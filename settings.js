(function initializeSuffixSettings(globalObject) {
  "use strict";

  const SUFFIX_PREFIXES = ["/", "("];
  const SUFFIX_PRESETS = ["黑絲", "13", "皇后", "彎彎", "灣灣"];
  const PRESET_ALIASES = {
    "黑丝": "黑絲",
    "弯弯": "彎彎",
    "湾湾": "灣灣"
  };
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    suffixPrefix: "(",
    suffixPreset: "黑絲",
    customSuffixPresets: [],
    convertToSimplified: true
  });

  function normalizeCustomPresets(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    const presets = value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item && !SUFFIX_PRESETS.includes(item));

    return [...new Set(presets)].slice(0, 20);
  }

  function normalizePreset(value, customPresets) {
    const preset = PRESET_ALIASES[value] || value;
    return SUFFIX_PRESETS.includes(preset) || customPresets.includes(preset)
      ? preset
      : DEFAULT_SETTINGS.suffixPreset;
  }

  function parseLegacySuffix(value) {
    if (typeof value !== "string") {
      return {};
    }

    const trimmed = value.trim();
    const prefix = SUFFIX_PREFIXES.includes(trimmed.charAt(0))
      ? trimmed.charAt(0)
      : DEFAULT_SETTINGS.suffixPrefix;
    const rawPreset = SUFFIX_PREFIXES.includes(trimmed.charAt(0))
      ? trimmed.slice(1).trim()
      : trimmed;
    const preset = PRESET_ALIASES[rawPreset] || rawPreset;

    if (!SUFFIX_PRESETS.includes(preset)) {
      return {};
    }

    return {
      suffixPrefix: prefix,
      suffixPreset: preset
    };
  }

  function normalizeSettings(items) {
    const source = items || {};
    const legacy = parseLegacySuffix(source.suffix);
    const customSuffixPresets = normalizeCustomPresets(source.customSuffixPresets);

    return {
      enabled: typeof source.enabled === "boolean"
        ? source.enabled
        : DEFAULT_SETTINGS.enabled,
      suffixPrefix: SUFFIX_PREFIXES.includes(source.suffixPrefix)
        ? source.suffixPrefix
        : legacy.suffixPrefix || DEFAULT_SETTINGS.suffixPrefix,
      suffixPreset: source.suffixPreset !== undefined
        ? normalizePreset(source.suffixPreset, customSuffixPresets)
        : legacy.suffixPreset || DEFAULT_SETTINGS.suffixPreset,
      customSuffixPresets,
      convertToSimplified: typeof source.convertToSimplified === "boolean"
        ? source.convertToSimplified
        : DEFAULT_SETTINGS.convertToSimplified
    };
  }

  function buildSuffix(settings) {
    const normalized = normalizeSettings(settings);
    return ` ${normalized.suffixPrefix}${normalized.suffixPreset}`;
  }

  globalObject.DouyinSuffixConfig = Object.freeze({
    DEFAULT_SETTINGS,
    SUFFIX_PREFIXES,
    SUFFIX_PRESETS,
    buildSuffix,
    normalizeCustomPresets,
    normalizeSettings,
    parseLegacySuffix
  });
})(globalThis);
