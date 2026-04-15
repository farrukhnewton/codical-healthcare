import { motion } from "framer-motion";

export function SplashScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center nature-bg-living">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex items-end gap-2 h-12">
          {[
            { c: "#E8541A", h: 24 },
            { c: "#C43B0E", h: 32 },
            { c: "#1B2F6E", h: 40 },
            { c: "#F0A500", h: 32 },
            { c: "#E8541A", h: 24 },
          ].map((bar, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: bar.h }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="w-3 rounded-md"
              style={{ backgroundColor: bar.c }}
            />
          ))}
        </div>
        <div className="text-center">
          <h1 className="text-xl font-black text-gray-900 tracking-wider">CODICAL HEALTH</h1>
          <p className="text-xs font-bold text-emerald-600 tracking-widest mt-1">LOADING</p>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
