import { useEffect } from "react";

export function useLandingReveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".landingAurora");
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("header, section, footer, [data-reveal]")
    );

    const prepareStagger = (el: HTMLElement) => {
      const grids = Array.from(el.querySelectorAll<HTMLElement>(".grid"));
      grids.forEach((grid) => {
        if (grid.dataset.staggered === "1") return;
        grid.dataset.staggered = "1";
        grid.classList.add("ln-stagger");

        const children = Array.from(grid.children) as HTMLElement[];
        children.forEach((child, idx) => {
          child.classList.add("ln-reveal");
          child.classList.remove("ln-in");
          child.style.setProperty("--i", String(idx));
        });
      });
    };

    if (reduceMotion) {
      targets.forEach((el) => {
        el.classList.add("ln-reveal", "ln-in");
        prepareStagger(el);
        el.querySelectorAll<HTMLElement>(".ln-reveal").forEach((child) => child.classList.add("ln-in"));
      });
      return;
    }

    // Prepare all targets hidden first
    targets.forEach((el) => {
      el.classList.add("ln-reveal");
      el.classList.remove("ln-in");
      prepareStagger(el);
    });

    const revealElement = (el: HTMLElement) => {
      // Ensure we animate: hidden state must paint before ln-in is added
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.add("ln-in");

          const grids = Array.from(el.querySelectorAll<HTMLElement>(".grid.ln-stagger"));
          grids.forEach((grid) => {
            const children = Array.from(grid.children) as HTMLElement[];
            children.forEach((child) => child.classList.add("ln-in"));
          });
        });
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          revealElement(el);
          io.unobserve(el);
        }
      },
      { threshold: 0.14 }
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
}
