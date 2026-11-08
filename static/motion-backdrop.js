(() => {
  const init = () => {
    if (document.querySelector("[data-metavis-motion-backdrop]")) return;

    const host = document.querySelector(".hero") || document.body;
    const isHero = host !== document.body;
    const canvas = document.createElement("canvas");
    canvas.dataset.metavisMotionBackdrop = "true";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: isHero ? "absolute" : "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "0",
      opacity: isHero ? "0.34" : "0.30",
      mixBlendMode: "multiply"
    });
    host.insertBefore(canvas, host.firstChild);
    host.classList.add("metavis-motion-host");

    const ctx = canvas.getContext("2d", {alpha: true});
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const accent = [138, 90, 56];
    const pointer = {x: .5, y: .5, tx: .5, ty: .5};
    const lights = [
      {x: .19, y: .18, radius: .30, speed: .00010, phase: .6},
      {x: .81, y: .34, radius: .36, speed: .000075, phase: 2.2},
      {x: .46, y: .88, radius: .30, speed: .00009, phase: 4.4}
    ];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let specks = [];

    const measure = () => {
      if (isHero) {
        const rect = host.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
      } else {
        width = window.innerWidth;
        height = window.innerHeight;
      }
    };

    const resize = () => {
      measure();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      specks = Array.from({
        length: Math.max(30, Math.min(72, Math.floor(width * height / 28000)))
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
        gradient.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",.065)");
        gradient.addColorStop(.43, "rgba(" + r + "," + g + "," + b + ",.018)");
        gradient.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate((pointer.x - .5) * 12, (pointer.y - .5) * 8);
      const bandCount = Math.max(8, Math.min(16, Math.round(height / 88)));
      for (let band = 0; band < bandCount; band += 1) {
        const baseY = height * (.08 + band / Math.max(1, bandCount - 1) * .84);
        const amplitude = Math.max(8, height * .018) + (band % 3) * 3;
        const phase = band * .72;
        ctx.beginPath();
        for (let x = -80; x <= width + 80; x += 68) {
          const wave = Math.sin(x * .0042 + t * .00018 + phase) * amplitude
            + Math.cos(x * .0019 - t * .00012 + phase * 1.7) * amplitude * .55;
          const y = baseY + wave;
          if (x === -80) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const alpha = .011 + (band % 4) * .003;
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
    if (isHero && window.ResizeObserver) {
      new ResizeObserver(resize).observe(host);
    }
    window.addEventListener("pointermove", (event) => {
      const rect = isHero ? host.getBoundingClientRect() : {left: 0, top: 0};
      pointer.tx = (event.clientX - rect.left) / Math.max(width, 1);
      pointer.ty = (event.clientY - rect.top) / Math.max(height, 1);
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