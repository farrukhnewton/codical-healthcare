export type PgxGeneResult = {
  gene: string;
  genotype?: string;
  phenotype?: string;
  cpt?: string;
  confidence: number;
};

export type PgxMedication = {
  name: string;
  drugClass?: string;
  source: "detected" | "manual";
};

export type PgxExtractedData = {
  patient: {
    name?: string;
    dob?: string;
    mrn?: string;
  };
  lab: {
    name?: string;
    accession?: string;
    collectionDate?: string;
    reportDate?: string;
  };
  orderingProvider?: {
    name?: string;
    npi?: string;
  };
  diagnosisCodes: string[];
  genes: PgxGeneResult[];
  medications: PgxMedication[];
  panel: {
    geneCount: number;
    hasDupDel: boolean;
    detectedPanelName?: string;
  };
  warnings: string[];
  sourceTextLength: number;
};

export type PgxCptCode = {
  code: string;
  description: string;
  tier: "pla" | "panel" | "tier1" | "tier2" | "unlisted";
  minGenes?: number;
  referenceRate: number | null;
};

export type PgxGeneDrugPair = {
  gene: string;
  drug: string;
  drugClass: string;
  cpicLevel: "A" | "B" | "C" | "D";
  cptCodes: string[];
  tableSource: "CPIC" | "FDA" | "CPIC/FDA";
  recommendation: string;
  sourceUrl: string;
};

export type PgxCmsGroup = {
  articleId: string;
  groupNumber: number;
  groupType: "cpt" | "icd10";
  code: string;
  description?: string;
};

export type PgxActionablePair = PgxGeneDrugPair & {
  genotype?: string;
  phenotype?: string;
};

export type PgxAnalysisResult = {
  extracted: PgxExtractedData;
  cptSelection: {
    type: "panel" | "stacked" | "unlisted";
    codes: Array<PgxCptCode & { units: number; gene?: string }>;
    notes: string[];
  };
  icd10: Array<{
    code: string;
    status: "supported" | "manual_review";
    groupNumber?: number;
    rationale: string;
  }>;
  medicalNecessity: {
    isMet: boolean;
    reason: string;
    actionablePairs: PgxActionablePair[];
  };
  auditChecklist: {
    gates: Array<{ id: string; label: string; passed: boolean; message: string }>;
    allPassed: boolean;
  };
  narrative: string;
  disclaimer: string;
};

export const PGX_CPT_CODES: PgxCptCode[] = [
  {
    code: "81418",
    description: "Drug metabolism genomic sequence panel, >=6 genes, includes CYP2C19, CYP2D6 and copy-number analysis",
    tier: "panel",
    minGenes: 6,
    referenceRate: null,
  },
  { code: "81225", description: "CYP2C19 gene analysis", tier: "tier1", referenceRate: null },
  { code: "81226", description: "CYP2D6 gene analysis", tier: "tier1", referenceRate: null },
  { code: "81227", description: "CYP2C9 gene analysis", tier: "tier1", referenceRate: null },
  { code: "81231", description: "CYP3A5 gene analysis", tier: "tier1", referenceRate: null },
  { code: "81232", description: "DPYD gene analysis", tier: "tier1", referenceRate: null },
  { code: "81241", description: "Factor V Leiden analysis", tier: "tier1", referenceRate: null },
  { code: "81247", description: "G6PD gene analysis", tier: "tier1", referenceRate: null },
  { code: "81283", description: "IFNL3 gene analysis", tier: "tier1", referenceRate: null },
  { code: "81306", description: "NUDT15 gene analysis", tier: "tier1", referenceRate: null },
  { code: "81328", description: "SLCO1B1 gene analysis", tier: "tier1", referenceRate: null },
  { code: "81335", description: "TPMT gene analysis", tier: "tier1", referenceRate: null },
  { code: "81350", description: "UGT1A1 gene analysis", tier: "tier1", referenceRate: null },
  { code: "81355", description: "VKORC1 gene analysis", tier: "tier1", referenceRate: null },
  { code: "81401", description: "Molecular pathology procedure, Level 2", tier: "tier2", referenceRate: null },
  { code: "81406", description: "Molecular pathology procedure, Level 7", tier: "tier2", referenceRate: null },
  { code: "81479", description: "Unlisted molecular pathology procedure", tier: "unlisted", referenceRate: null },
];

