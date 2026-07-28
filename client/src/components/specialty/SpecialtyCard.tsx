import { ArrowUpRight, Database, Lock, type LucideIcon } from "lucide-react";
import { Link } from "wouter";

export type SpecialtyCardProps = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  href: string;
  badge?: "new" | "beta" | "coming-soon";
  isActive: boolean;
  stats?: string;
  dataSources?: number;
};

export function SpecialtyCard({
  title,
  description,
  icon: Icon,
  color,
  href,
  badge,
  isActive,
  stats,
  dataSources,
}: SpecialtyCardProps) {
  const className = `specialty-card${isActive ? "" : " coming-soon"}`;
  const content = (
    <>
      <span className="specialty-card-accent" style={{ background: color }} />
      <div className="specialty-card-top">
        <span className="specialty-card-icon" style={{ color, borderColor: `${color}55`, background: `${color}18` }}>
          <Icon size={24} />
        </span>
        {badge ? <span className={`specialty-card-badge ${badge}`}>{badge === "coming-soon" ? "Coming soon" : badge}</span> : null}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="specialty-card-meta">
        <span><Database size={13} /> {dataSources || 0} data sources</span>
        <span>{stats || (isActive ? "Active" : "Planned")}</span>
      </div>
      <div className="specialty-card-action">
        {isActive ? (
          <>
            Open <ArrowUpRight size={15} />
          </>
        ) : (
          <>
            Locked <Lock size={14} />
          </>
        )}
      </div>
    </>
  );

  if (!isActive) {
    return (
      <article className={className} style={{ "--card-accent": color } as React.CSSProperties} aria-disabled="true">
        {content}
      </article>
    );
  }

  return (
    <Link href={href} className={className} style={{ "--card-accent": color } as React.CSSProperties}>
      {content}
    </Link>
  );
}
