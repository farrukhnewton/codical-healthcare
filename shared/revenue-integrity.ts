import { z } from "zod";

export const revenueClaimStatuses = [
  "draft",
  "needs_review",
  "ready",
  "submitted",
  "accepted",
  "rejected",
  "adjudicating",
  "paid",
  "partially_paid",
  "denied",
  "appealed",
  "closed",
] as const;

export type RevenueClaimStatus = (typeof revenueClaimStatuses)[number];

export const revenueWorkItemCategories = [
  "demographics",
  "coverage",
  "authorization",
  "documentation",
  "coding",
  "claim_format",
  "clearinghouse_rejection",
  "denial",
  "appeal",
  "underpayment",
] as const;

export type RevenueWorkItemCategory = (typeof revenueWorkItemCategories)[number];

const moneySchema = z.coerce.number().finite().nonnegative().max(100_000_000);

export const revenueClaimLineInputSchema = z.object({
  lineNumber: z.coerce.number().int().positive().max(999),
  procedureCode: z.string().trim().min(1).max(12),
  description: z.string().trim().max(500).optional(),
  modifiers: z.array(z.string().trim().min(1).max(4)).max(4).default([]),
  diagnosisPointers: z.array(z.coerce.number().int().min(1).max(12)).min(1).max(4),
  units: z.coerce.number().positive().max(99_999),
  chargeAmount: moneySchema,
  expectedAmount: moneySchema.optional(),
  placeOfService: z.string().trim().regex(/^\d{2}$/).optional(),
});

export const revenueClaimCreateSchema = z.object({
  patientId: z.coerce.number().int().positive().optional(),
  encounterId: z.coerce.number().int().positive().optional(),
  patientControlNumber: z.string().trim().min(1).max(50),
  payerId: z.string().trim().min(1).max(80),
  payerName: z.string().trim().min(1).max(160),
  serviceFrom: z.string().trim().date(),
  serviceTo: z.string().trim().date().optional(),
  billingProviderNpi: z.string().trim().regex(/^\d{10}$/),
  renderingProviderNpi: z.string().trim().regex(/^\d{10}$/).optional(),
  diagnosisCodes: z.array(z.string().trim().min(3).max(12)).min(1).max(12),
  totalCharge: moneySchema,
  expectedAmount: moneySchema.optional(),
  lines: z.array(revenueClaimLineInputSchema).min(1).max(200),
  metadata: z.record(z.unknown()).default({}),
});

export type RevenueClaimCreateInput = z.infer<typeof revenueClaimCreateSchema>;

export const revenueWorkItemActionSchema = z.object({
  action: z.enum(["start", "resolve", "dismiss", "reopen"]),
  note: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if (["resolve", "dismiss", "reopen"].includes(value.action) && (!value.note || value.note.length < 5)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["note"],
      message: "A note of at least five characters is required for this action.",
    });
  }
});

export type RevenueWorkItemActionInput = z.infer<typeof revenueWorkItemActionSchema>;

const x12SafeTextSchema = (maximum: number) => z.string().trim().min(1).max(maximum)
  .refine((value) => !/[~*:^>]/.test(value), "X12 delimiter characters are not allowed.");

export const revenueAddressSchema = z.object({
  address1: x12SafeTextSchema(55),
  address2: x12SafeTextSchema(55).optional(),
  city: x12SafeTextSchema(30),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  postalCode: z.string().trim().regex(/^\d{5}(?:\d{4})?$/),
});

export const revenueContactSchema = z.object({
  name: x12SafeTextSchema(60),
  // Optum's published sandbox submitter uses a nine-digit canned value;
  // production contacts normally use the full ten-digit US number.
  phoneNumber: z.string().trim().regex(/^\d{9,10}$/),
  email: z.string().trim().email().max(80).optional(),
});