export const PGX_TIER_1_MAP: Record<string, string> = {
  CYP2C19: "81225",
  CYP2D6: "81226",
  CYP2C9: "81227",
  CYP3A5: "81231",
  DPYD: "81232",
  F5: "81241",
  G6PD: "81247",
  IFNL3: "81283",
  NUDT15: "81306",
  SLCO1B1: "81328",
  TPMT: "81335",
  UGT1A1: "81350",
  VKORC1: "81355",
};

export const PGX_GENES = [
  "CYP2C19",
  "CYP2D6",
  "CYP2C9",
  "CYP3A5",
  "DPYD",
  "F5",
  "G6PD",
  "IFNL3",
  "NUDT15",
  "SLCO1B1",
  "TPMT",
  "UGT1A1",
  "VKORC1",
  "HLA-B",
  "RYR1",
  "CACNA1S",
  "CYP1A2",
  "CYP2B6",
  "CYP4F2",
  "COMT",
  "OPRM1",
  "CYP3A4",
  "UGT2B15",
  "GLP1R",
];

export const PGX_GENE_DRUG_PAIRS: PgxGeneDrugPair[] = [
  pair("CYP2C19", "clopidogrel", "antiplatelet", "A", ["81225", "81418"], "CPIC/FDA", "Consider CYP2C19 phenotype when assessing clopidogrel response."),
  pair("CYP2C19", "citalopram", "SSRI", "A", ["81225", "81418"], "CPIC", "Use CYP2C19 phenotype to support SSRI dose or alternative review."),
  pair("CYP2C19", "escitalopram", "SSRI", "A", ["81225", "81418"], "CPIC", "Use CYP2C19 phenotype to support SSRI dose or alternative review."),
  pair("CYP2C19", "omeprazole", "PPI", "A", ["81225", "81418"], "CPIC", "Assess CYP2C19 metabolism status for PPI therapy context."),
  pair("CYP2C9", "ibuprofen", "NSAID", "B", ["81227"], "CPIC", "Review CYP2C9 status for NSAID exposure and adverse effect risk."),
  pair("CYP2C9", "meloxicam", "NSAID", "B", ["81227"], "CPIC", "Review CYP2C9 status for NSAID exposure and adverse effect risk."),
  pair("CYP2C9", "celecoxib", "NSAID", "B", ["81227"], "CPIC", "Review CYP2C9 status for NSAID exposure and adverse effect risk."),
  pair("CYP2C9", "phenytoin", "anticonvulsant", "A", ["81227"], "CPIC/FDA", "Use CYP2C9 phenotype with HLA context when applicable."),
  pair("CYP2D6", "atomoxetine", "ADHD", "A", ["81226", "81418"], "CPIC", "Use CYP2D6 phenotype to support atomoxetine dose review."),
  pair("CYP2D6", "codeine", "opioid", "A", ["81226", "81418"], "CPIC/FDA", "Use CYP2D6 phenotype to assess opioid activation risk."),
  pair("CYP2D6", "tamoxifen", "SERM", "A", ["81226", "81418"], "CPIC", "Use CYP2D6 phenotype to support oncology medication review."),
  pair("CYP2D6", "venlafaxine", "SNRI", "A", ["81226", "81418"], "CPIC", "Use CYP2D6 phenotype to support antidepressant dose review."),
  pair("CYP3A5", "tacrolimus", "immunosuppressant", "A", ["81231"], "CPIC", "Use CYP3A5 expresser status for tacrolimus dose context."),
  pair("DPYD", "fluorouracil", "chemotherapy", "A", ["81232"], "CPIC/FDA", "DPYD results may support fluoropyrimidine toxicity risk review."),
  pair("DPYD", "capecitabine", "chemotherapy", "A", ["81232"], "CPIC/FDA", "DPYD results may support fluoropyrimidine toxicity risk review."),
  pair("SLCO1B1", "simvastatin", "statin", "A", ["81328"], "CPIC/FDA", "Use SLCO1B1 results to assess statin myopathy risk context."),
  pair("TPMT", "azathioprine", "immunosuppressant", "A", ["81335"], "CPIC/FDA", "Use TPMT phenotype for thiopurine toxicity risk review."),
  pair("NUDT15", "mercaptopurine", "chemotherapy", "A", ["81306"], "CPIC", "Use NUDT15 results for thiopurine toxicity risk review."),
  pair("UGT1A1", "irinotecan", "chemotherapy", "A", ["81350"], "CPIC/FDA", "Use UGT1A1 status for irinotecan toxicity risk context."),
  pair("VKORC1", "warfarin", "anticoagulant", "A", ["81355"], "CPIC/FDA", "Use VKORC1 with CYP2C9 for warfarin dose context."),
  pair("G6PD", "rasburicase", "enzyme", "A", ["81247"], "CPIC/FDA", "G6PD deficiency is clinically actionable for rasburicase risk review."),
  pair("HLA-B", "abacavir", "antiviral", "A", ["81381", "81374"], "CPIC/FDA", "HLA-B variant status may identify hypersensitivity risk."),
  pair("HLA-B", "allopurinol", "anti-gout", "A", ["81381", "81374"], "CPIC/FDA", "HLA-B variant status may identify severe cutaneous reaction risk."),
  pair("HLA-B", "carbamazepine", "anticonvulsant", "A", ["81381", "81374"], "CPIC/FDA", "HLA-B variant status may identify severe cutaneous reaction risk."),
  pair("RYR1", "sevoflurane", "anesthetic", "A", ["81406"], "CPIC", "RYR1 results may support malignant hyperthermia susceptibility review."),
  pair("CACNA1S", "sevoflurane", "anesthetic", "A", ["81479"], "CPIC", "CACNA1S results may support malignant hyperthermia susceptibility review."),
];

