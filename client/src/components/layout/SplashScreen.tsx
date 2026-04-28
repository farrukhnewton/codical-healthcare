import { motion } from "framer-motion";
import { BrandMark } from "@/components/BrandMark";

export function SplashScreen() {
  return (
    <div className="codical-intro-screen min-h-screen flex items-center justify-center overflow-hidden">
      <div className="codical-intro-grid" aria-hidden="true" />
      <div className="codical-intro-pulse codical-intro-pulse-a" aria-hidden="true" />
      <div className="codical-intro-pulse codical-intro-pulse-b" aria-hidden="true" />
      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-5"
      >
        <BrandMark className="co-brand-intro" />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0.78] }}
          transition={{ duration: 1.45, delay: 0.15, ease: "easeInOut" }}
          className="text-[12px] font-black uppercase tracking-[0.22em] text-[#081db8]"
        >
          Precision in coding, power in revenue
        </motion.p>
      </motion.div>
    </div>
  );
}
