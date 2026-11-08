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
      opacity: "0.76",
      mixBlendMode: "multiply"
    });
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext("2d", {alpha: true});
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const palette = [
      [229, 157, 119],
      [195, 185, 242],
      [147, 210, 202],
      [241, 207, 145]
    ];
    const pointer = {x: .5, y: .5, tx: .5, ty: .5};
    const lights = [
      {x: .16, y: .18, r: .26, speed: .00018, phase: .2, color: [229,157,119]},
      {x: .82, y: .22, r: .30, speed: .00014, phase: 1.8, color: [195,185,242]},
      {x: .58, y: .82, r: .32, speed: .00016, phase: 3.2, color: [147,210,202]},
      {x: .08, y: .84, r: .22, speed: .0002, phase: 4.1, color: [241,207,145]}
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
      particles = Array.from({length: Math.max(56, Math.min(120, Math.floor(width * height / 17000)))}, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - .5) * .09,
        vy: (Math.random() - .5) * .07,
        radius: .7 + Math.random() * 1.7,
        alpha: .08 + Math.random() * .16,
        color: palette[index % palette.length]
      }));
    };

    const draw = (time) => {
      const t = reduced ? 0 : time;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      pointer.x += (pointer.tx - pointer.x) * .025;
      pointer.y += (pointer.ty - pointer.y) * .025;

      for (const light of lights) {
        const orbitX = Math.sin(t * light.speed + light.phase) * width * .065;
        const orbitY = Math.cos(t * light.speed * .83 + light.phase) * height * .055;
        const x = width * light.x + orbitX + (pointer.x - .5) * 18;
        const y = height * light.y + orbitY + (pointer.y - .5) * 14;
        const radius = Math.max(width, height) * light.r;
        const [r, g, b] = light.color;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",.18)");
        gradient.addColorStop(.42, "rgba(" + r + "," + g + "," + b + ",.075)");
        gradient.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const particle of particles) {
        if (!reduced) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < -20) particle.x = width + 20;
          if (particle.x > width + 20) particle.x = -20;
          if (particle.y < -20) particle.y = height + 20;
          if (particle.y > height + 20) particle.y = -20;
        }
      }

      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 132) {
            ctx.strokeStyle = "rgba(70, 72, 68," + ((1 - distance / 132) * .055) + ")";
            ctx.lineWidth = .7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const particle of particles) {
        const [r, g, b] = particle.color;
        ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + particle.alpha + ")";
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