// The schema is seeded in Phase 1, but CMS group rows are intentionally not
// guessed. They must come from the versioned CMS article import in the sync
// phase; until then every CPT/ICD pairing remains in coder-review status.
export const PGX_CMS_GROUPS: PgxCmsGroup[] = [];

const CPT_BY_CODE = new Map(PGX_CPT_CODES.map((code) => [code.code, code]));

function pair(
  gene: string,
  drug: string,
  drugClass: string,
  cpicLevel: PgxGeneDrugPair["cpicLevel"],
  cptCodes: string[],
  tableSource: PgxGeneDrugPair["tableSource"],
  recommendation: string,
): PgxGeneDrugPair {
  return {
    gene,
    drug,
    drugClass,
    cpicLevel,
    cptCodes,
    tableSource,
    recommendation,
    sourceUrl: tableSource.includes("CPIC")
      ? "https://cpicpgx.org/guidelines/"
      : "https://www.fda.gov/medical-devices/precision-medicine/table-pharmacogenetic-associations",
  };
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value: unknown) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function findLineValue(text: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`${escapeRegExp(label)}\\s*[:#-]?\\s*([^\\n]{2,90})`, "i");
    const match = text.match(regex);
    if (match?.[1]) return match[1].trim().replace(/\s{2,}.+$/, "");
  }

  return undefined;
}

function detectGenotype(text: string, gene: string) {
  const regex = new RegExp(`${escapeRegExp(gene)}[^\\n]{0,80}?((?:\\*\\d+[A-Z]?|xN|x\\d+|dup|del|normal|intermediate|poor|rapid|ultrarapid)[^\\n,;)]{0,45})`, "i");
  const match = text.match(regex);
  const value = match?.[1]?.trim();
  return value && value.length <= 60 ? value : undefined;
}

function detectPhenotype(text: string, gene: string) {
  const regex = new RegExp(`${escapeRegExp(gene)}[^\\n]{0,120}?((?:ultrarapid|rapid|normal|intermediate|poor) metabolizer|decreased function|increased function|normal function)`, "i");
  const match = text.match(regex);
  return match?.[1]?.trim();
}

