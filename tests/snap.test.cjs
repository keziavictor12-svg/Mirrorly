const test = require('node:test');
const assert = require('node:assert/strict');
const { snapConfig } = require('../snap-config.cjs');
const { findLens, launchParamsFor, slug } = require('../public/snap.js');

test('snap config is unavailable and leaks nothing until token and group are set', () => {
  const none = snapConfig({});
  assert.equal(none.available, false);
  assert.equal(none.apiToken, null);
  assert.deepEqual(none.missing, ['SNAP_CAMERA_KIT_API_TOKEN', 'SNAP_LENS_GROUP_ID']);
  const tokenOnly = snapConfig({ SNAP_CAMERA_KIT_API_TOKEN: 'token-value' });
  assert.equal(tokenOnly.available, false);
  assert.equal(tokenOnly.apiToken, null, 'token must not be served while config is incomplete');
});

test('snap config parses groups and an optional lens map', () => {
  const config = snapConfig({
    SNAP_CAMERA_KIT_API_TOKEN: ' token-value ',
    SNAP_LENS_GROUP_ID: 'group-a, group-b',
    SNAP_LENS_MAP: '{"bob":"lens-1","bob:Copper":"lens-2","bad":5}'
  });
  assert.equal(config.available, true);
  assert.equal(config.apiToken, 'token-value');
  assert.deepEqual(config.lensGroupIds, ['group-a', 'group-b']);
  assert.deepEqual(config.lensMap, { bob: 'lens-1', 'bob:Copper': 'lens-2' });
});

test('invalid lens map JSON disables snap with a readable error', () => {
  const config = snapConfig({ SNAP_CAMERA_KIT_API_TOKEN: 't', SNAP_LENS_GROUP_ID: 'g', SNAP_LENS_MAP: '{bob:' });
  assert.equal(config.available, false);
  assert.match(config.error, /SNAP_LENS_MAP/);
});

const lenses = [
  { id: 'l1', name: 'Bob' },
  { id: 'l2', name: 'bob-golden-blonde' },
  { id: 'l3', name: 'Skin Fade' },
  { id: 'l4', name: 'Something else' }
];

test('lenses are matched by colour-specific name, then style name', () => {
  assert.equal(findLens(lenses, {}, 'bob', 'Golden Blonde').id, 'l2');
  assert.equal(findLens(lenses, {}, 'bob', 'Copper').id, 'l1');
  assert.equal(findLens(lenses, {}, 'skin-fade', 'Natural Black').id, 'l3');
  assert.equal(findLens(lenses, {}, 'v-cut', 'Copper'), null);
});

test('explicit lens map wins over names, colour key before style key', () => {
  const map = { bob: 'l4', 'bob:Copper': 'l3' };
  assert.equal(findLens(lenses, map, 'bob', 'Copper').id, 'l3');
  assert.equal(findLens(lenses, map, 'bob', 'Golden Blonde').id, 'l4');
  assert.equal(findLens(lenses, { bob: 'missing' }, 'bob', 'Copper'), null);
});

test('launch params carry the selected look for recolourable lenses', () => {
  assert.deepEqual(launchParamsFor('bob', { name: 'Copper', value: '#a4522f' }),
    { styleId: 'bob', hairColor: '#a4522f', hairColorName: 'Copper' });
  assert.equal(slug('  Curtain Bangs! '), 'curtain-bangs');
});
