import { useEffect } from "react";

export function useTilt() {
  useEffect(() => {
    const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    
    if (isReducedMotion || isTouchDevice) return;

    const elements = document.querySelectorAll('[data-tilt]');

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      
      // Relative mouse position
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Update variables for highlight/glow
      target.style.setProperty("--hx", `${x}px`);
      target.style.setProperty("--hy", `${y}px`);

      // Tilt math
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -5; // max 5deg
      const rotateY = ((x - centerX) / centerX) * 5;

      target.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      target.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
      target.style.setProperty("--hx", `50%`);
      target.style.setProperty("--hy", `50%`);
    };

    elements.forEach(el => {
      (el as HTMLElement).addEventListener('mousemove', handleMouseMove);
      (el as HTMLElement).addEventListener('mouseleave', handleMouseLeave);
      // Ensure smooth transition on leave/enter
      (el as HTMLElement).style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    });

    return () => {
      elements.forEach(el => {
        (el as HTMLElement).removeEventListener('mousemove', handleMouseMove);
        (el as HTMLElement).removeEventListener('mouseleave', handleMouseLeave);
      });
    };
  }, []);
}
