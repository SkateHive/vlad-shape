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

export default function SkateScene() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

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
      scene.background = new T.Color(0xeceeed);
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

      let ro: ResizeObserver | null = null;
      const resize = () => {
        const r = stage.getBoundingClientRect();
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / Math.max(1, r.height);
        camera.updateProjectionMatrix();
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

        motion.update(progress, { tilt, pitch, yaw, zoom: zoomActual, reducedMotion: reduced });
        renderer.render(scene, camera);
        setFinished(progress === 1 && targetProgress === 1);
        if (promptRef.current) promptRef.current.style.opacity = progress < 0.02 ? "1" : "0";
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
      </div>
    </section>
  );
}
