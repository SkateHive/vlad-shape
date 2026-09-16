"use client";

/**
 * Adapts the vendored skatehive-threejs-kit (public/skate/*, unmodified —
 * see public/skate/README-SOURCE.md) into a React lifecycle: same reusable
 * API (createSkateboard / loadSkateArtwork / createCinematicMotion), same
 * section-local scroll math, damping and pointer/keyboard interaction as the
 * kit's own dist/app.js reference viewer — ported instead of imported
 * because app.js expects page-level DOM ids and its own render loop, not a
 * component that can mount/unmount.
 */

import { useEffect, useRef, useState } from "react";

// The kit's modules are served as-is from /public/skate and resolve their
// own relative imports/assets (vendor/, assets/) via import.meta.url — kept
// out of Next's bundler with webpackIgnore so those URLs stay untouched.
// A non-literal specifier makes both TS (module resolution) and webpack
// (bundling) treat this as fully dynamic — it's resolved by the browser at
// runtime against the deployed /skate path, same as any other static asset.
function dynamicImport(path: string): Promise<any> {
  return import(/* webpackIgnore: true */ path);
}

async function loadKit() {
  const T = await dynamicImport("/skate/vendor/three.module.js");
  const { createSkateboard } = await dynamicImport("/skate/model.js");
  const { loadSkateArtwork } = await dynamicImport("/skate/artwork.js");
  const { createCinematicMotion } = await dynamicImport("/skate/cinematic-motion.js");
  return { T, createSkateboard, loadSkateArtwork, createCinematicMotion };
}

const SPECS: string[] = [
  "Premium Canadian maple shape",
  "Manufactured in Mexico",
  "Silkscreened in Brazil",
  "Available in sizes 8.0, 8.25 and 8.5",
];

// IANA "America/<city>" segments that are Brazilian timezones — used only to
// pick a display currency, never sent anywhere or used for anything else.
const BRAZIL_TIMEZONE_CITIES = new Set([
  "Sao_Paulo",
  "Bahia",
  "Fortaleza",
  "Recife",
  "Araguaina",
  "Maceio",
  "Belem",
  "Manaus",
  "Cuiaba",
  "Campo_Grande",
  "Porto_Velho",
  "Boa_Vista",
  "Rio_Branco",
  "Noronha",
]);

const PRICE_BRL = "R$ 349.90";
const INSTALLMENT_BRL = "R$ 58.31";
const PRICE_USD = "$67.99";
const INSTALLMENT_USD = "$11.33";

// Fraction of the total scroll track spent on the (unmodified) disassembly/
// reassembly cinematic — the rest drives the pan + panel/speech-bubble
// reveal below. The cinematic's pacing is entirely relative (fed a 0-1
// range), so shortening these doesn't change how the animation looks or
// feels, only how many physical pixels of scrolling it takes to get
// through it — which is why mobile (no pan, no side-by-side payoff for
// the extra reveal track, and users scroll less per swipe) gets a shorter
// total than desktop. Must match .skateScroll's height in globals.css at
// the same 768px breakpoint.
const DISASSEMBLY_VH_DESKTOP = 660;
const REVEAL_VH_DESKTOP = 280;
const DISASSEMBLY_VH_MOBILE = 420;
const REVEAL_VH_MOBILE = 140;

