const fs = require("node:fs");
const path = require("node:path");

const DEEPAR_SDK_VERSION = "5.6.22";
const DEEPAR_STYLES = Object.freeze([
  "bob",
  "feather",
  "v-cut",
  "u-cut",
  "crew-cut",
  "buzz-cut",
  "curtain-bangs",
  "skin-fade"
]);
const DEEPAR_COLORS = Object.freeze([
  "Natural Black",
  "Dark Brown",
  "Chestnut Brown",
  "Copper",
  "Golden Blonde"
]);
const DEEPAR_COLOR_VECTORS = Object.freeze({
  "Natural Black": Object.freeze([0.090196, 0.078431, 0.090196, 1]),
  "Dark Brown": Object.freeze([0.207843, 0.137255, 0.113725, 1]),
  "Chestnut Brown": Object.freeze([0.439216, 0.262745, 0.184314, 1]),
  Copper: Object.freeze([0.678431, 0.356863, 0.215686, 1]),
  "Golden Blonde": Object.freeze([0.796078, 0.65098, 0.411765, 1])
});
const DEEPAR_SAMPLE_EFFECTS = Object.freeze([
  ["Burning Effect", "burning-effect.deepar"],
  ["Devil Neon Horns", "devil-neon-horns.deepar"],
  ["Elephant Trunk", "elephant-trunk.deepar"],
  ["Emotion Meter", "emotion-meter.deepar"],
  ["Emotions Exaggerator", "emotions-exaggerator.deepar"],
  ["Fire Effect", "fire-effect.deepar"],
  ["Flower Face", "flower-face.deepar"],
  ["Galaxy Background", "galaxy-background.deepar"],
  ["Hope", "hope.deepar"],
  ["Humanoid", "humanoid.deepar"],
  ["Makeup Look Simple", "makeup-look-simple.deepar"],
  ["Makeup Look Split Screen", "makeup-look-split-screen.deepar"],
  ["Ping Pong Minigame", "ping-pong-minigame.deepar"],
  ["Pixel Heart Particles", "pixel-heart-particles.deepar"],
  ["Snail", "snail.deepar"],
  ["Stallone", "stallone.deepar"],
  ["Vendetta Mask", "vendetta-mask.deepar"],
  ["Viking Helmet PBR", "viking-helmet-pbr.deepar"]
].map(([name, filename]) => Object.freeze({ name, filename })));

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function createLookManifest() {
  const looks = [];
  for (const styleId of DEEPAR_STYLES) {
    for (const colorName of DEEPAR_COLORS) {
      looks.push({
        key: styleId + ":" + colorName,
        styleId,
        colorName,
        filename: styleId + "-" + slug(colorName) + ".deepar",
        sharedFilename: styleId + ".deepar"
      });
    }
  }
  return looks;
}

const DEEPAR_LOOKS = Object.freeze(createLookManifest());

function getDeepArConfiguration(publicDir, environment = process.env) {
  const effectsDir = path.join(publicDir, "assets", "deepar", "effects");
  const samplesDir = path.join(publicDir, "assets", "deepar", "samples");
  const effects = {};
  for (const look of DEEPAR_LOOKS) {
    const colorSpecificPath = path.join(effectsDir, look.filename);
    const sharedPath = path.join(effectsDir, look.sharedFilename);
    if (fs.existsSync(colorSpecificPath)) effects[look.key] = "/assets/deepar/effects/" + look.filename;
    else if (fs.existsSync(sharedPath)) effects[look.key] = "/assets/deepar/effects/" + look.sharedFilename;
  }
  const sampleEffects = DEEPAR_SAMPLE_EFFECTS
    .filter((sample) => fs.existsSync(path.join(samplesDir, sample.filename)))
    .map((sample) => ({
      name: sample.name,
      url: "/assets/deepar/samples/" + sample.filename
    }));

  const licenseKey = environment.DEEPAR_LICENSE_KEY || "";
  const configuredLookCount = Object.keys(effects).length;
  const expectedLookCount = DEEPAR_LOOKS.length;
  return {
    available: Boolean(licenseKey),
    ready: Boolean(licenseKey) && configuredLookCount > 0,
    complete: Boolean(licenseKey) && configuredLookCount === expectedLookCount,
    licenseKey: licenseKey || null,
    sdkVersion: DEEPAR_SDK_VERSION,
    configuredLookCount,
    expectedLookCount,
    effects,
    colorControl: {
      component: "MeshRenderer",
      targets: Object.freeze([
        Object.freeze({ gameObject: "Hair", parameter: "u_diffuse" }),
        Object.freeze({ gameObject: "Har", parameter: "u_diffuse" }),
        Object.freeze({ gameObject: "Hair", parameter: "u_baseColorFactor" }),
        Object.freeze({ gameObject: "Har", parameter: "u_baseColorFactor" }),
        Object.freeze({ gameObject: "Hair", parameter: "u_color" }),
        Object.freeze({ gameObject: "Har", parameter: "u_color" })
      ]),
      values: DEEPAR_COLOR_VECTORS
    },
    sampleEffects,
    sdkRootPath: "/vendor/deepar/",
    testEffectUrl: environment.DEEPAR_EFFECT_URL || sampleEffects[0]?.url || "/vendor/deepar/effects/aviators"
  };
}

module.exports = {
  DEEPAR_COLORS,
  DEEPAR_COLOR_VECTORS,
  DEEPAR_LOOKS,
  DEEPAR_SAMPLE_EFFECTS,
  DEEPAR_SDK_VERSION,
  DEEPAR_STYLES,
  getDeepArConfiguration,
  slug
};
