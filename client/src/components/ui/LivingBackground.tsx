export function LivingBackground() {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden nature-bg-living">
      {/* Morphing blobs */}
      <div
        className="absolute rounded-full"
        style={{
          width: "600px",
          height: "600px",
          top: "-200px",
          left: "-150px",
          background: "linear-gradient(135deg, rgba(186,230,253,0.5), rgba(134,239,172,0.25))",
          filter: "blur(80px)",
          opacity: 0.5,
          animation: "morphBlob 25s ease-in-out infinite, floatSlow 10s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: "500px",
          height: "500px",
          bottom: "-150px",
          right: "-100px",
          background: "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(244,114,182,0.15))",
          filter: "blur(80px)",
          opacity: 0.4,
          animation: "morphBlob 30s ease-in-out 5s infinite, floatSlow 12s ease-in-out 3s infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: "400px",
          height: "400px",
          top: "40%",
          left: "50%",
          background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,146,60,0.1))",
          filter: "blur(80px)",
          opacity: 0.35,
          animation: "morphBlob 22s ease-in-out 10s infinite, floatSlow 14s ease-in-out 6s infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: "350px",
          height: "350px",
          top: "20%",
          right: "20%",
          background: "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(74,222,128,0.1))",
          filter: "blur(80px)",
          opacity: 0.3,
          animation: "morphBlob 28s ease-in-out 15s infinite, floatSlow 11s ease-in-out 4s infinite",
        }}
      />

      {/* Floating particles */}
      <div className="fixed pointer-events-none z-[-1] rounded-full" style={{left: "10%", width: "3px", height: "3px", background: "rgba(74,222,128,0.4)", opacity: 0, animation: "leafDrift 18s linear 0s infinite"}} />
      <div className="fixed pointer-events-none z-[-1] rounded-full" style={{left: "25%", width: "4px", height: "4px", background: "rgba(56,189,248,0.3)", opacity: 0, animation: "leafDrift 20s linear 3s infinite"}} />
      <div className="fixed pointer-events-none z-[-1] rounded-full" style={{left: "45%", width: "5px", height: "5px", background: "rgba(167,139,250,0.3)", opacity: 0, animation: "leafDrift 22s linear 6s infinite"}} />
      <div className="fixed pointer-events-none z-[-1] rounded-full" style={{left: "65%", width: "3px", height: "3px", background: "rgba(251,191,36,0.3)", opacity: 0, animation: "leafDrift 24s linear 9s infinite"}} />
      <div className="fixed pointer-events-none z-[-1] rounded-full" style={{left: "80%", width: "4px", height: "4px", background: "rgba(244,114,182,0.3)", opacity: 0, animation: "leafDrift 26s linear 12s infinite"}} />
      <div className="fixed pointer-events-none z-[-1] rounded-full" style={{left: "90%", width: "5px", height: "5px", background: "rgba(74,222,128,0.3)", opacity: 0, animation: "leafDrift 28s linear 15s infinite"}} />
    </div>
  );
}
