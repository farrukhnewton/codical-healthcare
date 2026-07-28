import {
  Activity,
  Ambulance,
  Baby,
  Calculator,
  ChartNoAxesColumnIncreasing,
  Dna,
  Flame,
  FlaskConical,
  Heart,
  HeartPulse,
  Layers3,
  Pill,
  type LucideIcon,
} from "lucide-react";
import { SpecialtyCard } from "@/components/specialty/SpecialtyCard";
import { ACTIVE_SPECIALTY_MODULES, SPECIALTY_MODULES, type SpecialtyIconName } from "@shared/specialty-registry";

const SPECIALTY_ICONS: Record<SpecialtyIconName, LucideIcon> = {
  dna: Dna,
  flame: Flame,
  ambulance: Ambulance,
  "heart-pulse": HeartPulse,
  pill: Pill,
  calculator: Calculator,
  chart: ChartNoAxesColumnIncreasing,
  flask: FlaskConical,
  baby: Baby,
  activity: Activity,
  heart: Heart,
};

export function SpecialtyHub() {
  const dataSourceCount = ACTIVE_SPECIALTY_MODULES.reduce((total, module) => total + module.dataSources, 0);

  return (
    <div className="specialty-page specialty-hub-page">
      <header className="specialty-hero tool-panel">
        <div>
          <span className="specialty-eyebrow"><Layers3 size={14} /> Specialty workspace</span>
          <h1>Specialty Coding</h1>
          <p>Advanced coding engines for complex medical specialties, powered by curated knowledge bases, extraction workflows, and billing logic.</p>
        </div>
        <div className="specialty-hero-status">
          <span aria-hidden="true" />
          Foundation live
        </div>
      </header>

      <section className="specialty-stats" aria-label="Specialty coding summary">
        <article className="tool-panel">
          <strong>{SPECIALTY_MODULES.length}</strong>
          <span>Planned modules</span>
        </article>
        <article className="tool-panel">
          <strong>{dataSourceCount}</strong>
          <span>PGx data sources</span>
        </article>
        <article className="tool-panel">
          <strong>{ACTIVE_SPECIALTY_MODULES.length}</strong>
          <span>Active engine</span>
        </article>
      </section>

      <section className="specialty-module-section" aria-labelledby="specialty-modules-heading">
        <div className="specialty-section-heading">
          <div>
            <h2 id="specialty-modules-heading">Coding engines</h2>
            <p>Open an active workspace or preview the roadmap.</p>
          </div>
          <span>{SPECIALTY_MODULES.length} modules</span>
        </div>

        <div className="specialty-card-grid">
          {SPECIALTY_MODULES.map((module) => (
            <SpecialtyCard
              key={module.id}
              id={module.id}
              title={module.title}
              description={module.description}
              icon={SPECIALTY_ICONS[module.icon]}
              color={module.color}
              href={module.href}
              badge={module.badge}
              isActive={module.status === "active"}
              stats={module.stats}
              dataSources={module.dataSources}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default SpecialtyHub;
