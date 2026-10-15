# ArcMap Rage Room

An unofficial, browser-based, cartoon physics sandbox inspired by the frustrations of working with classic GIS software.

**Play online (after Pages is enabled):** https://devonramey.github.io/ArcMap-Rage-Room/

**Source:** https://github.com/devonramey/ArcMap-Rage-Room

You can also download `index.html` and open it locally in Chrome or Edge.

## How to publish with GitHub Pages

1. Open this repository's **Settings > Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**, choose **main** and **/(root)**, then click **Save**.
3. Wait for GitHub Pages to publish and open https://devonramey.github.io/ArcMap-Rage-Room/.

The HTML file is fully self-contained, so there is no build process, package manager, GitHub Actions workflow, or dependency download required. It uses your visitor's device to render graphics and simulate physics.

## Controls

- Left-click: use selected weapon; hold to fire continuous weapons
- Right-drag: grab and throw the ArcMap mascot
- Sword / Plasma Whip: hold and drag to swing
- Q / E: switch tools
- F: equip the Cricket Gun, hold left mouse button to charge, release to fire
- Space: repair and reset the target
- B: toggle red damage effects
- G: toggle gravity
- M: toggle audio
- P: pause

## About the game

- Version: v6.1 orientation-corrected browser release
- 37 tools, single empty arena, persistent damage, and destructible ragdoll mascot
- No installation, external libraries, tracking, analytics, or backend
- Graphics may use WebGL2 when supported; falls back to Canvas
- The full experimental Planck/Pixi integration is **not** included in this self-contained release

## Trademark and disclaimer

Unofficial parody and stress-relief project. Not affiliated with, endorsed by, or sponsored by Esri. ArcMap, ArcGIS, and Esri are trademarks of their respective owners. Branding is used for parody identification; no claim of ownership is made.

## Sharing

The source in `index.html` is publicly viewable when this repository is public. Do not include secrets, account credentials, or work-related GIS data in this repository.
