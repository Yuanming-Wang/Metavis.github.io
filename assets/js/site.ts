type SiteSection = "research" | "writing" | "position";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const revealSections = (): void => {
  const sections = Array.from(document.querySelectorAll<HTMLElement>(".home-section"));
  if (reducedMotion || !("IntersectionObserver" in window)) {
    sections.forEach((section) => section.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -40px" }
  );

  sections.forEach((section) => observer.observe(section));
};

const syncResearchHash = (): void => {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  if (!hash) return;
  const target = document.getElementById(hash);
  if (!target) return;
  target.classList.add("hash-focus");
  window.setTimeout(() => target.classList.remove("hash-focus"), 1400);
};

const setCurrentMenuItem = (): void => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("#menu a"));
  links.forEach((link) => {
    const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/+$/, "") || "/";
    if (linkPath === path) link.classList.add("active");
  });
};

const wireResearchHover = (): void => {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".research-card"));
  cards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const bounds = card.getBoundingClientRect();
      card.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
      card.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
    });
  });
};

const markSiteReady = (): void => {
  document.documentElement.dataset.siteReady = "true";
};

const boot = (): void => {
  // Keep the public site deliberately quiet: TypeScript only owns small stateful touches.
  const sectionNames: SiteSection[] = ["research", "writing", "position"];
  void sectionNames;
  revealSections();
  setCurrentMenuItem();
  wireResearchHover();
  syncResearchHash();
  window.addEventListener("hashchange", syncResearchHash);
  markSiteReady();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
