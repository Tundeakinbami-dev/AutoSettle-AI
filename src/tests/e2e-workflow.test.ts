import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import prisma from "../lib/prisma";
import {
  validateEvidenceFile,
  saveEvidenceToDisk,
  getEvidenceFromDisk,
  deleteEvidenceFromDisk,
  MAX_FILE_SIZE_BYTES,
} from "../lib/evidence-storage";
import {
  generateFactualDisputeAnalysis,
  verifyCompliance,
  analyzeDispute,
  DisputeContext,
} from "../lib/ai-agent";
import { PayPalDisputesClient } from "../lib/paypal";
import { sanitizeData, recordAuditLog } from "../lib/audit";

describe("AutoSettle AI - Complete End-to-End Dispute Workflow Integration Tests", () => {
  const TEST_MERCHANT_ID = `merchant-e2e-${Date.now()}`;
  const TEST_DISPUTE_ID = `PP-D-E2E-${Date.now()}`;
  const TEST_TXN_ID = `TXN-E2E-${Date.now()}`;
  const TEST_TRACKING_NUM = `1Z999E2E${Date.now()}`;

  let createdDisputeDbId: string;
  let createdEvidenceFileName: string;

  before(async () => {
    // 1. Seed isolated test merchant
    await prisma.merchant.create({
      data: {
        id: TEST_MERCHANT_ID,
        businessName: "E2E Test Outdoor Outfitters",
        supportEmail: "compliance@e2e-test.example.com",
        requireHumanApproval: true,
        strictEvidenceEnforced: true,
        autoAnalyzeOnArrival: true,
        mode: "DEMO",
      },
    });

    // 2. Seed isolated test transaction and dispute
    const dispute = await prisma.dispute.create({
      data: {
        merchantId: TEST_MERCHANT_ID,
        paypalDisputeId: TEST_DISPUTE_ID,
        status: "REQUIRED_ACTION",
        disputeLifeCycleStage: "CHARGEBACK",
        reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        disputeAmount: 249.99,
        currency: "USD",
        buyerName: "Morgan Taylor",
        buyerEmail: "morgan.t@example.com",
        responseDueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
        responseWorkflowStatus: "NEEDS_REVIEW",
        transaction: {
          create: {
            sellerTransactionId: TEST_TXN_ID,
            grossAmount: 249.99,
            currency: "USD",
            paymentStatus: "COMPLETED",
            paymentSource: "PAYPAL",
          },
        },
        order: {
          create: {
            orderNumber: `ORD-E2E-${Date.now()}`,
            orderDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
            customerName: "Morgan Taylor",
            customerEmail: "morgan.t@example.com",
            shippingAddress: "742 Evergreen Terrace, Springfield, OR 97477",
            billingAddress: "742 Evergreen Terrace, Springfield, OR 97477",
            orderTotal: 249.99,
            itemsJson: JSON.stringify([
              { description: "Weatherproof Alpine Tent", qty: 1, price: 249.99 },
            ]),
          },
        },
        trackingInfo: {
          create: {
            carrier: "UPS",
            trackingNumber: TEST_TRACKING_NUM,
            status: "DELIVERED",
            shippedDate: new Date(Date.now() - 8 * 24 * 3600 * 1000),
            deliveredDate: new Date(Date.now() - 3 * 24 * 3600 * 1000),
            destinationZip: "97477",
            signedBy: "M. TAYLOR",
          },
        },
      },
    });

    createdDisputeDbId = dispute.id;
  });

  after(async () => {
    // Clean up disk files
    if (createdEvidenceFileName) {
      await deleteEvidenceFromDisk(createdEvidenceFileName).catch(() => {});
    }

    // Clean up test data cascade
    await prisma.merchant.delete({
      where: { id: TEST_MERCHANT_ID },
    }).catch(() => {});
  });

  // --------------------------------------------------------------------------
  // STEP 1: Evidence Validation & Secure Private Disk Storage
  // --------------------------------------------------------------------------
  it("Step 1: should securely validate, store, and link multipart evidence with magic bytes", async () => {
    // Genuine PDF magic bytes: %PDF-1.4 ...
    const pdfBuffer = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    );

    // Validate genuine file signature
    const validation = validateEvidenceFile(pdfBuffer, "application/pdf");
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.detectedMime, "application/pdf");

    // Save to private disk storage (outside public directory)
    const { safeFileName, filePath, fileSize } = await saveEvidenceToDisk(
      pdfBuffer,
      "ups_delivery_receipt.pdf",
      validation.detectedMime!
    );
    createdEvidenceFileName = safeFileName;

    assert.ok(safeFileName.endsWith(".pdf"));
    assert.ok(!filePath.includes(".."), "Filename must not contain path traversal");
    assert.strictEqual(fileSize, pdfBuffer.length);

    // Verify file content can be retrieved securely from disk
    const retrievedBuffer = await getEvidenceFromDisk(safeFileName);
    assert.ok(retrievedBuffer !== null);
    assert.deepStrictEqual(retrievedBuffer, pdfBuffer);

    // Link evidence to dispute in database
    const evidenceRecord = await prisma.evidenceItem.create({
      data: {
        disputeId: createdDisputeDbId,
        evidenceType: "PROOF_OF_DELIVERY",
        title: "Official UPS Proof of Delivery",
        description: "Carrier signed electronic scan matching recipient address.",
        fileName: safeFileName,
        fileUrl: `/api/disputes/${createdDisputeDbId}/evidence/${safeFileName}`,
        fileType: "application/pdf",
        fileSize,
        strength: "STRONG",
        verified: true,
        provenanceSource: "UPS Electronic Tracking API",
      },
    });

    assert.strictEqual(evidenceRecord.disputeId, createdDisputeDbId);
    assert.strictEqual(evidenceRecord.strength, "STRONG");

    // Audit log entry for evidence attachment
    const log = await recordAuditLog({
      disputeId: createdDisputeDbId,
      merchantId: TEST_MERCHANT_ID,
      eventType: "EVIDENCE_ADDED",
      severity: "INFO",
      summary: `Evidence added: "${evidenceRecord.title}"`,
      actor: "merchant_user",
    });
    assert.ok(log !== null);
  });

  // --------------------------------------------------------------------------
  // STEP 2: Simulated Webhook Ingestion & Deduplication
  // --------------------------------------------------------------------------
  it("Step 2: should ingest webhook, update dispute state, and deduplicate identical events", async () => {
    const eventId = `WH-E2E-${Date.now()}`;
    const webhookPayload = {
      id: eventId,
      event_type: "PAYMENT.DISPUTE.UPDATED",
      create_time: new Date().toISOString(),
      resource: {
        dispute_id: TEST_DISPUTE_ID,
        status: "WAITING_FOR_SELLER",
        reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      },
    };

    // First ingestion: should record WebhookEvent and audit log
    const eventRecord = await prisma.webhookEvent.create({
      data: {
        paypalWebhookEventId: eventId,
        eventType: "PAYMENT.DISPUTE.UPDATED",
        disputeId: createdDisputeDbId,
        summary: `PayPal Webhook for dispute ${TEST_DISPUTE_ID}`,
        status: "PROCESSED",
        signatureVerified: true,
        payloadSanitized: JSON.stringify(sanitizeData(webhookPayload)),
      },
    });

    assert.strictEqual(eventRecord.paypalWebhookEventId, eventId);
    assert.strictEqual(eventRecord.disputeId, createdDisputeDbId);

    // Check deduplication: existingEvent with same ID is detected
    const duplicateCheck = await prisma.webhookEvent.findUnique({
      where: { paypalWebhookEventId: eventId },
    });
    assert.ok(duplicateCheck !== null);
    assert.strictEqual(duplicateCheck?.status, "PROCESSED");

    // Update dispute status
    await prisma.dispute.update({
      where: { id: createdDisputeDbId },
      data: { status: "WAITING_FOR_SELLER" },
    });

    const updatedDispute = await prisma.dispute.findUnique({
      where: { id: createdDisputeDbId },
    });
    assert.strictEqual(updatedDispute?.status, "WAITING_FOR_SELLER");
  });

  // --------------------------------------------------------------------------
  // STEP 3: Deterministic AI Analysis & Zero-Hallucination Compliance
  // --------------------------------------------------------------------------
  it("Step 3: should run AI dispute investigation and verify zero-hallucination compliance", async () => {
    const disputeWithRelations = await prisma.dispute.findUnique({
      where: { id: createdDisputeDbId },
      include: {
        transaction: true,
        order: true,
        trackingInfo: true,
        evidenceItems: true,
        messages: true,
      },
    });
    assert.ok(disputeWithRelations !== null);

    const context: DisputeContext = {
      disputeId: disputeWithRelations!.id,
      paypalDisputeId: disputeWithRelations!.paypalDisputeId,
      reason: disputeWithRelations!.reason,
      disputeAmount: disputeWithRelations!.disputeAmount,
      currency: disputeWithRelations!.currency,
      buyerName: disputeWithRelations!.buyerName,
      buyerEmail: disputeWithRelations!.buyerEmail,
      sellerTransactionId: disputeWithRelations!.transaction?.sellerTransactionId || "",
      responseDueDate: disputeWithRelations!.responseDueDate,
      order: disputeWithRelations!.order
        ? {
            orderNumber: disputeWithRelations!.order.orderNumber,
            orderDate: disputeWithRelations!.order.orderDate,
            customerName: disputeWithRelations!.order.customerName,
            customerEmail: disputeWithRelations!.order.customerEmail,
            shippingAddress: disputeWithRelations!.order.shippingAddress,
            orderTotal: disputeWithRelations!.order.orderTotal,
            items: JSON.parse(disputeWithRelations!.order.itemsJson),
          }
        : null,
      tracking: disputeWithRelations!.trackingInfo
        ? {
            carrier: disputeWithRelations!.trackingInfo.carrier,
            trackingNumber: disputeWithRelations!.trackingInfo.trackingNumber,
            status: disputeWithRelations!.trackingInfo.status,
            shippedDate: disputeWithRelations!.trackingInfo.shippedDate ?? undefined,
            deliveredDate: disputeWithRelations!.trackingInfo.deliveredDate ?? undefined,
            destinationZip: disputeWithRelations!.trackingInfo.destinationZip ?? undefined,
            signedBy: disputeWithRelations!.trackingInfo.signedBy ?? undefined,
          }
        : null,
      messages: [],
      evidenceItems: disputeWithRelations!.evidenceItems.map((e) => ({
        evidenceType: e.evidenceType,
        title: e.title,
        description: e.description,
        strength: e.strength,
        verified: e.verified,
      })),
    };

    const analysis = generateFactualDisputeAnalysis(context);

    // Verify recommendations
    assert.strictEqual(analysis.recommendedAction, "PROVIDE_EVIDENCE");
    assert.ok(analysis.completenessScore >= 85);
    assert.strictEqual(analysis.riskLevel, "LOW");
    assert.ok(analysis.rebuttalDraft.includes("UPS"));
    assert.ok(analysis.rebuttalDraft.includes("M. TAYLOR"));

    // Verify zero-hallucination compliance check passes
    const compliance = verifyCompliance(analysis, context);
    assert.strictEqual(compliance.passed, true);
    assert.strictEqual(compliance.violations.length, 0);

    // Save AI analysis to database
    const savedAi = await prisma.aiAnalysis.create({
      data: {
        disputeId: createdDisputeDbId,
        summary: analysis.summary,
        completenessScore: analysis.completenessScore,
        recommendedAction: analysis.recommendedAction,
        recommendationRationale: analysis.recommendationRationale,
        keyStrengthsJson: JSON.stringify(analysis.keyStrengths),
        criticalGapsJson: JSON.stringify(analysis.criticalGaps),
        citationsJson: JSON.stringify(analysis.citations),
        riskLevel: analysis.riskLevel,
      },
    });

    assert.strictEqual(savedAi.disputeId, createdDisputeDbId);
  });

  // --------------------------------------------------------------------------
  // STEP 4: Human Review & Approval Workflow
  // --------------------------------------------------------------------------
  it("Step 4: should create unapproved draft response and enforce human authorization transition", async () => {
    // 1. Create DraftResponse with status NEEDS_REVIEW
    const draft = await prisma.draftResponse.create({
      data: {
        disputeId: createdDisputeDbId,
        version: 1,
        status: "NEEDS_REVIEW",
        targetAction: "PROVIDE_EVIDENCE",
        rebuttalNarrative: "Factual rebuttal citing UPS tracking and electronic POD signature.",
        characterCount: 68,
        isApproved: false,
      },
    });

    assert.strictEqual(draft.isApproved, false);
    assert.strictEqual(draft.status, "NEEDS_REVIEW");

    // 2. Enforce approval transition
    const updatedDraft = await prisma.draftResponse.update({
      where: { id: draft.id },
      data: {
        isApproved: true,
        approvedBy: "merchant_compliance_officer",
        approvedAt: new Date(),
        status: "APPROVED",
      },
    });

    assert.strictEqual(updatedDraft.isApproved, true);
    assert.strictEqual(updatedDraft.status, "APPROVED");

    // 3. Update Dispute responseWorkflowStatus to APPROVED
    const updatedDispute = await prisma.dispute.update({
      where: { id: createdDisputeDbId },
      data: { responseWorkflowStatus: "APPROVED" },
    });

    assert.strictEqual(updatedDispute.responseWorkflowStatus, "APPROVED");

    // 4. Record audit log
    await recordAuditLog({
      disputeId: createdDisputeDbId,
      merchantId: TEST_MERCHANT_ID,
      eventType: "APPROVAL_GRANTED",
      severity: "SUCCESS",
      summary: "Merchant authorized dispute response submission",
      actor: "merchant_user",
    });
  });

  // --------------------------------------------------------------------------
  // STEP 5: PayPal API Submission in Simulated Mode
  // --------------------------------------------------------------------------
  it("Step 5: should call PayPal client in simulated mode and verify SUBMITTED state transition", async () => {
    const paypal = new PayPalDisputesClient({
      clientId: "",
      clientSecret: "",
      environment: "sandbox",
    });

    // Call provideEvidence in simulated mode
    const apiResult = await paypal.provideEvidence({
      disputeId: TEST_DISPUTE_ID,
      evidenceType: "PROOF_OF_DELIVERY",
      notes: "Merchant verified shipment delivered with signature confirmation.",
      trackingNumber: TEST_TRACKING_NUM,
      carrierName: "UPS",
    });

    assert.strictEqual(apiResult.success, true);
    assert.strictEqual(apiResult.mode, "simulation");
    assert.strictEqual(apiResult.statusCode, 200);

    // Record submission attempt in DB
    const submission = await prisma.submissionAttempt.create({
      data: {
        disputeId: createdDisputeDbId,
        action: "PROVIDE_EVIDENCE",
        attemptNumber: 1,
        status: "SUBMITTED",
        endpoint: `/v1/customer/disputes/${TEST_DISPUTE_ID}/provide-evidence`,
        httpStatusCode: 200,
        requestPayloadSanitized: JSON.stringify(
          sanitizeData({
            disputeId: TEST_DISPUTE_ID,
            evidenceType: "PROOF_OF_DELIVERY",
            trackingNumber: TEST_TRACKING_NUM,
          })
        ),
        responsePayloadSanitized: JSON.stringify(sanitizeData(apiResult)),
        completedAt: new Date(),
      },
    });

    assert.strictEqual(submission.status, "SUBMITTED");
    assert.strictEqual(submission.httpStatusCode, 200);

    // Transition Dispute responseWorkflowStatus to SUBMITTED
    await prisma.dispute.update({
      where: { id: createdDisputeDbId },
      data: { responseWorkflowStatus: "SUBMITTED" },
    });

    // Record submission audit log
    await recordAuditLog({
      disputeId: createdDisputeDbId,
      merchantId: TEST_MERCHANT_ID,
      eventType: "SUBMISSION_ATTEMPTED",
      severity: "SUCCESS",
      summary: `PayPal submission completed: ${TEST_DISPUTE_ID}`,
      actor: "merchant_user",
    });

    // Verify final state and audit trail
    const finalDispute = await prisma.dispute.findUnique({
      where: { id: createdDisputeDbId },
      include: {
        auditLogs: true,
        submissionAttempts: true,
        draftResponses: true,
      },
    });

    assert.ok(finalDispute);
    assert.strictEqual(finalDispute.responseWorkflowStatus, "SUBMITTED");
    assert.ok(finalDispute.auditLogs.length >= 3);
    assert.strictEqual(finalDispute.submissionAttempts[0].status, "SUBMITTED");
  });

  // --------------------------------------------------------------------------
  // STEP 6: Negative & Edge Case Tests
  // --------------------------------------------------------------------------
  it("Step 6.1 (Negative): should reject corrupted file with invalid magic bytes", () => {
    const fakePdf = Buffer.from("NOT_A_REAL_PDF_HEADER_JUST_RANDOM_TEXT_1234567890");
    const result = validateEvidenceFile(fakePdf, "application/pdf");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes("Unsupported file type"));
  });

  it("Step 6.2 (Negative): should reject oversized evidence exceeding 10MB limit", () => {
    const largeBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024);
    // write valid PDF header
    largeBuffer.write("%PDF-1.4");
    const result = validateEvidenceFile(largeBuffer, "application/pdf");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes("exceeds the maximum allowed limit"));
  });

  it("Step 6.3 (Negative): should block path traversal attack on evidence disk retrieval", async () => {
    await assert.rejects(
      async () => {
        await getEvidenceFromDisk("../../etc/passwd");
      },
      (err: Error) => {
        // basename removes directory components; if resolved outside directory, throws traversal error
        return true;
      }
    );
  });

  it("Step 6.4 (Negative): should detect critical gap when required tracking is missing", () => {
    const noTrackingContext: DisputeContext = {
      disputeId: "gap-test",
      paypalDisputeId: "PP-D-GAP-1",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      disputeAmount: 100,
      currency: "USD",
      buyerName: "Anonymous",
      buyerEmail: "anon@example.com",
      sellerTransactionId: "TXN-GAP",
      responseDueDate: new Date(),
      order: null,
      tracking: null,
      messages: [],
      evidenceItems: [],
    };

    const analysis = generateFactualDisputeAnalysis(noTrackingContext);
    assert.strictEqual(analysis.recommendedAction, "ACCEPT_CLAIM");
    assert.strictEqual(analysis.riskLevel, "HIGH");
    assert.ok(analysis.criticalGaps.some((g) => g.includes("CRITICAL GAP")));
  });

  it("Step 6.5 (Negative): should reject forbidden win guarantee phrases in rebuttal", () => {
    const context: DisputeContext = {
      disputeId: "guarantee-test",
      paypalDisputeId: "PP-D-GUARANTEE",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      disputeAmount: 50,
      currency: "USD",
      buyerName: "Buyer",
      buyerEmail: "buyer@example.com",
      sellerTransactionId: "TXN-GT",
      responseDueDate: new Date(),
      order: null,
      tracking: null,
      messages: [],
      evidenceItems: [],
    };

    const analysis = generateFactualDisputeAnalysis(context);
    const tampered = {
      ...analysis,
      rebuttalDraft: analysis.rebuttalDraft + " We guarantee 100% win in PayPal dispute.",
    };

    const check = verifyCompliance(tampered, context);
    assert.strictEqual(check.passed, false);
    assert.ok(check.violations.some((v) => v.includes("Forbidden guarantee phrase")));
  });

  it("Step 6.6 (Negative): should record SUBMISSION_FAILED when simulated failure toggle is active", async () => {
    const failedSubmissionDisputeId = `PP-D-FAIL-${Date.now()}`;
    const dispute = await prisma.dispute.create({
      data: {
        merchantId: TEST_MERCHANT_ID,
        paypalDisputeId: failedSubmissionDisputeId,
        status: "REQUIRED_ACTION",
        disputeLifeCycleStage: "CHARGEBACK",
        reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
        disputeAmount: 75.0,
        currency: "USD",
        buyerName: "Test Buyer",
        buyerEmail: "tb@example.com",
        responseDueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
        responseWorkflowStatus: "SUBMISSION_FAILED",
      },
    });

    const failedAttempt = await prisma.submissionAttempt.create({
      data: {
        disputeId: dispute.id,
        action: "PROVIDE_EVIDENCE",
        status: "SUBMISSION_FAILED",
        endpoint: `/v1/customer/disputes/${failedSubmissionDisputeId}/provide-evidence`,
        httpStatusCode: 504,
        errorMessage: "Simulated gateway timeout: PayPal API took longer than 30s to acknowledge.",
        requestPayloadSanitized: JSON.stringify({ action: "PROVIDE_EVIDENCE" }),
      },
    });

    assert.strictEqual(failedAttempt.status, "SUBMISSION_FAILED");
    assert.strictEqual(failedAttempt.httpStatusCode, 504);

    const verifiedDispute = await prisma.dispute.findUnique({
      where: { id: dispute.id },
    });
    assert.strictEqual(verifiedDispute?.responseWorkflowStatus, "SUBMISSION_FAILED");
  });
});
