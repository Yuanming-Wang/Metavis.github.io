(() => {
  const init = () => {
    if (document.querySelector("[data-metavis-motion-backdrop]")) return;

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
      opacity: "0.44",
      mixBlendMode: "multiply"
    });
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext("2d", {alpha: true});
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const accent = [138, 90, 56];
    const pointer = {x: .5, y: .5, tx: .5, ty: .5};
    const lights = [
      {x: .18, y: .16, radius: .29, speed: .00010, phase: .6},
      {x: .78, y: .36, radius: .34, speed: .000075, phase: 2.2},
      {x: .46, y: .88, radius: .30, speed: .00009, phase: 4.4}
    ];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let specks = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      specks = Array.from({
        length: Math.max(28, Math.min(68, Math.floor(width * height / 30000)))
      }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - .5) * .028,
        vy: (Math.random() - .5) * .022,
        radius: .45 + Math.random() * 1.1,
        alpha: .05 + Math.random() * .08
      }));
    };

    const draw = (time) => {
      const t = reduced ? 0 : time;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      pointer.x += (pointer.tx - pointer.x) * .018;
      pointer.y += (pointer.ty - pointer.y) * .018;

      for (const light of lights) {
        const x = width * light.x
          + Math.sin(t * light.speed + light.phase) * width * .06
          + (pointer.x - .5) * 18;
        const y = height * light.y
          + Math.cos(t * light.speed * .82 + light.phase) * height * .05
          + (pointer.y - .5) * 12;
        const radius = Math.max(width, height) * light.radius;
        const [r, g, b] = accent;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",.095)");
        gradient.addColorStop(.43, "rgba(" + r + "," + g + "," + b + ",.028)");
        gradient.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate((pointer.x - .5) * 11, (pointer.y - .5) * 8);
      const bandCount = Math.max(9, Math.min(15, Math.round(height / 105)));
      for (let band = 0; band < bandCount; band += 1) {
        const baseY = height * (0.10 + band / Math.max(1, bandCount - 1) * .82);
        const amplitude = 8 + (band % 3) * 4;
        const phase = band * .72;
        ctx.beginPath();
        for (let x = -80; x <= width + 80; x += 72) {
          const wave = Math.sin(x * .0042 + t * .00018 + phase) * amplitude
            + Math.cos(x * .0019 - t * .00012 + phase * 1.7) * amplitude * .55;
          const y = baseY + wave;
          if (x === -80) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const alpha = .018 + (band % 4) * .006;
        ctx.strokeStyle = "rgba(138,90,56," + alpha + ")";
        ctx.lineWidth = band % 4 === 0 ? 1.35 : .8;
        ctx.stroke();
      }
      ctx.restore();

      if (!reduced) {
        for (const speck of specks) {
          speck.x += speck.vx;
          speck.y += speck.vy;
          if (speck.x < -12) speck.x = width + 12;
          if (speck.x > width + 12) speck.x = -12;
          if (speck.y < -12) speck.y = height + 12;
          if (speck.y > height + 12) speck.y = -12;
        }
      }

      for (const speck of specks) {
        ctx.fillStyle = "rgba(138,90,56," + speck.alpha + ")";
        ctx.beginPath();
        ctx.arc(speck.x, speck.y, speck.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) window.requestAnimationFrame(draw);
    };

    window.addEventListener("resize", resize, {passive: true});
    window.addEventListener("pointermove", (event) => {
      pointer.tx = event.clientX / Math.max(window.innerWidth, 1);
      pointer.ty = event.clientY / Math.max(window.innerHeight, 1);
    }, {passive: true});
    resize();
    draw(0);
    if (!reduced) window.requestAnimationFrame(draw);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {once: true});
  } else {
    init();
  }
})();