# Inline environment texture production smoke

This isolated Issue #565 fixture uses BabylonJS `photoStudio.env`, pinned to
commit `c304b15957055b6117d589a994cb8406d2d0512c` under Apache-2.0. The fixture
SHA-256 is `7f283a40479d13cd87b1471eb2f43e51afceff46e28ac3a525aa540bf5c63844`.

`npm run test:inline-environment-texture:build` creates a dedicated single-file
page under `dist-tests/inline-environment-texture/`. It never imports the
template GameWorld, scene config, rendering config, or normal Vite config.

Serve that output and inspect `#inline-environment-texture-evidence` in a real
browser. Its bounded JSON must report `status: "ready"`, `transport:
"data-url"`, `format: ".env"`, a present ready environment texture, and the
expected intensity and rotation. It never emits the Data URL itself.