export default function SkateScene() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const speechRef = useRef<HTMLDivElement | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // Default USD (smaller-looking number); switch to BRL only when we can
  // reasonably tell the visitor is in Brazil — via timezone/locale, which
  // are plain JS properties (no geolocation permission prompt). Not
  // precise (VPNs, travelers), but that's an acceptable tradeoff for a
  // price display, and it's strictly better than always guessing wrong.
  const [currency, setCurrency] = useState<"USD" | "BRL">("USD");

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const lang = (navigator.language || "").toLowerCase();
      const isBrazilTz = tz.startsWith("America/") && BRAZIL_TIMEZONE_CITIES.has(tz.slice("America/".length));
      if (isBrazilTz || lang.startsWith("pt-br")) setCurrency("BRL");
    } catch {
      // Intl/navigator unavailable for some reason — keep the USD default.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const disposers: Array<() => void> = [];

    (async () => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      const scrollSection = sectionRef.current;
      if (!canvas || !stage || !scrollSection) return;

      let T: any, createSkateboard: any, loadSkateArtwork: any, createCinematicMotion: any;
      try {
        ({ T, createSkateboard, loadSkateArtwork, createCinematicMotion } = await loadKit());
      } catch (err) {
        if (!cancelled) setFailure("Couldn't load the 3D scene. Try reloading the page.");
        console.error(err);
        return;
      }
      // React 18/19 StrictMode double-invokes effects in dev: mount, cleanup,
      // mount again on the same DOM node. Without this check, the discarded
      // first instance would keep running past this point and build a second
      // WebGLRenderer sharing the real mount's canvas/GL context — two
      // renderers fighting over one context reliably renders nothing.
      if (cancelled) return;

      const interactiveLabel = canvas.getAttribute("aria-label") || "";
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const clamp = T.MathUtils.clamp as (v: number, a: number, b: number) => number;

      let targetProgress = 0;
      let progress = 0;
      let yaw = 0;
      let pitch = 0;
      let zoom = 1;
      let zoomActual = 1;
      let drag: { id: number; x: number; y: number; yaw: number; pitch: number; touch: boolean } | null =
        null;
      let frame = 0;
      let lastTime = 0;
      let finished = false;
      let disposed = false;
      let wake: (force?: boolean) => void = () => {};

      const sectionTop = () => scrollSection.getBoundingClientRect().top + scrollY;
      const maxScroll = () =>
        Math.max(1, scrollSection.getBoundingClientRect().height - stage.getBoundingClientRect().height);
      const readProgress = () => {
        const offset = scrollY - sectionTop();
        const range = maxScroll();
        return offset >= range - 1 ? 1 : clamp(offset / range, 0, 1);
      };

      function setFinished(value: boolean) {
        if (finished === value) return;
        finished = value;
        stage!.dataset.state = value ? "finished" : "active";
        canvas!.tabIndex = value ? -1 : 0;
        canvas!.setAttribute(
          "aria-label",
          value ? "Vertical skateboard, red graphic facing forward." : interactiveLabel
        );
        if (value) {
          drag = null;
          if (document.activeElement === canvas) (canvas as HTMLCanvasElement).blur();
        }
      }

      function reset() {
        yaw = 0;
        pitch = 0;
        zoom = 1;
        targetProgress = 0;
        wake(true);
      }

      const onScroll = () => {
        targetProgress = readProgress();
        wake();
      };
      const onVisibility = () => {
        if (!document.hidden) wake();
      };
      const onDblClick = () => reset();
      const onWheel = (e: WheelEvent) => {
        if (!finished && e.shiftKey) {
          e.preventDefault();
          zoom = clamp(zoom * Math.exp(e.deltaY * 0.001), 0.4, 1.8);
        }
      };
      const onPointerDown = (e: PointerEvent) => {
        if (finished || e.button !== 0) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw, pitch, touch: e.pointerType === "touch" };
        if (!drag.touch) canvas!.setPointerCapture(e.pointerId);
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (drag.touch && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
          drag = null;
          return;
        }
        yaw = drag.yaw + dx * 0.006;
        if (!drag.touch) pitch = clamp(drag.pitch + dy * 0.005, -Math.PI, Math.PI);
      };
      const onPointerEnd = () => {
        drag = null;
      };
      const onKeyDown = (e: KeyboardEvent) => {
        let handled = true;
        switch (e.key) {
          case "ArrowLeft":
            yaw -= 0.15;
            break;
          case "ArrowRight":
            yaw += 0.15;
            break;
          case "ArrowUp":
            pitch -= 0.12;
            break;
          case "ArrowDown":
            pitch += 0.12;
            break;
          case "+":
          case "=":
            zoom = clamp(zoom * 0.86, 0.4, 1.8);
            break;
          case "-":
            zoom = clamp(zoom / 0.86, 0.4, 1.8);
            break;
          case "Home":
            reset();
            break;
          case "End":
            targetProgress = 1;
            wake(true);
            break;
          default:
            handled = false;
        }
        if (handled) e.preventDefault();
      };

      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("visibilitychange", onVisibility);
      canvas.addEventListener("dblclick", onDblClick);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
        canvas.addEventListener(type, onPointerEnd);
      }
      canvas.addEventListener("keydown", onKeyDown);

      function environment(renderer: any) {
        const s = new T.Scene();
        s.background = new T.Color(0x707475);
        s.add(
          new T.Mesh(
            new T.BoxGeometry(30, 24, 30),
            new T.MeshBasicMaterial({ color: 0x777b7d, side: T.BackSide })
          )
        );
        const panel = (w: number, h: number, pos: [number, number, number], intensity: number) => {
          const m = new T.Mesh(
            new T.PlaneGeometry(w, h),
            new T.MeshBasicMaterial({
              color: new T.Color().setRGB(intensity, intensity, intensity),
              side: T.DoubleSide,
            })
          );
          m.position.set(...pos);
          m.lookAt(0, 0, 0);
          s.add(m);
        };
        panel(12, 10, [0, 11, -3], 4);
        panel(5, 11, [-13, 1, 2], 2.4);
        panel(3, 12, [13, 2, -2], 4);
        panel(11, 4, [0, -1, 14], 1.6);
        const pmrem = new T.PMREMGenerator(renderer);
        const env = pmrem.fromScene(s, 0.04);
        pmrem.dispose();
        s.traverse((o: any) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
        return env.texture;
      }

      const context =
        canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "high-performance" }) ||
        canvas.getContext("webgl", { antialias: true, alpha: false });
      if (!context) {
        if (!cancelled) setFailure("WebGL isn't available. Enable hardware acceleration and reload.");
        return;
      }

      const renderer = new T.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;

      const scene = new T.Scene();
      // Visible backdrop only — independent of scene.environment below,
      // which is a separate baked reflection map built by environment()
      // from its own light studio scene. Changing this doesn't touch that,
      // so the metal parts keep the exact same specular reflections the
      // kit was tuned for.
      scene.background = new T.Color(0x0a0a0a);
      const envTexture = environment(renderer);
      scene.environment = envTexture;
      const camera = new T.PerspectiveCamera(37, 1, 0.1, 100);
      camera.position.z = 14;

      scene.add(new T.HemisphereLight(0xffffff, 0x61686b, 0.95));
      const key = new T.DirectionalLight(0xfff8ef, 2.6);
      key.position.set(-3, 7, 8);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 });
      key.shadow.normalBias = 0.007;
      key.shadow.bias = -0.00003;
      scene.add(key);
      const fill = new T.DirectionalLight(0xeaf1ff, 0.9);
      fill.position.set(5, -3, 6);
      scene.add(fill);
      const rim = new T.DirectionalLight(0xffffff, 1.5);
      rim.position.set(1, 4, -6);
      scene.add(rim);

      let model: any = null;
      let motion: any = null;
      let artworkTextures: any = null;

      let panAmount = 0;
      let disassemblyFraction = DISASSEMBLY_VH_DESKTOP / (DISASSEMBLY_VH_DESKTOP + REVEAL_VH_DESKTOP);
      let ro: ResizeObserver | null = null;
      const resize = () => {
        const r = stage.getBoundingClientRect();
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / Math.max(1, r.height);
        camera.updateProjectionMatrix();
        // Only pan the deck left to make room for the side panel on desktop —
        // on narrow screens there's no room for a side-by-side layout, so the
        // panel/speech bubble overlay centered instead (see globals.css).
        // Same breakpoint picks the matching (shorter, on mobile) scroll
        // track — .skateScroll's height in globals.css must track this.
        const isDesktop = r.width >= 768;
        panAmount = isDesktop ? 1.9 : 0;
        disassemblyFraction = isDesktop
          ? DISASSEMBLY_VH_DESKTOP / (DISASSEMBLY_VH_DESKTOP + REVEAL_VH_DESKTOP)
          : DISASSEMBLY_VH_MOBILE / (DISASSEMBLY_VH_MOBILE + REVEAL_VH_MOBILE);
        targetProgress = readProgress();
        wake(true);
      };

      const onContextLost = (e: Event) => {
        e.preventDefault();
        cancelAnimationFrame(frame);
        setFailure("Graphics connection was lost. Reload the page.");
      };
      canvas.addEventListener("webglcontextlost", onContextLost);

      disposers.push(() => {
        removeEventListener("scroll", onScroll);
        removeEventListener("visibilitychange", onVisibility);
        canvas.removeEventListener("dblclick", onDblClick);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
          canvas.removeEventListener(type, onPointerEnd);
        }
        canvas.removeEventListener("keydown", onKeyDown);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        ro?.disconnect();
        cancelAnimationFrame(frame);
        disposed = true;

        const disposedSet = new Set<any>();
        const disposeOne = (obj: any) => {
          if (!obj || disposedSet.has(obj)) return;
          disposedSet.add(obj);
          obj.dispose?.();
        };
        scene.traverse((o: any) => {
          disposeOne(o.geometry);
          const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
          for (const m of mats) {
            for (const key of Object.keys(m)) {
              const v = (m as any)[key];
              if (v && v.isTexture) disposeOne(v);
            }
            disposeOne(m);
          }
        });
        if (model?.root) scene.remove(model.root);
        disposeOne(envTexture);
        if (artworkTextures) {
          disposeOne(artworkTextures.gripMap);
          disposeOne(artworkTextures.gripSurfaceMap);
          disposeOne(artworkTextures.graphicMap);
        }
        renderer.dispose();
        renderer.forceContextLoss?.();
      });

      let tilt = -1.08;
      function animate(now: number) {
        frame = 0;
        if (disposed) return;
        if (document.hidden) {
          lastTime = now;
          frame = requestAnimationFrame(animate);
          return;
        }
        const dt = Math.min(0.05, Math.max(0.001, (now - (lastTime || now - 16)) / 1000));
        lastTime = now;
        const damping = reduced ? 1 : 1 - Math.exp(-dt * 8);
        progress += (targetProgress - progress) * damping;
        if (Math.abs(targetProgress - progress) < 0.00001) progress = targetProgress;
        zoomActual += (zoom - zoomActual) * damping;
        tilt += (-1.08 - tilt) * damping;

        // progress (0-1) spans the WHOLE track (disassembly + reveal). Map it
        // back down to the disassembly cinematic's own 0-1 range — unchanged
        // choreography, just fed a clamped sub-range instead of the raw value
        // — then derive how far into the reveal (pan + panel/speech) we are.
        const discProgress = clamp(progress / disassemblyFraction, 0, 1);
        const revealRaw = clamp((progress - disassemblyFraction) / (1 - disassemblyFraction), 0, 1);
        const revealProgress = revealRaw * revealRaw * (3 - 2 * revealRaw); // smoothstep

        motion.update(discProgress, { tilt, pitch, yaw, zoom: zoomActual, reducedMotion: reduced });
        if (model?.root) model.root.position.x = -panAmount * revealProgress;
        renderer.render(scene, camera);
        setFinished(progress === 1 && targetProgress === 1);
        if (promptRef.current) promptRef.current.style.opacity = progress < 0.02 ? "1" : "0";

        if (panelRef.current) {
          const p = clamp(revealProgress / 0.55, 0, 1);
          panelRef.current.style.opacity = String(p);
          panelRef.current.style.transform = `translateY(${(1 - p) * 16}px)`;
          panelRef.current.style.pointerEvents = p > 0.5 ? "auto" : "none";
        }
        if (speechRef.current) {
          const p = clamp((revealProgress - 0.5) / 0.5, 0, 1);
          speechRef.current.style.opacity = String(p);
          speechRef.current.style.transform = `translateY(${(1 - p) * 16}px)`;
          speechRef.current.style.pointerEvents = p > 0.5 ? "auto" : "none";
        }

        if (!finished) frame = requestAnimationFrame(animate);
      }
      wake = (force = false) => {
        if (disposed) return;
        if (!frame && (force || targetProgress < 1 || !finished)) {
          lastTime = 0;
          frame = requestAnimationFrame(animate);
        }
      };

      let artwork;
      try {
        artwork = await loadSkateArtwork(T);
      } catch (err) {
        if (cancelled || disposed) return;
        setFailure("Couldn't load the artwork.");
        console.error("[skate] artwork failed", err);
        return;
      }
      if (cancelled || disposed) {
        // Unmounted while textures were loading — dispose what just arrived.
        artwork.gripMap?.dispose?.();
        artwork.gripSurfaceMap?.dispose?.();
        artwork.graphicMap?.dispose?.();
        return;
      }
      artworkTextures = artwork;
      model = createSkateboard(T, artwork);
      scene.add(model.root);
      motion = createCinematicMotion(T, model, camera);

      ro = new ResizeObserver(resize);
      ro.observe(stage);
      resize();

      targetProgress = readProgress();
      progress = targetProgress;
      renderer.compile(scene, camera);
      animate(performance.now());
    })();

    return () => {
      cancelled = true;
      for (const dispose of disposers) dispose();
    };
  }, []);

  return (
    <section ref={sectionRef} className="skateScroll" aria-label="Skateboard animation">
      <div ref={stageRef} className="skateStage">
        {failure ? (
          <p className="skateFailure" role="alert">
            {failure}
          </p>
        ) : (
          <canvas
            ref={canvasRef}
            tabIndex={0}
            aria-label="Interactive 3D skateboard. Scroll to disassemble and reveal the shape. Drag to rotate. Shift + scroll or +/- to zoom. Double click to reset."
          />
        )}
        {!failure && (
          <div ref={promptRef} className="scrollPrompt" aria-hidden="true">
            <span className="scrollPromptText">Scroll ↓</span>
          </div>
        )}

        {!failure && (
          // Grouped only so mobile can stack speech-bubble + avatar directly
          // on top of the panel with no gap between them (see .stageBottomGroup
          // in globals.css) — on desktop the group is a no-op (display:contents)
          // and each child keeps its own independent absolute position.
          <div className="stageBottomGroup">
            <div ref={speechRef} className="stageSpeech">
              <div className="speechBubble">
                <p className="speechName">Vlad</p>
                <p className="speechText">If you buy my board you can puff my joints.</p>
              </div>
              <div className="speechAvatar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/vlad-head.png" alt="Vlad" width={460} height={520} />
              </div>
            </div>

            <div ref={panelRef} className="stagePanel">
              <p className="eyebrow">SoMa</p>
              <h1 className="headline pixel headlineLong">Shape SoMa Leo.MKV Server</h1>
              <div className="priceBlock">
                <p className="priceNow">{currency === "USD" ? PRICE_USD : PRICE_BRL}</p>
                <p className="priceInstallments">
                  or 6x of{" "}
                  <span className="priceHighlight">
                    {currency === "USD" ? INSTALLMENT_USD : INSTALLMENT_BRL}
                  </span>{" "}
                  interest-free
                </p>
              </div>
              <a
                className="ctaButton"
                href="https://somaskatearte.com/products/shape-soma-leo-mkv"
                target="_blank"
                rel="noopener noreferrer"
              >
                Buy now →
              </a>
              <ul className="specList">
                {SPECS.map((spec) => (
                  <li key={spec}>{spec}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
