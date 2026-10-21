import { z } from "zod";

// PayPal Dispute Reasons recognized by Disputes API
export type PayPalDisputeReason =
  | "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
  | "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED"
  | "UNAUTHORISED"
  | "CREDIT_NOT_PROCESSED"
  | "DUPLICATE_TRANSACTION"
  | "INCORRECT_AMOUNT"
  | "PAYMENT_BY_OTHER_MEANS"
  | "CANCELLED_RECURRING_BILLING"
  | "PROBLEM_WITH_REMITTANCE"
  | "OTHER";

export type DisputeStatus =
  | "REQUIRED_ACTION"
  | "UNDER_REVIEW"
  | "WAITING_FOR_BUYER"
  | "WAITING_FOR_SELLER"
  | "RESOLVED"
  | "CLOSED";

export type DisputeLifecycleStage =
  | "INQUIRY"
  | "CHARGEBACK"
  | "PRE_ARBITRATION"
  | "CLAIM";

export type RecommendedAction =
  | "PROVIDE_EVIDENCE"
  | "ACCEPT_CLAIM"
  | "OFFER_PARTIAL_REFUND"
  | "REQUEST_MORE_INFO";

// Zod Schema for AI Structured Output
export const DisputeAnalysisSchema = z.object({
  summary: z.string().describe("Executive summary of dispute context and factual findings"),
  completenessScore: z.number().min(0).max(100).describe("0-100 evidence completeness rating"),
  recommendedAction: z.enum([
    "PROVIDE_EVIDENCE",
    "ACCEPT_CLAIM",
    "OFFER_PARTIAL_REFUND",
    "REQUEST_MORE_INFO"
  ]),
  recommendationRationale: z.string().describe("Factual justification for the recommended action based only on provided evidence"),
  keyStrengths: z.array(z.string()).describe("Factual evidence points strongly supporting the merchant"),
  criticalGaps: z.array(z.string()).describe("Missing documentation or risks that weaken the merchant case"),
  rebuttalDraft: z.string().describe("Factual, professional rebuttal statement citing verifiable data points without guarantees"),
  citations: z.array(
    z.object({
      fact: z.string(),
      source: z.string(), // e.g., 'UPS Tracking 1Z999', 'Order Invoice #AG-94812'
      verified: z.boolean(),
    })
  ),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export type DisputeAnalysisResult = z.infer<typeof DisputeAnalysisSchema>;

// PayPal API Provide Evidence Payload schema
export const PayPalProvideEvidenceSchema = z.object({
  evidence_type: z.enum([
    "PROOF_OF_FULFILLMENT",
    "PROOF_OF_DELIVERY",
    "PROOF_OF_REFUND",
    "TERMS_AND_CONDITIONS",
    "CUSTOMS_DOCUMENTATION",
    "ADDITIONAL_INFORMATION_OF_MERCHANDISE_OR_SERVICE",
    "OTHER"
  ]),
  notes: z.string().min(5).max(2000),
  tracking_info: z.array(
    z.object({
      carrier_name: z.string(),
      tracking_number: z.string(),
    })
  ).optional(),
});

export type PayPalProvideEvidencePayload = z.infer<typeof PayPalProvideEvidenceSchema>;
