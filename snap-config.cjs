// Snap Camera Kit configuration for the live mirror.
//
// Camera Kit Web is a browser SDK, so its API token is delivered to the page
// (Snap's design). It is read from the environment or the git-ignored
// .env.local, never committed, and served only by the local server.
//
//   SNAP_CAMERA_KIT_API_TOKEN  Camera Kit API token (Snap developer portal)
//   SNAP_LENS_GROUP_ID         Lens group id(s), comma separated
//   SNAP_LENS_MAP              Optional JSON: {"bob": "<lensId>", "bob:Copper": "<lensId>"}
//
// Without SNAP_LENS_MAP, lenses are matched by name in the browser:
// "<style-id>" or "<style-id>-<color-slug>" (e.g. "bob", "bob-golden-blonde").

function parseLensMap(raw) {
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('SNAP_LENS_MAP must be JSON like {"bob":"<lensId>"}');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('SNAP_LENS_MAP must be a JSON object');
  }
  const map = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string' && value.trim()) map[key] = value.trim();
  }
  return map;
}

function snapConfig(environment = process.env) {
  const apiToken = (environment.SNAP_CAMERA_KIT_API_TOKEN || '').trim();
  const lensGroupIds = (environment.SNAP_LENS_GROUP_ID || '')
    .split(',').map((id) => id.trim()).filter(Boolean);
  let lensMap = {};
  let error = null;
  try {
    lensMap = parseLensMap(environment.SNAP_LENS_MAP);
  } catch (parseError) {
    error = parseError.message;
  }
  const available = Boolean(apiToken && lensGroupIds.length && !error);
  return {
    available,
    apiToken: available ? apiToken : null,
    lensGroupIds: available ? lensGroupIds : [],
    lensMap: available ? lensMap : {},
    missing: [
      ...(apiToken ? [] : ['SNAP_CAMERA_KIT_API_TOKEN']),
      ...(lensGroupIds.length ? [] : ['SNAP_LENS_GROUP_ID'])
    ],
    error
  };
}

module.exports = { snapConfig, parseLensMap };
