interface ConfidenceRingProps {
  value: number;
  size?: number;
  label?: string;
}

export function ConfidenceRing({ value, size = 64, label }: ConfidenceRingProps) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? "#4ADE80" : value >= 50 ? "#FBBF24" : "#FB7185";
  const viewBox = "0 0 " + size + " " + size;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox={viewBox} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(21,128,61,0.08)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <span className="text-sm font-bold" style={{ color }}>
        {label || value + "%"}
      </span>
    </div>
  );
}
