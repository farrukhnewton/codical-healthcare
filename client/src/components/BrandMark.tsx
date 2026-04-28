type BrandMarkProps = {
  compact?: boolean;
  className?: string;
};

const BARS = [
  { color: "#f47a45", height: 15 },
  { color: "#081db8", height: 28 },
  { color: "#f47a45", height: 22 },
  { color: "#f6b64b", height: 34 },
  { color: "#081db8", height: 18 },
];

export function BrandMark({ compact = false, className = "" }: BrandMarkProps) {
  return (
    <div className={`co-brand ${className}`}>
      <div className="co-logo-bars" aria-hidden="true">
        {BARS.map((bar, index) => (
          <span
            key={index}
            style={{ backgroundColor: bar.color, height: `${bar.height}px` }}
          />
        ))}
      </div>
      {!compact && (
        <div className="co-wordmark">
          <span>CODICAL</span>
          <small>Health</small>
        </div>
      )}
    </div>
  );
}
