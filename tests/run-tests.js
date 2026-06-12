const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({});

vm.runInContext(
  fs.readFileSync(path.join(root, "vendor/opencc-js/t2cn.js"), "utf8"),
  context
);
vm.runInContext(
  fs.readFileSync(path.join(root, "settings.js"), "utf8"),
  context
);

const config = context.DouyinSuffixConfig;
const convert = context.OpenCC.Converter({ from: "t", to: "cn" });

for (const prefix of config.SUFFIX_PREFIXES) {
  for (const preset of config.SUFFIX_PRESETS) {
    const suffix = config.buildSuffix({
      suffixPrefix: prefix,
      suffixPreset: preset
    });
    assert.equal(
      suffix,
      ` ${prefix}${preset}`
    );
    assert.equal(
      convert(`訊息${suffix}`),
      `讯息 ${prefix}${convert(preset)}`
    );
  }
}

assert.equal(convert("繁體訊息 /黑絲"), "繁体讯息 /黑丝");
assert.equal(convert("滑鼠與軟體"), "滑鼠与软体");
assert.equal(convert("彎彎 灣灣"), "弯弯 湾湾");
assert.deepEqual(
  JSON.parse(JSON.stringify(config.normalizeSettings({ suffix: " /黑丝" }))),
  {
    enabled: true,
      suffixPrefix: "/",
      suffixPreset: "黑絲",
      customSuffixPresets: [],
      convertToSimplified: true
  }
);
assert.equal(
  config.normalizeSettings({ suffix: " /西红柿" }).suffixPreset,
  "黑絲"
);
assert.equal(
  config.normalizeSettings({ convertToSimplified: false }).convertToSimplified,
  false
);
assert.deepEqual(
  JSON.parse(JSON.stringify(config.normalizeSettings({
    suffixPreset: "自訂",
    customSuffixPresets: ["自訂", "自訂", "", "黑絲"]
  }))),
  {
    enabled: true,
    suffixPrefix: "(",
    suffixPreset: "自訂",
    customSuffixPresets: ["自訂"],
    convertToSimplified: true
  }
);

console.log("All settings and conversion tests passed.");
