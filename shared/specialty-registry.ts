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
    description: "Structured medical decision-making level review and documentation cues.",
    icon: "calculator",
    color: "#6d92ff",
    href: "/specialty/em-mdm",
    status: "coming-soon",
    badge: "coming-soon",
    stats: "Planned",
    dataSources: 0,
  },
  {
    id: "hcc",
    title: "HCC Risk Adjustment",
    shortTitle: "HCC Risk Adjustment",
    description: "Risk-adjustment evidence, recapture, and documentation workflow.",
    icon: "chart",
    color: "#d7b56d",
    href: "/specialty/hcc",
    status: "coming-soon",
    badge: "coming-soon",
    stats: "Planned",
    dataSources: 0,
  },
  {
    id: "infusion",
    title: "Infusion Hierarchy",
    shortTitle: "Infusion Hierarchy",
    description: "Hierarchy, time, sequencing, and concurrent-service calculations.",
    icon: "flask",
    color: "#f43f5e",
    href: "/specialty/infusion",
    status: "coming-soon",
    badge: "coming-soon",
    stats: "Planned",
    dataSources: 0,
  },
  {
    id: "nicu",
    title: "NICU Daily Coder",
    shortTitle: "NICU Daily Coder",
    description: "Daily neonatal intensive care services and acuity review.",
    icon: "baby",
    color: "#06b6d4",
    href: "/specialty/nicu",
    status: "coming-soon",
    badge: "coming-soon",
    stats: "Planned",
    dataSources: 0,
  },
  {
    id: "vad-ecmo",
    title: "VAD/ECMO Coder",
    shortTitle: "VAD/ECMO Coder",
    description: "Mechanical circulatory support services, duration, and monitoring.",
    icon: "activity",
    color: "#c084fc",
    href: "/specialty/vad-ecmo",
    status: "coming-soon",
    badge: "coming-soon",
    stats: "Planned",
    dataSources: 0,
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
