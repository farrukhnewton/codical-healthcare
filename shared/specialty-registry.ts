export type SpecialtyModuleStatus = "active" | "coming-soon";

export type SpecialtyIconName =
  | "dna"
  | "flame"
  | "ambulance"
  | "heart-pulse"
  | "pill"
  | "calculator"
  | "chart"
  | "flask"
  | "baby"
  | "activity"
  | "heart";

export type SpecialtyModule = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: SpecialtyIconName;
  color: string;
  href: string;
  status: SpecialtyModuleStatus;
  badge?: "new" | "beta" | "coming-soon";
  stats: string;
  dataSources: number;
  imageUrl?: string;
};

/**
 * One registry drives both the Specialty Hub and sidebar. Future modules only
 * need a new entry here plus their route component when they become active.
 */
export const SPECIALTY_MODULES: readonly SpecialtyModule[] = [
  {
    id: "pgx",
    title: "PGx Coding Engine",
    shortTitle: "PGx Coding Engine",
    description: "Extract pharmacogenomic results, review gene-drug evidence, and prepare coder-ready claim suggestions.",
    icon: "dna",
    color: "#37d0c6",
    href: "/specialty/pgx",
    status: "active",
    badge: "new",
    stats: "Active",
    dataSources: 4,
    imageUrl: "https://codical-public-assets.farrukhnewton.workers.dev/specialty-images/pgx-genomic-sequencing-4k.jpg",
  },
  {
    id: "burn",
    title: "Burn & Skin Graft",
    shortTitle: "Burn & Skin Graft",
    description: "Surface-area, depth, excision, and graft coding workflow.",
    icon: "flame",
    color: "#fb923c",
    href: "/specialty/burn",
    status: "active",
    badge: "new",
    stats: "Active",
    dataSources: 5,
    imageUrl: "https://codical-public-assets.farrukhnewton.workers.dev/specialty-images/burn-skin-graft-4k.jpg",
  },
  {
    id: "ambulance",
    title: "Ambulance Coding",
    shortTitle: "Ambulance Coding",
    description: "Level-of-service, mileage, origin/destination, and modifier support.",
    icon: "ambulance",
    color: "#ef4444",
    href: "/specialty/ambulance",
    status: "active",
    badge: "new",
    stats: "Active",
    dataSources: 5,
    imageUrl: "/assets/specialty/ambulance-coding-hero-v1.png",
  },
  {
    id: "transplant",
    title: "Organ Transplant Lifecycle",
    shortTitle: "Organ Transplant",
    description: "Program approval, coverage, coding, acquisition, donor, and drug-benefit review.",
    icon: "heart-pulse",
    color: "#8b5cf6",
    href: "/specialty/transplant",
    status: "active",
    badge: "new",
    stats: "Active",
    dataSources: 10,
    imageUrl: "/assets/specialty/transplant-lifecycle-hero-v1.png",
  },
  {
    id: "otp-mat",
    title: "OTP / MOUD Bundle",
    shortTitle: "OTP / MOUD Bundle",
    description: "Patient-centered opioid treatment program bundles, recovery supports, take-home supply, and claim review.",
    icon: "pill",
    color: "#14b8a6",
    href: "/specialty/otp-mat",
    status: "active",
    badge: "new",
    stats: "Active",
    dataSources: 6,
    imageUrl: "/assets/specialty/otp-mat-bundle-hero-v1.png",
  },
  {
    id: "em-mdm",
    title: "E/M MDM Calculator",
    shortTitle: "E/M MDM Calculator",
    description: "Evidence-based office/outpatient MDM, total-time, prolonged-service, and add-on review.",
    icon: "calculator",
    color: "#6d92ff",
    href: "/specialty/em-mdm",
    status: "active",
    badge: "new",
    stats: "Active",
    dataSources: 5,
    imageUrl: "/assets/specialty/em-mdm-calculator-hero-v1.png",
  },
  {
    id: "hcc",
    title: "HCC Risk Adjustment",
    shortTitle: "HCC Risk Adjustment",
    description: "CMS-HCC V28 evidence eligibility, hierarchy, interactions, scoring, and RADV review.",
    icon: "chart",
    color: "#d7b56d",
    href: "/specialty/hcc",
    status: "active",
    badge: "new",
    stats: "Active",
    dataSources: 6,
    imageUrl: "/assets/specialty/hcc-risk-adjustment-hero-v1.png",
  },
  {
    id: "infusion",
    title: "Infusion Hierarchy",
    shortTitle: "Infusion Hierarchy",
    description: "Administration hierarchy, verified timing, CMS drug units, JW/JZ, and NCCI review.",
    icon: "flask",
    color: "#f43f5e",
    href: "/specialty/infusion",
    status: "active",
    badge: "new",
    stats: "Active",
    dataSources: 6,
    imageUrl: "/assets/specialty/infusion-hierarchy-hero-v1.png",
  },
  {
    id: "nicu",
    title: "NICU Daily Coder",
    shortTitle: "NICU Daily Coder",
    description: "Daily neonatal intensive care services and acuity review.",
    icon: "baby",
    color: "#06b6d4",
    href: "/specialty/nicu",
    status: "active",
    badge: "new",
    stats: "Active",
    dataSources: 7,
    imageUrl: "/assets/specialty/nicu-daily-coder-hero-v1.png",
  },
  {
    id: "vad-ecmo",
    title: "VAD/ECMO Coder",
    shortTitle: "VAD/ECMO Coder",
    description: "Episode-based VAD and ECMO professional/facility coding with coverage and edit controls.",
    icon: "activity",
    color: "#c084fc",
    href: "/specialty/vad-ecmo",
    status: "active",
    badge: "new",
    stats: "Active",
    dataSources: 7,
    imageUrl: "/assets/specialty/vad-ecmo-coder-hero-v1.png",
  },
  {
    id: "cabg",
    title: "CABG Assembler",
    shortTitle: "CABG Assembler",
    description: "Vessel, graft, harvest, and add-on code assembly.",
    icon: "heart",
    color: "#36c98f",
    href: "/specialty/cabg",
    status: "coming-soon",
    badge: "coming-soon",
    stats: "Planned",
    dataSources: 0,
  },
] as const;

export const ACTIVE_SPECIALTY_MODULES = SPECIALTY_MODULES.filter((module) => module.status === "active");
