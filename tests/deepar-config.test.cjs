const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  DEEPAR_LOOKS,
  DEEPAR_SAMPLE_EFFECTS,
  getDeepArConfiguration
} = require("../deepar-config.cjs");

function withEffects(count, callback) {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "mirrorly-deepar-"));
  const effectsDir = path.join(publicDir, "assets", "deepar", "effects");
  fs.mkdirSync(effectsDir, { recursive: true });
  for (const look of DEEPAR_LOOKS.slice(0, count)) {
    fs.writeFileSync(path.join(effectsDir, look.filename), "fixture");
  }
  try {
    callback(publicDir);
  } finally {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
}

test("DeepAR look manifest covers all eight styles and five colors", () => {
  assert.equal(DEEPAR_LOOKS.length, 40);
  assert.equal(new Set(DEEPAR_LOOKS.map((look) => look.key)).size, 40);
  assert.equal(DEEPAR_LOOKS[0].filename, "bob-natural-black.deepar");
  assert.equal(DEEPAR_LOOKS[0].sharedFilename, "bob.deepar");
  assert.equal(DEEPAR_LOOKS.at(-1).filename, "skin-fade-golden-blonde.deepar");
});

test("eight shared hairstyle effects cover all forty style and color selections", () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "mirrorly-deepar-shared-"));
  const effectsDir = path.join(publicDir, "assets", "deepar", "effects");
  fs.mkdirSync(effectsDir, { recursive: true });
  for (const filename of new Set(DEEPAR_LOOKS.map((look) => look.sharedFilename))) {
    fs.writeFileSync(path.join(effectsDir, filename), "fixture");
  }
  try {
    const config = getDeepArConfiguration(publicDir, { DEEPAR_LICENSE_KEY: "fixture-key" });
    assert.equal(config.complete, true);
    assert.equal(config.configuredLookCount, 40);
    assert.equal(config.effects["bob:Natural Black"], "/assets/deepar/effects/bob.deepar");
    assert.equal(config.effects["bob:Golden Blonde"], "/assets/deepar/effects/bob.deepar");
    assert.deepEqual(config.colorControl.values.Copper, [0.678431, 0.356863, 0.215686, 1]);
    assert.deepEqual(config.colorControl.targets, [
      { gameObject: "Hair", parameter: "u_diffuse" },
      { gameObject: "Har", parameter: "u_diffuse" },
      { gameObject: "Hair", parameter: "u_baseColorFactor" },
      { gameObject: "Har", parameter: "u_baseColorFactor" },
      { gameObject: "Hair", parameter: "u_color" },
      { gameObject: "Har", parameter: "u_color" }
    ]);
  } finally {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
});

test("DeepAR exposes installed free-package samples without treating them as salon looks", () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "mirrorly-deepar-samples-"));
  const samplesDir = path.join(publicDir, "assets", "deepar", "samples");
  fs.mkdirSync(samplesDir, { recursive: true });
  fs.writeFileSync(path.join(samplesDir, DEEPAR_SAMPLE_EFFECTS[0].filename), "fixture");
  try {
    const config = getDeepArConfiguration(publicDir, { DEEPAR_LICENSE_KEY: "fixture-key" });
    assert.equal(config.ready, false);
    assert.equal(config.configuredLookCount, 0);
    assert.deepEqual(config.sampleEffects, [{
      name: "Burning Effect",
      url: "/assets/deepar/samples/burning-effect.deepar"
    }]);
    assert.equal(config.testEffectUrl, "/assets/deepar/samples/burning-effect.deepar");
  } finally {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
});

test("DeepAR requires a key and activates only for installed look effects", () => {
  withEffects(1, (publicDir) => {
    const withoutKey = getDeepArConfiguration(publicDir, {});
    assert.equal(withoutKey.available, false);
    assert.equal(withoutKey.ready, false);
  });

  withEffects(1, (publicDir) => {
    const partial = getDeepArConfiguration(publicDir, { DEEPAR_LICENSE_KEY: "fixture-key" });
    assert.equal(partial.available, true);
    assert.equal(partial.ready, true);
    assert.equal(partial.complete, false);
    assert.equal(partial.configuredLookCount, 1);
  });

  withEffects(40, (publicDir) => {
    const complete = getDeepArConfiguration(publicDir, { DEEPAR_LICENSE_KEY: "fixture-key" });
    assert.equal(complete.complete, true);
    assert.equal(complete.configuredLookCount, complete.expectedLookCount);
    assert.equal(complete.effects["feather:Chestnut Brown"], "/assets/deepar/effects/feather-chestnut-brown.deepar");
  });
});