export function extractPgxDataFromText(rawText: string): PgxExtractedData {
  const text = normalizeText(rawText);
  const upper = text.toUpperCase();
  const warnings: string[] = [];

  const genes = PGX_GENES.filter((gene) => new RegExp(`\\b${escapeRegExp(gene)}\\b`, "i").test(text)).map((gene) => ({
    gene,
    genotype: detectGenotype(text, gene),
    phenotype: detectPhenotype(text, gene),
    cpt: PGX_TIER_1_MAP[gene],
    confidence: detectGenotype(text, gene) || detectPhenotype(text, gene) ? 0.92 : 0.74,
  }));

  const detectedDrugNames = unique(
    PGX_GENE_DRUG_PAIRS
      .filter((pairRow) => new RegExp(`\\b${escapeRegExp(pairRow.drug)}\\b`, "i").test(text))
      .map((pairRow) => pairRow.drug),
  );

  const medications = detectedDrugNames.map((name) => {
    const pairRow = PGX_GENE_DRUG_PAIRS.find((candidate) => candidate.drug === name);
    return {
      name,
      drugClass: pairRow?.drugClass,
      source: "detected" as const,
    };
  });

  const diagnosisCodes = unique(Array.from(text.matchAll(/\b[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?\b/gi)).map((match) => match[0].toUpperCase()));
  if (diagnosisCodes.length === 0) warnings.push("No source-documented ICD-10-CM code was detected; diagnosis selection requires manual, source-backed review.");

  const hasDupDel = /\b(?:duplication|deletion|copy number|copy-number|dup\/del|dup|del|xN|x\d+)\b/i.test(text);
  if (!hasDupDel && genes.length >= 6) warnings.push("Copy-number or dup/del language was not detected; verify before using 81418.");
  if (genes.length === 0) warnings.push("No supported PGx genes were detected. Paste the result table text or upload a readable PDF.");
  if (medications.length === 0) warnings.push("No active medication was detected. Add drug names before final claim generation.");

  return {
    patient: {
      name: findLineValue(text, ["Patient Name", "Patient"]),
      dob: findLineValue(text, ["DOB", "Date of Birth"]),
      mrn: findLineValue(text, ["MRN", "Medical Record"]),
    },
    lab: {
      name: findLineValue(text, ["Laboratory", "Lab", "Testing Lab"]),
      accession: findLineValue(text, ["Accession", "Specimen", "Test ID"]),
      collectionDate: findLineValue(text, ["Collection Date", "Collected"]),
      reportDate: findLineValue(text, ["Report Date", "Reported"]),
    },
    orderingProvider: {
      name: findLineValue(text, ["Ordering Provider", "Provider"]),
      npi: upper.match(/\bNPI\s*[:#-]?\s*(\d{10})\b/)?.[1],
    },
    diagnosisCodes,
    genes,
    medications,
    panel: {
      geneCount: genes.length,
      hasDupDel,
      detectedPanelName: upper.includes("GENESIGHT")
        ? "GeneSight"
        : upper.includes("GENOMIND")
          ? "Genomind"
          : upper.includes("RIGHTMED")
            ? "RightMed"
            : undefined,
    },
    warnings,
    sourceTextLength: text.length,
  };
}

export function determineCptCodes(extracted: Pick<PgxExtractedData, "genes" | "panel">, payerAcceptsPanel = true): PgxAnalysisResult["cptSelection"] {
  const genes = unique(extracted.genes.map((result) => result.gene));
  const notes: string[] = [];
  const hasCyp2c19 = genes.includes("CYP2C19");
  const hasCyp2d6 = genes.includes("CYP2D6");

  if (genes.length >= 6 && hasCyp2c19 && hasCyp2d6 && extracted.panel.hasDupDel && payerAcceptsPanel) {
    const panelCode = CPT_BY_CODE.get("81418");
    return {
      type: "panel",
      codes: panelCode ? [{ ...panelCode, units: 1 }] : [],
      notes: ["81418 selected because the panel has >=6 genes, CYP2C19, CYP2D6 and copy-number evidence."],
    };
  }

  const codes = genes
    .map((gene) => {
      const code = PGX_TIER_1_MAP[gene];
      const cpt = code ? CPT_BY_CODE.get(code) : undefined;
      if (cpt) return { ...cpt, units: 1, gene };
      return undefined;
    })
    .filter((value): value is PgxCptCode & { units: number; gene: string } => Boolean(value));

  const uncoveredGenes = genes.filter((gene) => !PGX_TIER_1_MAP[gene]);
  if (uncoveredGenes.length > 0) {
    const fallback = CPT_BY_CODE.get("81479");
    if (fallback) codes.push({ ...fallback, units: 1, gene: uncoveredGenes.join(", ") });
    notes.push(`${uncoveredGenes.length} gene(s) do not have a seeded Tier 1 mapping and require coder review.`);
  }

  return {
    type: codes.some((code) => code.tier === "unlisted") ? "unlisted" : "stacked",
    codes,
    notes: [
      ...notes,
      "Stacked individual CPT logic used because panel criteria were not fully met.",
    ],
  };
}

export function validateMedicalNecessity(genes: PgxGeneResult[], medications: PgxMedication[]) {
  const actionablePairs: PgxActionablePair[] = [];
  for (const medication of medications) {
    for (const geneResult of genes) {
      const pairRow = PGX_GENE_DRUG_PAIRS.find(
        (candidate) => candidate.gene === geneResult.gene && candidate.drug.toLowerCase() === medication.name.toLowerCase(),
      );
      if (pairRow && (pairRow.cpicLevel === "A" || pairRow.cpicLevel === "B" || pairRow.tableSource.includes("FDA"))) {
        actionablePairs.push({
          ...pairRow,
          genotype: geneResult.genotype,
          phenotype: geneResult.phenotype,
        });
      }
    }
  }

  return {
    isMet: actionablePairs.length > 0,
    actionablePairs,
    reason: actionablePairs.length > 0
      ? `${actionablePairs.length} actionable gene-drug pair(s) found using CPIC/FDA starter knowledge.`
      : "No actionable gene-drug pair found. Add active medication context or route for appeal review.",
  };
}

export function validateIcd10ForCpt(cptCode: string, icd10: string) {
  const groupNumbers = PGX_CMS_GROUPS
    .filter((group) => group.articleId === "A59915" && group.groupType === "cpt" && group.code === cptCode)
    .map((group) => group.groupNumber);
  const match = PGX_CMS_GROUPS.find(
    (group) => group.articleId === "A59915"
      && group.groupType === "icd10"
      && group.code === icd10
      && groupNumbers.includes(group.groupNumber),
  );

  return {
    isValid: Boolean(match),
    groupNumber: match?.groupNumber,
  };
}

export function analyzePgxCoding(input: {
  extracted: PgxExtractedData;
  primaryIcd10?: string;
  drugNames?: string[];
  payerAcceptsPanel?: boolean;
}): PgxAnalysisResult {
  const manualMedications = unique(input.drugNames || [])
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
    .map((name) => {
      const pairRow = PGX_GENE_DRUG_PAIRS.find((candidate) => candidate.drug === name);
      return { name, drugClass: pairRow?.drugClass, source: "manual" as const };
    });
  const medications = unique([...input.extracted.medications, ...manualMedications].map((medication) => medication.name))
    .map((name) => [...input.extracted.medications, ...manualMedications].find((medication) => medication.name === name)!)
    .filter(Boolean);
  const extracted = { ...input.extracted, medications };
  const cptSelection = determineCptCodes(extracted, input.payerAcceptsPanel ?? true);
  const diagnosisCodes = unique([input.primaryIcd10?.trim().toUpperCase(), ...extracted.diagnosisCodes].filter(Boolean) as string[]);
  const medicalNecessity = validateMedicalNecessity(extracted.genes, extracted.medications);

  const icd10 = diagnosisCodes.map((code) => {
    const groupMatch = cptSelection.codes.some((cpt) => validateIcd10ForCpt(cpt.code, code).isValid);
    const validation = cptSelection.codes.map((cpt) => validateIcd10ForCpt(cpt.code, code)).find((result) => result.isValid);
    return {
      code,
      status: groupMatch ? "supported" as const : "manual_review" as const,
      groupNumber: validation?.groupNumber,
      rationale: groupMatch
        ? "The CPT/ICD relationship is present in a verified, versioned source group."
        : "No verified jurisdiction/date-qualified source relationship is active; manual review is required.",
    };
  });

  const gates = [
    {
      id: "ordering-provider",
      label: "Ordering provider",
      passed: Boolean(extracted.orderingProvider?.npi || extracted.orderingProvider?.name),
      message: extracted.orderingProvider?.npi
        ? `Provider NPI ${extracted.orderingProvider.npi} detected.`
        : "Provider identity needs confirmation before claim submission.",
    },
    {
      id: "golden-triangle",
      label: "Diagnosis + medication + gene",
      passed: medicalNecessity.isMet && icd10.some((row) => row.status === "supported"),
      message: medicalNecessity.isMet
        ? "Actionable gene-drug evidence found with diagnosis context."
        : "Add active medication context tied to a tested gene.",
    },
    {
      id: "drug-name",
      label: "Drug on claim",
      passed: extracted.medications.length > 0,
      message: extracted.medications.length > 0
        ? `Drugs: ${extracted.medications.map((medication) => medication.name).join(", ")}.`
        : "Drug name should appear in the claim narrative.",
    },
    {
      id: "gene-narrative",
      label: "Gene narrative",
      passed: extracted.genes.length > 0,
      message: `${extracted.genes.length} gene result(s) available for the narrative.`,
    },
    {
      id: "cpic-fda",
      label: "CPIC/FDA evidence",
      passed: medicalNecessity.actionablePairs.length > 0,
      message: medicalNecessity.actionablePairs.length > 0
        ? medicalNecessity.actionablePairs.map((pairRow) => `${pairRow.gene}/${pairRow.drug} ${pairRow.cpicLevel}`).join(", ")
        : "No seeded CPIC/FDA evidence match found.",
    },
    {
      id: "once-lifetime",
      label: "Once-per-lifetime",
      passed: true,
      message: "No prior PGx test was found in this local Phase 1 session.",
    },
  ];

  const narrative = [
    `PGx analysis detected ${extracted.genes.length} gene(s): ${extracted.genes.map((gene) => gene.gene).join(", ") || "none"}.`,
    `Suggested CPT strategy: ${cptSelection.type}; codes ${cptSelection.codes.map((code) => code.code).join(", ") || "none"}.`,
    medicalNecessity.reason,
    "Coder must verify current CMS MCD article, commercial payer policy, LCD/NCD applicability and documentation before billing.",
  ].join(" ");

  return {
    extracted,
    cptSelection,
    icd10,
    medicalNecessity,
    auditChecklist: {
      gates,
      allPassed: gates.every((gate) => gate.passed),
    },
    narrative,
    disclaimer: "Decision support only. Verify current payer policy, CMS guidance and certified coder review before billing or submission.",
  };
}

export function buildPgxClaimPreview(analysis: PgxAnalysisResult) {
  const supportedIcd = analysis.icd10.filter((row) => row.status === "supported").map((row) => row.code);
  const reviewIcd = analysis.icd10.filter((row) => row.status !== "supported").map((row) => row.code);

  return {
    claimType: "CMS-1500",
    previewOnly: true,
    submissionEnabled: false,
    articleId: null,
    coverageDecision: "jurisdiction_not_configured",
    diagnosisPointers: supportedIcd,
    reviewDiagnosisCodes: reviewIcd,
    serviceLines: analysis.cptSelection.codes.map((code, index) => ({
      line: index + 1,
      cpt: code.code,
      units: code.units,
      diagnosisPointer: "A",
      charge: null,
      referenceRate: code.referenceRate,
      rateDisclaimer: "Reference only; look up the applicable date-of-service fee schedule and payer contract.",
      modifiers: [],
      narrative: analysis.narrative,
    })),
    attachments: {
      geneDrugReport: analysis.medicalNecessity.actionablePairs.map((pairRow) => ({
        gene: pairRow.gene,
        drug: pairRow.drug,
        evidence: `${pairRow.tableSource} Level ${pairRow.cpicLevel}`,
        recommendation: pairRow.recommendation,
      })),
    },
    audit: analysis.auditChecklist,
    disclaimer: analysis.disclaimer,
  };
}
