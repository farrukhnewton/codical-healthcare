import { Layers3 } from "lucide-react";
import { SpecialtyCard } from "@/components/specialty/SpecialtyCard";
import { SPECIALTY_MODULES } from "@shared/specialty-registry";

export function SpecialtyHub() {
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
              title={module.title}
              color={module.color}
              href={module.href}
              isActive={module.status === "active"}
              imageUrl={module.imageUrl}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default SpecialtyHub;
