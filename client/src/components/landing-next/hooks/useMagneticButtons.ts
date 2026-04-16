import { useEffect } from "react";

export function useMagneticButtons() {
  useEffect(() => {
    const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    
    if (isReducedMotion || isTouchDevice) return;

    const magnetics = document.querySelectorAll('.magnetic');
    
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      // Move slightly towards cursor
      target.style.setProperty('--mx', `${x * 0.3}px`);
      target.style.setProperty('--my', `${y * 0.3}px`);
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      target.style.setProperty('--mx', `0px`);
      target.style.setProperty('--my', `0px`);
    };

    magnetics.forEach(el => {
      (el as HTMLElement).addEventListener('mousemove', handleMouseMove);
      (el as HTMLElement).addEventListener('mouseleave', handleMouseLeave);
    });

    return () => {
      magnetics.forEach(el => {
        (el as HTMLElement).removeEventListener('mousemove', handleMouseMove);
        (el as HTMLElement).removeEventListener('mouseleave', handleMouseLeave);
      });
    };
  }, []);
}
