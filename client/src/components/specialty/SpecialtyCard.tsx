import { Link } from "wouter";

export type SpecialtyCardProps = {
  title: string;
  color: string;
  href: string;
  isActive: boolean;
  imageUrl?: string;
};

export function SpecialtyCard({
  title,
  color,
  href,
  isActive,
  imageUrl,
}: SpecialtyCardProps) {
  const className = `specialty-card${isActive ? "" : " coming-soon"}`;
  const content = (
    <>
      {imageUrl ? <img src={imageUrl} alt="" loading="lazy" decoding="async" /> : <span className="specialty-card-placeholder" aria-hidden="true" />}
      <h3>{title}</h3>
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
