import React, { useEffect, useRef } from 'react';

export function CursorFX() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    
    if (isReducedMotion || isTouchDevice) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const update = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      
      const root = document.documentElement;
      
      // Update spotlight position natively (fast)
      root.style.setProperty('--sx', `${targetX}px`);
      root.style.setProperty('--sy', `${targetY}px`);

      if (glowRef.current) {
        // -210 offsets half of the 420px width/height defined in CSS
        glowRef.current.style.transform = `translate3d(${currentX - 210}px, ${currentY - 210}px, 0)`;
      }

      animationFrameId = requestAnimationFrame(update);
    };

    update();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Return null if touch or reduced motion
  if (typeof window !== "undefined" && 
      (window.matchMedia("(prefers-reduced-motion: reduce)").matches || 
       window.matchMedia("(pointer: coarse)").matches)) {
    return null;
  }

  return (
    <>
      <div className="ln-spotlight" />
      <div ref={glowRef} className="ln-cursorGlow" />
    </>
  );
}
