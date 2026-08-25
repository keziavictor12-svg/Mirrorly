# Mirrorly MakeHuman CC0 sources

These files are retained so the two true-3D proof assets can be rebuilt and audited.

## Shipped proof assets

- `toigo_curled_under_bob/` builds `public/assets/models/bob-cc0.glb`.
- `short01/` builds `public/assets/models/short-cc0.glb` and is used for the Crew Cut proof.

`cortu_short_messy_hair/` was evaluated as an alternative short style but is not referenced by the application.

## Provenance and license

- Source: MakeHuman Community Hair 01 and MakeHuman System Assets packs.
- Pack pages: https://static.makehumancommunity.org/assets/assetpacks/hair01.html and https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
- License: CC0 1.0. See https://static.makehumancommunity.org/about/license.html
- The local `.obj` and `.mhmat` headers are retained with the source files.

## Rebuild

From `MirrorlyLaptopApp` run:

```powershell
npm install
npm run build:3d-assets
```

The build downsizes the large bob textures for local-browser delivery and embeds textures in GLB outputs.
