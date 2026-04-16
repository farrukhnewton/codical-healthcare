import React, { useEffect, useRef } from 'react';

export function AuroraCanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    
    // Check reduced motion
    const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Blobs setup
    const numBlobs = 5;
    const blobs = Array.from({ length: numBlobs }).map((_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: window.innerWidth * (0.3 + Math.random() * 0.2),
      colorBase: i % 2 === 0 ? '167, 243, 208' : '233, 213, 255', // Mint / Lilac variations
      darkColorBase: i % 2 === 0 ? '5, 150, 105' : '109, 40, 217' // Mint / Violet variations
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      
      blobs.forEach(b => b.radius = width * (0.3 + Math.random() * 0.2));
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains("dark");
      ctx.globalCompositeOperation = isDark ? "screen" : "source-over";

      blobs.forEach(blob => {
        // Update positions if not reduced motion
        if (!isReducedMotion) {
          blob.x += blob.vx;
          blob.y += blob.vy;

          if (blob.x < -blob.radius) blob.vx *= -1;
          if (blob.x > width + blob.radius) blob.vx *= -1;
          if (blob.y < -blob.radius) blob.vy *= -1;
          if (blob.y > height + blob.radius) blob.vy *= -1;
        }

        const gradient = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.radius);
        const rgb = isDark ? blob.darkColorBase : blob.colorBase;
        
        // Very soft opacity
        gradient.addColorStop(0, `rgba(${rgb}, 0.15)`);
        gradient.addColorStop(1, `rgba(${rgb}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      if (!isReducedMotion) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1
      }}
    />
  );
}
