(() => {
  const init = () => {
    if (document.querySelector("[data-metavis-motion-backdrop]")) return;

    const host = document.body;
    const canvas = document.createElement("canvas");
    canvas.dataset.metavisMotionBackdrop = "true";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "0",
      opacity: "0.22",
      mixBlendMode: "multiply"
    });
    host.insertBefore(canvas, host.firstChild);
    host.classList.add("metavis-motion-host");

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const accent = [139, 85, 55];
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let width = 1;
    let height = 1;
    let dpr = 1;
    let raf = 0;
    let lastFrame = 0;

    const measure = () => {
      width = window.innerWidth;
      height = window.innerHeight;
    };

    const resize = () => {
      measure();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      draw(0, true);
    };

    const draw = (time, force = false) => {
      if (!force && !reduced && time - lastFrame < 30) {
        raf = window.requestAnimationFrame(draw);
        return;
      }
      lastFrame = time;
      const t = reduced ? 0 : time;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      pointer.x += (pointer.tx - pointer.x) * 0.018;
      pointer.y += (pointer.ty - pointer.y) * 0.018;

      const cx = width * 0.72 + (pointer.x - 0.5) * 18;
      const cy = height * 0.48 + (pointer.y - 0.5) * 12;
      const [r, g, b] = accent;

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.72);
      glow.addColorStop(0, `rgba(${r},${g},${b},0.12)`);
      glow.addColorStop(0.42, `rgba(${r},${g},${b},0.045)`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(t * 0.000035) * 0.035);
      for (let i = 0; i < 10; i += 1) {
        const scale = 0.42 + i * 0.095;
        const rx = Math.max(width, height) * scale;
        const ry = rx * (0.42 + Math.sin(i * 0.38) * 0.025);
        const alpha = 0.046 - i * 0.0028;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 0.08, Math.PI * 1.92);
        ctx.strokeStyle = `rgba(${r},${g},${b},${Math.max(0.012, alpha)})`;
        ctx.lineWidth = i % 3 === 0 ? 1.1 : 0.72;
        ctx.stroke();
      }
      ctx.restore();

      const bands = 8;
      for (let band = 0; band < bands; band += 1) {
        const baseY = height * (0.12 + band / (bands - 1) * 0.76);
        const amplitude = Math.max(7, height * 0.014) + (band % 3) * 2;
        const phase = band * 0.66;
        ctx.beginPath();
        for (let x = -60; x <= width + 60; x += 34) {
          const nx = x / Math.max(width, 1);
          const wave = Math.sin(nx * 5.1 + t * 0.00011 + phase)
            * amplitude + Math.cos(nx * 2.7 - t * 0.000075 + phase * 1.4)
            * amplitude * 0.42;
          const y = baseY + wave + (pointer.y - 0.5) * 7;
          if (x === -60) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.022 + (band % 3) * 0.005})`;
        ctx.lineWidth = band % 3 === 0 ? 1 : 0.65;
        ctx.stroke();
      }

      if (!force && !reduced && document.visibilityState === "visible") {
        raf = window.requestAnimationFrame(draw);
      }
    };

    const onPointerMove = (event) => {
      const rect = { left: 0, top: 0 };
      pointer.tx = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(width, 1)));
      pointer.ty = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(height, 1)));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        window.cancelAnimationFrame(raf);
      } else if (!reduced) {
        raf = window.requestAnimationFrame(draw);
      }
    };

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    
    resize();
    if (!reduced) raf = window.requestAnimationFrame(draw);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
