# Source: skatehive-threejs-kit

The files in this directory (`model.js`, `artwork.js`, `griptape.js`,
`cinematic-motion.js`, `vendor/`, `assets/`) are vendored unmodified from the
`skatehive-threejs-kit` handoff package — see `SOURCE_VERSION.txt` for the
exact source revision.

They're served here as static files (not run through Next's bundler — the
component that consumes them, `components/SkateScene.tsx`, imports each with
a `webpackIgnore` comment) because they resolve their own relative imports
and assets via `import.meta.url`, and the integration notes that shipped with
the kit call for keeping that module graph together and untouched.

Do not edit these files directly — if the model/animation needs to change,
get an updated kit export and replace this directory, or fork the specific
file with a clear comment explaining the divergence.

`vendor/` is Three.js r160 and its matching MarchingCubes addon (MIT
license, `vendor/THREE-LICENSE.txt`). The Skatehive logo and deck graphic in
`assets/` are original artwork, not covered by that license.