export const revenueTransmissionSchema = z.object({
  tradingPartnerServiceId: x12SafeTextSchema(80),
  tradingPartnerName: x12SafeTextSchema(80),
  submitter: z.object({
    organizationName: x12SafeTextSchema(60),
    submitterIdentification: x12SafeTextSchema(80),
    contactInformation: revenueContactSchema,
  }),
  receiver: z.object({
    organizationName: x12SafeTextSchema(60),
    receiverId: x12SafeTextSchema(80).optional(),
  }),
  subscriber: z.object({
    memberId: x12SafeTextSchema(80),
    firstName: x12SafeTextSchema(35),
    lastName: x12SafeTextSchema(60),
    dateOfBirth: z.string().trim().date(),
    gender: z.enum(["M", "F", "U"]),
    groupNumber: x12SafeTextSchema(50).optional(),
    policyNumber: x12SafeTextSchema(50).optional(),
    subscriberGroupName: x12SafeTextSchema(60).optional(),
    paymentResponsibilityLevelCode: z.enum(["P", "S", "T"]).default("P"),
    address: revenueAddressSchema,
  }),
  dependent: z.object({
    memberId: x12SafeTextSchema(80).optional(),
    paymentResponsibilityLevelCode: z.enum(["P", "S", "T"]).default("P"),
    firstName: x12SafeTextSchema(35),
    lastName: x12SafeTextSchema(60),
    dateOfBirth: z.string().trim().date(),
    gender: z.enum(["M", "F", "U"]),
    relationshipToSubscriberCode: x12SafeTextSchema(2),
    policyNumber: x12SafeTextSchema(50).optional(),
    address: revenueAddressSchema.optional(),
  }).optional(),
  billing: z.object({
    organizationName: x12SafeTextSchema(60),
    npi: z.string().trim().regex(/^\d{10}$/),
    employerId: z.string().trim().regex(/^\d{9}$/),
    taxonomyCode: z.string().trim().regex(/^[A-Za-z0-9]{10}$/),
    address: revenueAddressSchema,
    contactInformation: revenueContactSchema,
  }),
  rendering: z.object({
    firstName: x12SafeTextSchema(35),
    lastName: x12SafeTextSchema(60),
    npi: z.string().trim().regex(/^\d{10}$/),
    taxonomyCode: z.string().trim().regex(/^[A-Za-z0-9]{10}$/),
  }).optional(),
  serviceFacilityLocation: z.object({
    organizationName: x12SafeTextSchema(60),
    npi: z.string().trim().regex(/^\d{10}$/).optional(),
    address: revenueAddressSchema,
  }).optional(),
  claimFilingCode: x12SafeTextSchema(2).default("CI"),
  claimFrequencyCode: z.string().trim().regex(/^\d$/).default("1"),
  signatureIndicator: z.enum(["Y", "N"]).default("Y"),
  planParticipationCode: z.enum(["A", "B", "C"]).default("A"),
  benefitsAssignmentCertificationIndicator: z.enum(["Y", "N", "W"]).default("Y"),
  releaseInformationCode: z.enum(["Y", "I"]).default("Y"),
});

export type RevenueTransmissionInput = z.infer<typeof revenueTransmissionSchema>;

export const revenueClaimCorrectionSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  reason: z.string().trim().min(5).max(500),
  claim: revenueClaimCreateSchema.omit({ patientId: true, encounterId: true, metadata: true }),
  transmission: revenueTransmissionSchema.optional(),
});

export type RevenueClaimCorrectionInput = z.infer<typeof revenueClaimCorrectionSchema>;

export type ClaimIntegrityIssue = {
  code: string;
  category: RevenueWorkItemCategory;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  recommendedAction: string;
  lineNumber?: number;
};

export type ClaimIntegrityResult = {
  ready: boolean;
  score: number;
  issues: ClaimIntegrityIssue[];
};

export function isValidNpi(value: string | null | undefined) {
  if (!value || !/^\d{10}$/.test(value)) return false;

  const payload = `80840${value.slice(0, 9)}`;
  let sum = 0;

  for (let index = 0; index < payload.length; index += 1) {
    let digit = Number(payload[index]);
    if (index % 2 === 1) digit *= 2;
    sum += digit > 9 ? digit - 9 : digit;
  }

  return (10 - (sum % 10)) % 10 === Number(value[9]);
}

