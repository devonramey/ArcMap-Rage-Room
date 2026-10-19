# ArcMap Rage Room v7.1

An **unofficial browser-based physics parody** of familiar GIS software.

**Play:** https://devonramey.github.io/ArcMap-Rage-Room/

## Ragdoll collision and drag fix (v7.1)

- Fixed a Planck.js mouse-joint initialization error that sometimes attached the cursor to an imaginary point far outside the body, causing unnatural torque, wall penetration and uncontrolled limb rotation.
- Torso dragging now follows the cursor from the physical body's center; grabbing a hand or foot attaches at that actual endpoint.
- Mouse targets respect the physical interior walls, ceiling and floor. While a character is held, small solver overlaps are corrected against the rotated torso bounds; **released throws continue to collide with the walls naturally**.
- Reduced excessively stiff dragging, increased collision solver stability, and corrected full-turn shoulder/elbow angle accumulation after hard throws.
- Added gentle, torque-limited limb recovery so the limbs don't remain stuck splayed sideways after aggressive tossing.
- Automated regression simulates 840 drag frames against boundaries, hand/foot dragging and repeated forceful throws, in addition to the original physics and real-browser tests.

## What's new in v7.0

- **38 tools**, including a new **Throwing Knives** tool in BLADES. Knives follow ballistic trajectories and lodge in the body segment they strike. Misses can stick to room boundaries.
- A bundled **Planck.js v1.5.1** Box2D-style 2D engine replaces the original arcade body solver in supported browsers. The torso and each arm/leg segment have independent physical bodies, hinged joints, friction, restitution, and dynamic collisions.
- Projectiles now use **swept physical raycasts** against the torso, upper arms, forearms, thighs, and lower legs. The impacted part receives the force rather than the torso automatically.
- Impacts produce **localized damage marks** that move and rotate with the struck segment. Sufficient cumulative damage to a limb can detach it.
- The Cricket Gun still requires a **direct hit** and now turns the splash image into **12 independent physics bodies**. The fragments collide with the world and each other.
- Dragging uses Planck mouse joints. Existing flamethrower, damage materials, experimental effects, face animation, and vocal reactions are retained.
- The previous WebGL screen-orientation fix remains included.

## Play and controls

Open the live GitHub Pages link in a recent version of Chrome or Edge. The static game runs entirely on the visitor's computer; GitHub only hosts the files.

- **Left click:** use weapon. Hold for continuous weapons.
- **Throwing Knives:** select in **BLADES**, aim, and click/hold to throw.
- **Right drag:** grab and throw a limb or the torso.
- **Sword / Plasma Whip:** hold and drag.
- **Q / E:** cycle weapons.
- **F:** equip Cricket Gun; hold left click to charge, release to fire.
- **Space:** repair and reset.
- **V:** turn character vocals on/off; **M:** mute all audio.
- **B:** toggle red effects; **G:** lower gravity; **P:** pause.

## Project files

- `index.html`: gameplay, interface, damage rendering, weapons, WebGL visual effects.
- `vendor/planck.min.js`: locally served Planck.js physics engine (MIT-licensed).
- `vendor/LICENSE-Planck.txt`: required license.
- `arcmap_physics_v7.js`: Planck ragdoll, exact segment collisions, mouse joints, fragment physics.
- `arcmap_voice_clips_v6_2.js` and `arcmap_character_v6_2.js`: actor-recorded vocalizations and facial expressions.
- `tests/physics-smoke.cjs`: real-engine physics regression tests, run automatically by GitHub Actions.

**Offline use:** Download the repository as a ZIP and extract the entire folder. Open `index.html` with its supporting scripts and `vendor` folder present. The physics module is not embedded into the HTML, so downloading `index.html` alone will not load the Planck engine.

There is no tracking, analytics, user-data collection, or backend service.

## Sound license

Adult male vocal effects are edited from **CC0-licensed** recordings performed by **HaelDB**, [Male Grunt/Yelling Sounds](https://opengameart.org/content/male-gruntyelling-sounds), and published on OpenGameArt. These are voice performances, not recordings of people being injured. Additional provenance is documented in the upstream [audio asset notes](https://github.com/transitive-bullshit/ai-safety-doom/blob/main/public/game/audio/README.md).

Planck.js v1.5.1 is distributed under the MIT license; see `vendor/LICENSE-Planck.txt`.

## Trademark / disclaimer

This is an unofficial parody for entertainment, not associated with or endorsed by Esri. ArcMap, ArcGIS, and Esri are trademarks of their respective owners. Any recognizable imagery is used for parody identification; other companies' brands and artwork are not covered by the Planck or audio licenses. Do not upload work-related GIS files, credentials, or confidential data to this public repository.
