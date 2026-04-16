import { useEffect } from "react";

export function useRevealOnScroll() {
  useEffect(() => {
    const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    
    const elements = document.querySelectorAll('.reveal');
    if (isReducedMotion) {
      elements.forEach(el => el.classList.add('on'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('on');
          // Optionally stop observing once revealed
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    });

    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}
