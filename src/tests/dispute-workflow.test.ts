import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateFactualDisputeAnalysis,
  verifyCompliance,
  DisputeContext,
} from "../lib/ai-agent";
import { PayPalDisputesClient } from "../lib/paypal";
import { DisputeAnalysisSchema } from "../lib/types";

describe("AutoSettle AI - Dispute Resolution & Anti-Hallucination Tests", () => {
  const baseDisputeContext: DisputeContext = {
    disputeId: "test-dispute-1",
    paypalDisputeId: "PP-D-TEST-99",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    disputeAmount: 189.50,
    currency: "USD",
    buyerName: "Alex Morgan",
    buyerEmail: "alex.m@example.com",
    sellerTransactionId: "TXN-998877",
    responseDueDate: new Date(Date.now() + 4 * 24 * 3600 * 1000),
    order: {
      orderNumber: "AG-10029",
      orderDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      customerName: "Alex Morgan",
      customerEmail: "alex.m@example.com",
      shippingAddress: "123 Ocean Ave, Santa Monica, CA 90401",
      orderTotal: 189.50,
      items: [
        { description: "Waterproof Trail Gaiters", qty: 1, price: 89.50 },
        { description: "Carbon Hiking Pole Set", qty: 1, price: 100.00 },
      ],
    },
    tracking: {
      carrier: "UPS",
      trackingNumber: "1Z999TEST123456",
      status: "DELIVERED",
      shippedDate: new Date(Date.now() - 8 * 24 * 3600 * 1000),
      deliveredDate: new Date(Date.now() - 4 * 24 * 3600 * 1000),
      destinationZip: "90401",
      signedBy: "A. MORGAN",
    },
    messages: [],
    evidenceItems: [
      {
        evidenceType: "PROOF_OF_DELIVERY",
        title: "UPS Signature Proof",
        description: "Carrier signed electronic receipt",
        strength: "STRONG",
        verified: true,
      },
    ],
  };

  it("should evaluate strong INR defense with verified delivery signature", () => {
    const analysis = generateFactualDisputeAnalysis(baseDisputeContext);

    assert.strictEqual(analysis.recommendedAction, "PROVIDE_EVIDENCE");
    assert.ok(analysis.completenessScore >= 85, "Completeness score should be at least 85%");
    assert.strictEqual(analysis.riskLevel, "LOW");
    assert.ok(analysis.keyStrengths.length > 0, "Should have strengths identified");
    assert.ok(analysis.rebuttalDraft.includes("A. MORGAN"), "Should include signature name");
    assert.ok(analysis.rebuttalDraft.includes("UPS"), "Should cite carrier UPS");
  });

  it("should flag critical gaps when tracking is absent for Item Not Received", () => {
    const missingTrackingContext: DisputeContext = {
      ...baseDisputeContext,
      tracking: null,
      evidenceItems: [],
    };

    const analysis = generateFactualDisputeAnalysis(missingTrackingContext);

    assert.strictEqual(analysis.recommendedAction, "ACCEPT_CLAIM");
    assert.strictEqual(analysis.riskLevel, "HIGH");
    assert.ok(
      analysis.criticalGaps.some((g) => g.includes("CRITICAL GAP")),
      "Should identify critical gap for missing tracking"
    );
  });

  it("should recommend partial refund for SNAD claims with missing pick-pack photos", () => {
    const snadContext: DisputeContext = {
      ...baseDisputeContext,
      reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
      evidenceItems: [],
    };

    const analysis = generateFactualDisputeAnalysis(snadContext);

    assert.strictEqual(analysis.recommendedAction, "OFFER_PARTIAL_REFUND");
    assert.strictEqual(analysis.riskLevel, "MEDIUM");
    assert.ok(
      analysis.criticalGaps.some((g) => g.toLowerCase().includes("pre-shipment")),
      "Should flag missing warehouse pre-shipment photo gap"
    );
  });

  it("should enforce strict anti-hallucination compliance and reject forbidden win guarantees", () => {
    const analysis = generateFactualDisputeAnalysis(baseDisputeContext);

    // Initial analysis should pass
    const check1 = verifyCompliance(analysis, baseDisputeContext);
    assert.strictEqual(check1.passed, true);

    // Tampered analysis with forbidden guarantee phrase must be rejected
    const tamperedAnalysis = {
      ...analysis,
      rebuttalDraft: analysis.rebuttalDraft + " We guarantee a win in this case.",
    };
    const check2 = verifyCompliance(tamperedAnalysis, baseDisputeContext);
    assert.strictEqual(check2.passed, false);
    assert.ok(
      check2.violations.some((v) => v.includes("Forbidden guarantee phrase")),
      "Should catch forbidden guarantee phrase"
    );
  });

  it("should validate Zod schema structure for AI output", () => {
    const analysis = generateFactualDisputeAnalysis(baseDisputeContext);
    const parsed = DisputeAnalysisSchema.safeParse(analysis);
    assert.strictEqual(parsed.success, true, "Output must strictly conform to DisputeAnalysisSchema");
  });

  it("should execute PayPal Disputes client operations in simulation mode", async () => {
    const paypal = new PayPalDisputesClient({
      clientId: "",
      clientSecret: "",
      environment: "sandbox",
    });

    // 1. Provide Evidence
    const evidenceRes = await paypal.provideEvidence({
      disputeId: "PP-D-TEST-99",
      evidenceType: "PROOF_OF_DELIVERY",
      notes: "Test merchant rebuttal notes",
      trackingNumber: "1Z999TEST123456",
      carrierName: "UPS",
    });

    assert.strictEqual(evidenceRes.success, true);
    assert.strictEqual(evidenceRes.statusCode, 200);
    assert.strictEqual(evidenceRes.mode, "simulation");
    assert.strictEqual(evidenceRes.responsePayload.status, "UNDER_REVIEW");

    // 2. Accept Claim
    const acceptRes = await paypal.acceptClaim({
      disputeId: "PP-D-TEST-99",
      note: "Merchant authorizes refund.",
    });

    assert.strictEqual(acceptRes.success, true);
    assert.strictEqual(acceptRes.responsePayload.status, "RESOLVED");

    // 3. Make Offer
    const offerRes = await paypal.makeOffer({
      disputeId: "PP-D-TEST-99",
      note: "Offering 50% partial refund.",
      offerAmount: "94.75",
    });

    assert.strictEqual(offerRes.success, true);
    assert.strictEqual(offerRes.responsePayload.status, "WAITING_FOR_BUYER");
  });
});
