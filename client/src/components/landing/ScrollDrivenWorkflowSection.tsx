import creativeEyeballVideo from "@/assets/landing/creative-eyeball.mp4";
import { BrandMark } from "@/components/BrandMark";
import {
  motion,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  Calculator,
  MessageSquareText,
  Mic2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "wouter";

type CreativeShowcase = {
  id: string;
  label: string;
  icon: LucideIcon;
  caption: string;
  category: string;
  line: string;
  subline: string;
  proof: string;
  visual: "coding" | "transcription" | "calculator" | "chat";
};

const CREATIVE_SHOWCASES: CreativeShowcase[] = [
  {
    id: "coding",
    label: "AI Medical Coding",
    icon: Sparkles,
    caption: "Evidence-first coding",
    category: "CODING",
    line: "AI coding that keeps evidence visible.",
    subline: "Source-linked ICD, CPT, HCPCS and modifier suggestions stay connected to the claim.",
    proof: "98% confidence",
    visual: "coding",
  },
  {
    id: "transcription",
    label: "AI Transcription",
    icon: Mic2,
    caption: "Structured clinical audio",
    category: "AUDIO",
    line: "Transcription that turns speech into structure.",
    subline: "Encounter audio becomes usable notes, coding context and review-ready language.",
    proof: "01:24 transcript",
    visual: "transcription",
  },
  {
    id: "anesthesia",
    label: "Anesthesia Calculator",
    icon: Calculator,
    caption: "Payment logic in one view",
    category: "PAYMENT",
    line: "Anesthesia math that explains the payment.",
    subline: "Base units, time, modifiers and locality factors stay in one calculation view.",
    proof: "187.5 MME",
    visual: "calculator",
  },
  {
    id: "chat",
    label: "Team Chats",
    icon: MessageSquareText,
    caption: "Review decisions together",
    category: "TEAM",
    line: "Team review that stays attached to the case.",
    subline: "Coders, billers and reviewers resolve questions without leaving the workflow.",
    proof: "3 live reviewers",
    visual: "chat",
  },
];

const CREATIVE_SCATTER_LAYOUTS = [
  { x: -39, y: -20, r: -6, s: 0.92 },
  { x: -15, y: -27, r: 7, s: 0.82 },
  { x: 18, y: -24, r: -2, s: 0.88 },
  { x: 38, y: -17, r: 5, s: 0.86 },
  { x: -34, y: 18, r: 4, s: 0.84 },
  { x: -8, y: 25, r: -7, s: 0.86 },
  { x: 24, y: 22, r: 6, s: 0.84 },
  { x: 45, y: 28, r: -9, s: 0.8 },
];

function CreativeImagePanel({
  showcase,
  variant = "standard",
}: {
  showcase: CreativeShowcase;
  variant?: "standard" | "scatter" | "stack" | "sequence" | "ghost";
}) {
  const ToolIcon = showcase.icon;

  return (
    <figure className={`nex-portfolio-image is-${showcase.visual} is-${variant}`} aria-label={`${showcase.label} product visual`}>
      <div className="nex-portfolio-chrome">
        <span />
        <span />
        <span />
        <strong>{showcase.label}</strong>
      </div>
      <div className="nex-portfolio-body">
        <div className="nex-portfolio-badge">
          <ToolIcon size={16} />
          <span>{showcase.proof}</span>
        </div>

        {showcase.visual === "coding" && (
          <div className="nex-portfolio-coding">
            <BrandMark compact />
            <div className="nex-portfolio-mini-table">
              {[
                ["CH-83472", "J47.1", "98"],
                ["CH-83473", "E11.65", "96"],
                ["CH-83474", "K21.9", "97"],
              ].map(([chart, code, score]) => (
                <span key={chart}>
                  <b>{chart}</b>
                  <em>{code}</em>
                  <i>{score}%</i>
                </span>
              ))}
            </div>
            <div className="nex-portfolio-donut" aria-hidden="true" />
          </div>
        )}

        {showcase.visual === "transcription" && (
          <div className="nex-portfolio-transcription">
            <div className="nex-portfolio-wave" aria-hidden="true">
              {Array.from({ length: 34 }).map((_, index) => (
                <i key={index} style={{ animationDelay: `${index * 34}ms` }} />
              ))}
            </div>
            <p>Patient reports improved breathing. Assessment supports exacerbation coding with source language.</p>
            <strong>Structured note ready</strong>
          </div>
        )}

        {showcase.visual === "calculator" && (
          <div className="nex-portfolio-calculator">
            <strong>$824.91</strong>
            <span>17 units x locality factor</span>
            {[
              ["Base", "6"],
              ["Time", "6"],
              ["Modifier", "AA"],
              ["MME", "187.5"],
            ].map(([label, value]) => (
              <p key={label}>
                <em>{label}</em>
                <b>{value}</b>
              </p>
            ))}
          </div>
        )}

        {showcase.visual === "chat" && (
          <div className="nex-portfolio-chat">
            {[
              ["Coder", "Evidence accepted."],
              ["Billing", "Validator is clean."],
              ["Assistant", "Summary attached."],
            ].map(([sender, message], index) => (
              <p className={index === 1 ? "is-own" : ""} key={sender}>
                <strong>{sender}</strong>
                <span>{message}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

function CreativeFlowWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const parent = canvas?.parentElement;
    if (!canvas || !context || !parent) return;

    const layers: Array<[number, number, number, number]> = [
      [200, 79, 232, 0.1],
      [155, 63, 230, 0.07],
      [107, 125, 235, 0.05],
      [198, 201, 220, 0.03],
    ];
    let width = 0;
    let height = 0;
    let time = 0;
    let frameId = 0;
    let disposed = false;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawLayer = ([red, green, blue, alpha]: [number, number, number, number], layerIndex: number) => {
      const frequency = 0.003 + layerIndex * 0.001;
      const phase = layerIndex * 1.1;
      const amplitude = 45 + layerIndex * 10;
      const baseY = height * 0.5 + layerIndex * 20;

      context.beginPath();
      context.moveTo(0, height);
      for (let x = 0; x <= width; x += 3) {
        const y = baseY
          + Math.sin(x * frequency + time + phase) * amplitude
          + Math.sin(x * frequency * 2.2 + time * 1.3 + phase) * amplitude * 0.2;
        context.lineTo(x, y);
      }
      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = `rgba(${red},${green},${blue},${alpha})`;
      context.fill();

      if (layerIndex === 0) {
        context.beginPath();
        for (let x = 0; x <= width; x += 3) {
          const y = baseY
            + Math.sin(x * frequency + time + phase) * amplitude
            + Math.sin(x * frequency * 2.2 + time * 1.3 + phase) * amplitude * 0.2;
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = `rgba(${red},${green},${blue},0.22)`;
        context.lineWidth = 1.5;
        context.stroke();
      }
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      if (!prefersReducedMotion) time += 0.005;
      layers.forEach(drawLayer);
      if (!prefersReducedMotion && !disposed) frameId = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          resize();
          if (prefersReducedMotion) draw();
        })
      : null;
    resizeObserver?.observe(parent);

    return () => {
      disposed = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [prefersReducedMotion]);

  return (
    <div className="nex-creative-canvas-bg is-dark" aria-hidden="true">
      <canvas ref={canvasRef} className="nex-creative-flow-canvas" />
    </div>
  );
}

function CreativeScatterImage({ showcase, index, progress }: { showcase: CreativeShowcase; index: number; progress: MotionValue<number> }) {
  const layout = CREATIVE_SCATTER_LAYOUTS[index] ?? CREATIVE_SCATTER_LAYOUTS[0];
  const x = useTransform(progress, [0, 0.14, 0.23, 0.32], [`${layout.x}vw`, `${layout.x * 0.58}vw`, "0vw", "0vw"]);
  const y = useTransform(progress, [0, 0.14, 0.23, 0.32], [`${layout.y}vh`, `${layout.y * 0.5}vh`, "0vh", "0vh"]);
  const rotate = useTransform(progress, [0, 0.2, 0.3], [`${layout.r}deg`, `${layout.r * 0.32}deg`, "0deg"]);
  const scale = useTransform(progress, [0, 0.2, 0.32], [layout.s, 0.78, 0.58]);
  const opacity = useTransform(progress, [0, 0.18, 0.27, 0.35], [1, 1, 0.5, 0]);
  const filter = useTransform(progress, [0, 0.22, 0.34], ["blur(0px)", "blur(0px)", "blur(18px)"]);
  return (
    <motion.div className="nex-creative-scatter-item" style={{ x, y, rotate, scale, opacity, filter }}>
      <CreativeImagePanel showcase={showcase} variant="scatter" />
    </motion.div>
  );
}

function CreativeStackIntro({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.12, 0.2, 0.34, 0.41], [0, 1, 1, 0]);
  const scale = useTransform(progress, [0.12, 0.25, 0.41], [0.72, 1, 0.92]);
  const y = useTransform(progress, [0.12, 0.41], ["6vh", "-4vh"]);
  const textOpacity = useTransform(progress, [0.22, 0.29, 0.37], [0, 1, 0]);
  const textFilter = useTransform(progress, [0.22, 0.29, 0.37], ["blur(18px)", "blur(0px)", "blur(14px)"]);
  return (
    <motion.div className="nex-creative-stack-intro" style={{ opacity, scale, y }}>
      <CreativeImagePanel showcase={CREATIVE_SHOWCASES[0]} variant="stack" />
      <motion.h2 style={{ opacity: textOpacity, filter: textFilter }}>
        what moves <em>revenue</em> forward?
      </motion.h2>
    </motion.div>
  );
}

function CreativeEmptyPrompt({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.38, 0.44, 0.49, 0.54], [0, 1, 1, 0]);
  const filter = useTransform(progress, [0.38, 0.44, 0.54], ["blur(24px)", "blur(5px)", "blur(18px)"]);
  const x = useTransform(progress, [0.38, 0.5], ["7vw", "0vw"]);
  return (
    <motion.div className="nex-creative-empty-prompt" style={{ opacity, filter }}>
      <div className="nex-creative-category-ghosts" aria-hidden="true">
        {CREATIVE_SHOWCASES.map((showcase) => <span key={showcase.id}>{showcase.category}</span>)}
      </div>
      <motion.div className="nex-creative-empty-frame" style={{ x }} />
    </motion.div>
  );
}

function CreativeSequenceMoment({ showcase, index, progress }: { showcase: CreativeShowcase; index: number; progress: MotionValue<number> }) {
  const start = 0.49 + index * 0.09;
  const hold = start + 0.055;
  const end = start + 0.095;
  const opacity = useTransform(progress, [start - 0.035, start, hold, end], [0, 1, 1, 0]);
  const filter = useTransform(progress, [start - 0.035, start, hold, end], ["blur(26px)", "blur(0px)", "blur(0px)", "blur(18px)"]);
  const imageX = useTransform(progress, [start - 0.035, start, end], ["10vw", "0vw", "-4vw"]);
  const imageRotate = useTransform(progress, [start - 0.035, start, end], ["9deg", "-2deg", "4deg"]);
  const imageScale = useTransform(progress, [start - 0.035, start, end], [0.82, 1, 0.88]);
  return (
    <motion.article className="nex-creative-sequence-moment" style={{ opacity, filter }}>
      <div className="nex-creative-word-stack" aria-hidden="true">
        {CREATIVE_SHOWCASES.map((item) => <span className={item.id === showcase.id ? "is-active" : ""} key={item.id}>{item.category}</span>)}
      </div>
      <div className="nex-creative-sequence-copy">
        <small>{showcase.caption}</small>
        <h3>{showcase.line}</h3>
        <p>{showcase.subline}</p>
        <strong>{showcase.proof}</strong>
      </div>
      <motion.div className="nex-creative-sequence-image" style={{ x: imageX, rotate: imageRotate, scale: imageScale }}>
        <CreativeImagePanel showcase={showcase} variant="sequence" />
      </motion.div>
    </motion.article>
  );
}

function CreativeEyeFinale({ progress }: { progress: MotionValue<number> }) {
  const prefersReducedMotion = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 70, damping: 20, mass: 0.35 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 70, damping: 20, mass: 0.35 });
  const layerOpacity = useTransform(progress, [0.82, 0.855, 0.985, 1], [0, 1, 1, 0]);
  const cardScale = useTransform(progress, [0.84, 0.9, 0.965, 1], [0.85, 0.85, 2.5, 2.5]);
  const cardRotateY = useTransform(progress, [0.84, 0.89], ["15deg", "0deg"]);
  const cardOpacity = useTransform(progress, [0.9, 0.98, 1], [1, 0.15, 0.15]);
  const dissolveOpacity = useTransform(progress, [0.935, 0.988, 1], [0, 0.95, 0.98]);
  const captionOpacity = useTransform(progress, [0.845, 0.875, 0.94, 0.985], [0, 1, 0.78, 0]);
  const captionY = useTransform(progress, [0.845, 0.875, 0.985], ["30px", "0px", "-18px"]);
  const captionFilter = useTransform(progress, [0.845, 0.875, 0.985], ["blur(16px)", "blur(0px)", "blur(12px)"]);
  const parallaxX = useTransform(smoothMouseX, [-1, 1], prefersReducedMotion ? [0, 0] : [-10, 10]);
  const parallaxY = useTransform(smoothMouseY, [-1, 1], prefersReducedMotion ? [0, 0] : [-8, 8]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const handlePointerMove = (event: PointerEvent) => {
      mouseX.set((event.clientX / window.innerWidth - 0.5) * 2);
      mouseY.set((event.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [mouseX, mouseY, prefersReducedMotion]);

  return (
    <motion.div className="nex-creative-eye-scene" style={{ opacity: layerOpacity }}>
      <motion.div
        className="nex-creative-eye-video-wrap"
        style={{ scale: cardScale, rotateY: cardRotateY, x: parallaxX, y: parallaxY, opacity: cardOpacity }}
      >
        <div className="nex-creative-eye-card">
          <video
            src={creativeEyeballVideo}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="Animated eye with orbiting glass waves"
          />
          <motion.div className="nex-creative-eyeball-dissolve" style={{ opacity: dissolveOpacity }} aria-hidden="true" />
        </div>
      </motion.div>
      <motion.h3 className="nex-creative-eyeball-caption" style={{ opacity: captionOpacity, y: captionY, filter: captionFilter }}>
        Built around <em>forward</em> revenue momentum.
      </motion.h3>
      <motion.div className="nex-creative-eyeball-wash" style={{ opacity: dissolveOpacity }} aria-hidden="true" />
    </motion.div>
  );
}

function CreativeFinalCTA({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.97, 0.992, 1], [0, 1, 1]);
  const y = useTransform(progress, [0.97, 1], ["18vh", "0vh"]);
  const filter = useTransform(progress, [0.97, 0.992], ["blur(18px)", "blur(0px)"]);
  return (
    <motion.div className="nex-creative-final-cta" style={{ opacity, y, filter }}>
      <p>Unlimited coding clarity &amp; revenue-cycle follow-through</p>
      <strong>AI coding + transcription + anesthesia logic + attached team review</strong>
      <Link href="/signup">Free demo <ArrowRight size={16} /></Link>
    </motion.div>
  );
}

export function ScrollDrivenWorkflowSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const stageOpacity = useTransform(scrollYProgress, [0, 0.04, 0.98, 1], [0.94, 1, 1, 0.98]);

  return (
    <section className="nex-solutions nex-creative-tools" id="solutions" ref={sectionRef}>
      <motion.div className="nex-creative-sticky" style={{ opacity: stageOpacity }}>
        <div className="nex-creative-progress" aria-hidden="true">
          <motion.span style={{ scaleX: scrollYProgress }} />
        </div>
        <CreativeFlowWaveBackground />
        <div className="nex-creative-stage">
          <div className="nex-creative-scatter-field" aria-label="Codical Health tool visuals">
            {CREATIVE_SCATTER_LAYOUTS.map((_, index) => {
              const showcase = CREATIVE_SHOWCASES[index % CREATIVE_SHOWCASES.length];
              return <CreativeScatterImage key={`${showcase.id}-${index}`} showcase={showcase} index={index} progress={scrollYProgress} />;
            })}
          </div>
          <CreativeStackIntro progress={scrollYProgress} />
          <CreativeEmptyPrompt progress={scrollYProgress} />
          <div className="nex-creative-sequence-field">
            {CREATIVE_SHOWCASES.map((showcase, index) => (
              <CreativeSequenceMoment key={showcase.id} showcase={showcase} index={index} progress={scrollYProgress} />
            ))}
          </div>
          <CreativeEyeFinale progress={scrollYProgress} />
          <CreativeFinalCTA progress={scrollYProgress} />
        </div>
      </motion.div>
    </section>
  );
}