export function evaluateClaimIntegrity(input: RevenueClaimCreateInput): ClaimIntegrityResult {
  const issues: ClaimIntegrityIssue[] = [];
  const diagnosisCount = input.diagnosisCodes.length;
  const lineChargeTotal = input.lines.reduce((sum, line) => sum + line.chargeAmount, 0);

  if (!isValidNpi(input.billingProviderNpi)) {
    issues.push({
      code: "INVALID_BILLING_NPI",
      category: "demographics",
      severity: "critical",
      message: "The billing provider NPI does not pass the NPI check-digit validation.",
      recommendedAction: "Verify the billing provider NPI before releasing this claim.",
    });
  }

  if (input.renderingProviderNpi && !isValidNpi(input.renderingProviderNpi)) {
    issues.push({
      code: "INVALID_RENDERING_NPI",
      category: "demographics",
      severity: "high",
      message: "The rendering provider NPI does not pass the NPI check-digit validation.",
      recommendedAction: "Verify or remove the rendering provider NPI.",
    });
  }

  const seenLineNumbers = new Set<number>();
  for (const line of input.lines) {
    if (seenLineNumbers.has(line.lineNumber)) {
      issues.push({
        code: "DUPLICATE_LINE_NUMBER",
        category: "claim_format",
        severity: "critical",
        message: `Service line ${line.lineNumber} appears more than once.`,
        recommendedAction: "Assign a unique service-line number before submission.",
        lineNumber: line.lineNumber,
      });
    }
    seenLineNumbers.add(line.lineNumber);

    const invalidPointer = line.diagnosisPointers.find((pointer) => pointer > diagnosisCount);
    if (invalidPointer) {
      issues.push({
        code: "INVALID_DIAGNOSIS_POINTER",
        category: "coding",
        severity: "critical",
        message: `Service line ${line.lineNumber} points to diagnosis ${invalidPointer}, but only ${diagnosisCount} diagnoses are present.`,
        recommendedAction: "Correct the diagnosis pointer using documented diagnoses on this claim.",
        lineNumber: line.lineNumber,
      });
    }

    if (!/^[A-Z0-9]{4,7}$/i.test(line.procedureCode)) {
      issues.push({
        code: "INVALID_PROCEDURE_FORMAT",
        category: "coding",
        severity: "high",
        message: `Service line ${line.lineNumber} has an invalid CPT/HCPCS format.`,
        recommendedAction: "Verify the procedure code against the active code set.",
        lineNumber: line.lineNumber,
      });
    }
  }

  if (Math.abs(lineChargeTotal - input.totalCharge) > 0.009) {
    issues.push({
      code: "CHARGE_TOTAL_MISMATCH",
      category: "claim_format",
      severity: "critical",
      message: `Claim total ${input.totalCharge.toFixed(2)} does not equal service-line charges ${lineChargeTotal.toFixed(2)}.`,
      recommendedAction: "Reconcile the claim header total with all service lines.",
    });
  }

  const penalty = issues.reduce((total, issue) => {
    if (issue.severity === "critical") return total + 25;
    if (issue.severity === "high") return total + 15;
    if (issue.severity === "medium") return total + 8;
    return total + 3;
  }, 0);
  const score = Math.max(0, 100 - penalty);

  return {
    ready: !issues.some((issue) => issue.severity === "critical" || issue.severity === "high"),
    score,
    issues,
  };
}

const claimTransitions: Record<RevenueClaimStatus, readonly RevenueClaimStatus[]> = {
  draft: ["needs_review", "ready"],
  needs_review: ["draft", "ready"],
  ready: ["needs_review", "submitted"],
  submitted: ["accepted", "rejected"],
  accepted: ["adjudicating", "rejected"],
  rejected: ["draft", "needs_review", "closed"],
  adjudicating: ["paid", "partially_paid", "denied"],
  paid: ["closed"],
  partially_paid: ["appealed", "closed"],
  denied: ["appealed", "closed"],
  appealed: ["paid", "partially_paid", "denied", "closed"],
  closed: [],
};

export function canTransitionClaim(from: RevenueClaimStatus, to: RevenueClaimStatus) {
  return claimTransitions[from].includes(to);
}

export function calculateWorkPriority(input: {
  recoverableAmount?: number | null;
  deadlineHours?: number | null;
  severity: "critical" | "high" | "medium" | "low";
  confidence?: number | null;
}) {
  const severityScore = { critical: 45, high: 32, medium: 20, low: 8 }[input.severity];
  const amount = Math.max(0, input.recoverableAmount || 0);
  const financialScore = Math.min(30, Math.log10(amount + 1) * 7.5);
  const deadline = input.deadlineHours;
  const deadlineScore = deadline == null
    ? 0
    : deadline <= 24
      ? 20
      : deadline <= 72
        ? 14
        : deadline <= 168
          ? 8
          : 3;
  const confidenceScore = Math.min(5, Math.max(0, input.confidence ?? 0) * 5);

  return Math.round(Math.min(100, severityScore + financialScore + deadlineScore + confidenceScore));
}

export type RevenueOverview = {
  generatedAt: string;
  organization: { id: string; name: string };
  metrics: {
    openClaims: number;
    readyToSubmit: number;
    rejectedClaims: number;
    deniedClaims: number;
    openWorkItems: number;
    revenueAtRisk: number;
    underpaymentOpportunity: number;
  };
  statusCounts: Array<{ status: RevenueClaimStatus; count: number }>;
  integration: {
    provider: string;
    mode: "not_configured" | "test" | "production";
    status: string;
    liveSubmissionEnabled: boolean;
  };
};
