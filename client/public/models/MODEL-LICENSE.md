# Lund–Browder anatomical model

`lund-browder-athletic-male.obj` is generated from MakeHuman's hm08 base body
and official young Caucasian male, muscular, ideal-proportion, pectoral, dorsi,
V-shape, shoulder, arm, and leg targets. The included
`lund-browder-male-skin.png` is MakeHuman's young light-skinned male diffuse
texture. These source assets declare an explicit CC0 release.

- Base mesh and targets: https://github.com/makehumancommunity/makehuman/tree/master/makehuman/data
- Skin texture mirror: https://absinthe.tuxfamily.org/makehuman/assets/1.1/base/skins/textures/
- MakeHuman licensing: https://static.makehumancommunity.org/about/license.html
- License: Creative Commons CC0 1.0 Universal

The adult model is the locked production asset. Its SHA-256 digest is recorded
in `lund-browder-model-manifest.json` and the generator refuses to overwrite it
unless `--regenerate-adult` is explicitly supplied. Pediatric rendering uses
the topology-compatible `lund-browder-pediatric-infant.obj` and
`lund-browder-pediatric-child.obj` assets, blended by age and normalized only
for consistent viewport presentation. The locked adult topology remains the
canonical Lund-Browder selection coordinate system for every age.

The reproducible generator is `scripts/generate-lund-browder-model.mjs`. The
Codical application applies its own age-proportion transform, fitted clinical
underwear, direct mesh-hit classification, and Lund–Browder visualization at
runtime. The application also adds a body-mesh-fitted clinical boxer garment,
procedural skin-pore and fabric-weave PBR maps, and studio environment lighting.
The model is intentionally an external surface-area model; DICOM-derived
internal anatomy is outside the clinical scope of TBSA selection.
