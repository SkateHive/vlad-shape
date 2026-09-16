# vlad-shape

Landing page for the Vlad pro shape — [vlad.skatehive.app](https://vlad.skatehive.app).

Next.js 15 (App Router), no UI library — a single hand-styled page matching
Skatehive's terminal look. The hero is a full-bleed, scroll-driven Three.js
skateboard (see `public/skate/README-SOURCE.md` for where that comes from);
the actual landing content (specs, CTA) releases into normal document flow
once the animation finishes.

## Develop

```sh
pnpm install
pnpm dev
```

## Structure

- `components/SkateScene.tsx` — React-lifecycle adaptation of the vendored
  kit's viewer (mount/unmount, scroll progress, damping, pointer/keyboard
  interaction, disposal). The 3D model, artwork and animation logic
  themselves are untouched, vendored files under `public/skate/`.
- `app/page.tsx` — the actual landing copy (specs pulled from the kit's own
  `MODEL.md`, a Discord CTA — there's no checkout yet).
- `app/globals.css` — layout rules for the sticky scroll section (do not
  change the `.skateScroll`/`.skateStage` sizing without also updating the
  progress math in `SkateScene.tsx`) plus the page's visual style.

## Deploy

Vercel, team SOPA, custom domain `vlad.skatehive.app`.
