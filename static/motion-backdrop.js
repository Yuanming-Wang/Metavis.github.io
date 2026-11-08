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
      opacity: "0.48",
      mixBlendMode: "multiply"
    });
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext("2d", {alpha: true});
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const accent = [138, 90, 56];
    const pointer = {x: .5, y: .5, tx: .5, ty: .5};
    const lights = [
      {x: .18, y: .18, radius: .28, speed: .00012, phase: .4},
      {x: .78, y: .32, radius: .34, speed: .00009, phase: 2.1},
      {x: .50, y: .86, radius: .30, speed: .00011, phase: 4.2}
    ];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      particles = Array.from({
        length: Math.max(42, Math.min(88, Math.floor(width * height / 24000)))
      }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - .5) * .035,
        vy: (Math.random() - .5) * .03,
        radius: .55 + Math.random() * 1.25,
        alpha: .06 + Math.random() * .10
      }));
    };

    const draw = (time) => {
      const t = reduced ? 0 : time;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      pointer.x += (pointer.tx - pointer.x) * .02;
      pointer.y += (pointer.ty - pointer.y) * .02;

      for (const light of lights) {
        const x = width * light.x
          + Math.sin(t * light.speed + light.phase) * width * .055
          + (pointer.x - .5) * 14;
        const y = height * light.y
          + Math.cos(t * light.speed * .8 + light.phase) * height * .045
          + (pointer.y - .5) * 10;
        const radius = Math.max(width, height) * light.radius;
        const [r, g, b] = accent;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",.10)");
        gradient.addColorStop(.45, "rgba(" + r + "," + g + "," + b + ",.035)");
        gradient.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) {
        for (const particle of particles) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < -16) particle.x = width + 16;
          if (particle.x > width + 16) particle.x = -16;
          if (particle.y < -16) particle.y = height + 16;
          if (particle.y > height + 16) particle.y = -16;
        }
      }

      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 116) {
            ctx.strokeStyle = "rgba(138,90,56," + ((1 - distance / 116) * .035) + ")";
            ctx.lineWidth = .6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const particle of particles) {
        ctx.fillStyle = "rgba(138,90,56," + particle.alpha + ")";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
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