import { useEffect, useMemo, useRef } from "react";

type Blob = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: { r: number; g: number; b: number; a: number };
};

type Dust = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number; // speed factor
  c: { r: number; g: number; b: number; a: number };
};

function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${a})`;
}

export function AuroraScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dustCanvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const blobs = useMemo<Blob[]>(() => {
    const palette = [
      { r: 74, g: 222, b: 128, a: 0.16 }, // mint
      { r: 56, g: 189, b: 248, a: 0.16 }, // cyan
      { r: 167, g: 139, b: 250, a: 0.14 }, // lilac
      { r: 251, g: 191, b: 36, a: 0.10 }, // amber
      { r: 244, g: 114, b: 182, a: 0.10 }, // rose
    ];

    return palette.map((c) => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() * 0.12 + 0.05) * (Math.random() < 0.5 ? -1 : 1),
      vy: (Math.random() * 0.12 + 0.05) * (Math.random() < 0.5 ? -1 : 1),
      r: Math.random() * 0.18 + 0.22,
      c,
    }));
  }, []);

  const dust = useMemo<Dust[]>(() => {
    const palette = [
      { r: 74, g: 222, b: 128, a: 0.12 }, // mint
      { r: 56, g: 189, b: 248, a: 0.12 }, // cyan
      { r: 167, g: 139, b: 250, a: 0.11 }, // lilac
      { r: 251, g: 191, b: 36, a: 0.09 }, // amber
    ];

    const count = 110; // calm, lightweight
    return Array.from({ length: count }).map((_, i) => {
      const c = palette[i % palette.length];
      return {
        x: Math.random(),
        y: Math.random(),
        vx: 0,
        vy: 0,
        s: Math.random() * 0.9 + 0.6,
        c,
      };
    });
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    const root = rootRef.current;
    const canvas = canvasRef.current;
    const dustCanvas = dustCanvasRef.current;
    const glow = glowRef.current;
    if (!root || !canvas || !dustCanvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    const dctx = dustCanvas.getContext("2d", { alpha: true });
    if (!ctx || !dctx) return;

    const state = {
      w: 0,
      h: 0,
      dpr: Math.min(1.6, window.devicePixelRatio || 1),
      t: 0,
      tx: window.innerWidth * 0.5,
      ty: window.innerHeight * 0.25,
      cx: window.innerWidth * 0.5,
      cy: window.innerHeight * 0.25,
      running: true,
    };

    const isDark = () => document.documentElement.classList.contains("dark");

    const resize = () => {
      state.w = window.innerWidth;
      state.h = window.innerHeight;

      canvas.width = Math.floor(state.w * state.dpr);
      canvas.height = Math.floor(state.h * state.dpr);
      dustCanvas.width = Math.floor(state.w * state.dpr);
      dustCanvas.height = Math.floor(state.h * state.dpr);

      // draw in CSS pixels
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      dctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    };

    const onPointerMove = (e: PointerEvent) => {
      state.tx = e.clientX;
      state.ty = e.clientY;
    };

    const tick = () => {
      if (!state.running) return;

      // Smooth cursor follow
      state.cx += (state.tx - state.cx) * 0.12;
      state.cy += (state.ty - state.cy) * 0.12;

      if (state.w > 0 && state.h > 0) {
        root.style.setProperty("--sx", (state.cx / state.w) * 100 + "%");
        root.style.setProperty("--sy", (state.cy / state.h) * 100 + "%");
      }

      if (glow && !reduceMotion && !coarse) {
        glow.style.transform = `translate3d(${state.cx - 210}px, ${state.cy - 210}px, 0)`;
      }

      // ---- Aurora canvas
      state.t += 0.0015;
      ctx.clearRect(0, 0, state.w, state.h);

      if (isDark()) {
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(0, 0, state.w, state.h);
      }

      ctx.save();
      ctx.globalCompositeOperation = isDark() ? "screen" : "multiply";

      for (const b of blobs) {
        b.x += b.vx / 1200;
        b.y += b.vy / 1200;
        if (b.x < -0.1 || b.x > 1.1) b.vx *= -1;
        if (b.y < -0.1 || b.y > 1.1) b.vy *= -1;

        const px = b.x * state.w;
        const py = b.y * state.h;

        const R =
          Math.min(state.w, state.h) *
          b.r *
          (1 + Math.sin(state.t * 6 + px * 0.0003) * 0.04);

        const a = isDark() ? b.c.a * 0.65 : b.c.a;
        const shift = (Math.sin(state.t * 8 + b.x * 2) * 0.5 + 0.5) * 0.08;

        const g = ctx.createRadialGradient(px, py, R * 0.18, px, py, R);
        g.addColorStop(0, rgba(b.c.r, b.c.g, b.c.b, a + shift));
        g.addColorStop(0.55, rgba(b.c.r, b.c.g, b.c.b, a * 0.35));
        g.addColorStop(1, rgba(b.c.r, b.c.g, b.c.b, 0));

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, R, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // ---- Dust canvas (calm flow field)
      dctx.clearRect(0, 0, state.w, state.h);
      dctx.save();
      dctx.globalCompositeOperation = isDark() ? "screen" : "source-over";

      const time = state.t * 140; // scaled
      for (let i = 0; i < dust.length; i++) {
        const p = dust[i];

        // flow field angle (cheap "noise-like" field)
        const fx = p.x * 6 + time * 0.002;
        const fy = p.y * 7 - time * 0.0016;
        const ang = (Math.sin(fx) + Math.cos(fy)) * Math.PI;

        // accelerate gently
        p.vx += Math.cos(ang) * 0.010 * p.s;
        p.vy += Math.sin(ang) * 0.010 * p.s;

        // damp
        p.vx *= 0.92;
        p.vy *= 0.92;

        // move (in normalized space)
        p.x += (p.vx / state.w) * 90;
        p.y += (p.vy / state.h) * 90;

        // wrap around
        if (p.x < 0) p.x += 1;
        if (p.x > 1) p.x -= 1;
        if (p.y < 0) p.y += 1;
        if (p.y > 1) p.y -= 1;

        const x = p.x * state.w;
        const y = p.y * state.h;

        const a = isDark() ? p.c.a * 0.55 : p.c.a * 0.40;
        dctx.fillStyle = rgba(p.c.r, p.c.g, p.c.b, a);
        dctx.beginPath();
        dctx.arc(x, y, 1.35, 0, Math.PI * 2);
        dctx.fill();
      }

      dctx.restore();

      if (state.running) requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);

    if (!reduceMotion && !coarse) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    }

    if (!reduceMotion) {
      const onVis = () => {
        const visible = document.visibilityState !== "hidden";
        if (!visible) {
          state.running = false;
          return;
        }
        if (visible && !state.running) {
          state.running = true;
          requestAnimationFrame(tick);
        }
      };

      document.addEventListener("visibilitychange", onVis);

      requestAnimationFrame(tick);

      // cleanup hook
      (state as any).__lnOnVis = onVis;
    }

    return () => {
      state.running = false;
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      const onVis = (state as any).__lnOnVis as ((() => void) | undefined);
      if (onVis) document.removeEventListener("visibilitychange", onVis);
    };
  }, [blobs, dust]);

  return (
    <div ref={rootRef} className="auroraScene" aria-hidden="true">
      <canvas ref={canvasRef} className="auroraCanvas" />
      <canvas ref={dustCanvasRef} className="dustCanvas" />
      <div className="auroraMesh" />
      <div className="auroraGrid" />
      <div className="auroraNoise" />
      <div className="auroraScan" />
      <div className="auroraSpotlight" />
      <div ref={glowRef} className="auroraGlow" />
    </div>
  );
}



