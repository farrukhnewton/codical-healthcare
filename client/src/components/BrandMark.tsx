import "@/styles/brand-system.css";

type BrandMarkProps = {
  compact?: boolean;
  animated?: boolean;
  tagline?: boolean;
  inverse?: boolean;
  className?: string;
};

export function BrandMark({
  compact = false,
  animated = false,
  tagline = false,
  inverse = false,
  className = "",
}: BrandMarkProps) {
  return (
    <div className={`co-brand codical-brand-v2${inverse ? " is-inverse" : ""} ${className}`.trim()}>
      <div className="co-logo-bars" aria-hidden="true">
        <img
          className="co-logo-asset"
          src={animated ? "/assets/brand/codical-bars-animated-web.gif" : "/assets/brand/codical-bars-static-web.png"}
          alt=""
          decoding="async"
        />
      </div>
      {!compact && (
        <div className="co-wordmark">
          <span>CODICAL</span>
          <small>HEALTH</small>
          {tagline ? <em>Precision in coding, power in revenue</em> : null}
        </div>
      )}
    </div>
  );
}
