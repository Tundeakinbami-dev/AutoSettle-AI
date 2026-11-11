import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import prisma from "../lib/prisma";
import { PayPalDisputesClient, isPlaceholderCredential } from "../lib/paypal";
import { POST as submitPayPalHandler } from "../app/api/disputes/[id]/submit-paypal/route";
import { GET as getDisputeHandler } from "../app/api/disputes/[id]/route";
import { NextRequest } from "next/server";

describe("AutoSettle AI - PayPal Simulation Safety & Execution Mode Tests", () => {
  const TEST_DISPUTE_ID = `PP-D-SAFETY-${Date.now()}`;
  let testDisputeDbId: string;
  let testDraftId: string;

  // Intercept global fetch to strictly monitor external network requests
  const originalFetch = globalThis.fetch;
  let externalFetchCallCount = 0;
  let interceptedUrls: string[] = [];

  before(async () => {
    // Install global network spy
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || input?.href || "";
      if (url.includes("paypal.com") || url.includes("sandbox.paypal")) {
        externalFetchCallCount++;
        interceptedUrls.push(url);
      }
      return originalFetch(input, init);
    }) as any;

    // Seed test dispute with approved draft for submission testing
    const dispute = await prisma.dispute.create({
      data: {
        merchantId: "default_merchant",
        paypalDisputeId: TEST_DISPUTE_ID,
        status: "REQUIRED_ACTION",
        disputeLifeCycleStage: "CHARGEBACK",
        reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        disputeAmount: 185.00,
        currency: "USD",
        buyerName: "Morgan Compliance",
        buyerEmail: "m.compliance@example.com",
        responseDueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
        responseWorkflowStatus: "APPROVED", // Approved, ready for submission
        draftResponses: {
          create: {
            version: 1,
            status: "APPROVED",
            targetAction: "PROVIDE_EVIDENCE",
            rebuttalNarrative: "Factual rebuttal certified and approved by compliance.",
            characterCount: 56,
            isApproved: true,
            approvedBy: "merchant_compliance_reviewer",
            approvedAt: new Date(),
          },
        },
      },
      include: { draftResponses: true },
    });

    testDisputeDbId = dispute.id;
    testDraftId = dispute.draftResponses[0].id;

    // Ensure dispute PP-D-25182 exists in APPROVED state for demonstration and testing
    const existing25182 = await prisma.dispute.findUnique({
      where: { paypalDisputeId: "PP-D-25182" },
      include: { draftResponses: true, submissionAttempts: true },
    });

    if (!existing25182) {
      await prisma.dispute.create({
        data: {
          merchantId: "default_merchant",
          paypalDisputeId: "PP-D-25182",
          status: "REQUIRED_ACTION",
          disputeLifeCycleStage: "CHARGEBACK",
          reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
          disputeAmount: 145.00,
          currency: "USD",
          buyerName: "Elena Rostova",
          buyerEmail: "elena.rostova@example.com",
          responseDueDate: new Date(Date.now() + 6 * 24 * 3600 * 1000),
          responseWorkflowStatus: "APPROVED",
          draftResponses: {
            create: {
              version: 1,
              status: "APPROVED",
              targetAction: "PROVIDE_EVIDENCE",
              rebuttalNarrative: "To PayPal Disputes Team: The merchandise for order #AG-25182 was delivered via FedEx tracking #794829104812 with signature confirmation by E. Rostova.",
              characterCount: 156,
              isApproved: true,
              approvedBy: "merchant_compliance_reviewer",
              approvedAt: new Date(),
            },
          },
        },
      });
    }

    // Ensure dispute PP-D-47237 exists in APPROVED state for demonstration and testing
    const existing47237 = await prisma.dispute.findUnique({
      where: { paypalDisputeId: "PP-D-47237" },
      include: { draftResponses: true, submissionAttempts: true },
    });

    if (!existing47237) {
      await prisma.dispute.create({
        data: {
          merchantId: "default_merchant",
          paypalDisputeId: "PP-D-47237",
          status: "REQUIRED_ACTION",
          disputeLifeCycleStage: "CHARGEBACK",
          reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
          disputeAmount: 195.00,
          currency: "USD",
          buyerName: "Zachary Taylor",
          buyerEmail: "z.taylor@example.com",
          responseDueDate: new Date(Date.now() + 6 * 24 * 3600 * 1000),
          responseWorkflowStatus: "APPROVED",
          draftResponses: {
            create: {
              version: 1,
              status: "APPROVED",
              targetAction: "PROVIDE_EVIDENCE",
              rebuttalNarrative: "Factual rebuttal certified and approved by compliance reviewer for order AG-95290.",
              characterCount: 84,
              isApproved: true,
              approvedBy: "merchant_compliance_reviewer",
              approvedAt: new Date(),
            },
          },
        },
      });
    }
  });

  after(async () => {
    // Restore original global fetch
    globalThis.fetch = originalFetch;

    // Cleanup test records
    await prisma.dispute.delete({
      where: { id: testDisputeDbId },
    }).catch(() => {});
  });

  // -------------------------------------------------------------------------
  // Test 1: Placeholder Recognition
  // -------------------------------------------------------------------------
  it("1. should recognize placeholder credentials and never treat them as valid", () => {
    assert.strictEqual(isPlaceholderCredential("YOUR_PAYPAL_CLIENT_ID"), true);
    assert.strictEqual(isPlaceholderCredential("YOUR_PAYPAL_CLIENT_SECRET"), true);
    assert.strictEqual(isPlaceholderCredential("YOUR_PAYPAL_SANDBOX_CLIENT_ID"), true);
    assert.strictEqual(isPlaceholderCredential(""), true);
    assert.strictEqual(isPlaceholderCredential("   "), true);
    assert.strictEqual(isPlaceholderCredential(null), true);
    assert.strictEqual(isPlaceholderCredential("PLACEHOLDER_KEY"), true);
    assert.strictEqual(isPlaceholderCredential("TEST_CLIENT_KEY"), true);
    assert.strictEqual(isPlaceholderCredential("MOCK_SECRET"), true);

    // Legitimate credential format should not match placeholder
    assert.strictEqual(isPlaceholderCredential("A21AAI_REAL_CLIENT_ID_9876543210"), false);
  });

  // -------------------------------------------------------------------------
  // Test 2: Internal simulation with placeholder credentials makes ZERO external requests
  // -------------------------------------------------------------------------
  it("2. Internal simulation with placeholder credentials makes zero external requests", async () => {
    externalFetchCallCount = 0;
    interceptedUrls = [];

    const client = new PayPalDisputesClient({
      clientId: "YOUR_PAYPAL_SANDBOX_CLIENT_ID",
      clientSecret: "YOUR_PAYPAL_SANDBOX_CLIENT_SECRET",
      environment: "sandbox",
    });

    assert.strictEqual(client.mode, "INTERNAL_SIMULATION");
    assert.strictEqual(client.isSimulation, true);
    assert.strictEqual(client.isLiveConfigured, false);

    const token = await client.getAccessToken();
    assert.ok(token.startsWith("simulated_"));

    const result = await client.provideEvidence({
      disputeId: "PP-D-TEST-SIM-1",
      evidenceType: "PROOF_OF_DELIVERY",
      notes: "Testing zero external requests with placeholder credentials",
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.executionMode, "INTERNAL_SIMULATION");
    assert.strictEqual(result.statusCode, 200);

    // ZERO external PayPal calls made
    assert.strictEqual(
      externalFetchCallCount,
      0,
      `Expected 0 external fetch calls, but detected ${externalFetchCallCount}: ${interceptedUrls.join(", ")}`
    );
  });

  // -------------------------------------------------------------------------
  // Test 3: Internal simulation with apparently valid credentials still makes ZERO external requests
  // -------------------------------------------------------------------------
  it("3. Internal simulation with apparently valid credentials still makes zero external requests when isSimulation is set", async () => {
    externalFetchCallCount = 0;
    interceptedUrls = [];

    const client = new PayPalDisputesClient({
      clientId: "A21AAI_GENUINE_LOOKING_SANDBOX_ID_12345",
      clientSecret: "GENUINE_LOOKING_SECRET_KEY_987654321",
      environment: "sandbox",
      isSimulation: true, // Explicit simulation override
    });

    assert.strictEqual(client.mode, "INTERNAL_SIMULATION");
    assert.strictEqual(client.isSimulation, true);

    const token = await client.getAccessToken();
    assert.ok(token.startsWith("simulated_"));

    const result = await client.provideEvidence({
      disputeId: "PP-D-TEST-SIM-2",
      evidenceType: "PROOF_OF_DELIVERY",
      notes: "Testing zero external requests with valid credentials in simulation mode",
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.executionMode, "INTERNAL_SIMULATION");
    assert.strictEqual(result.statusCode, 200);

    // ZERO external PayPal calls made
    assert.strictEqual(
      externalFetchCallCount,
      0,
      `Expected 0 external fetch calls, but detected ${externalFetchCallCount}`
    );
  });

  // -------------------------------------------------------------------------
  // Test 4: Failure toggle intercepts before client invocation
  // -------------------------------------------------------------------------
  it("4. Failure toggle intercepts before client invocation without contacting PayPal", async () => {
    externalFetchCallCount = 0;
    interceptedUrls = [];

    const req = new NextRequest(`http://localhost:3000/api/disputes/${testDisputeDbId}/submit-paypal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "PROVIDE_EVIDENCE",
        authorizedByMerchant: true,
        simulateError: true, // Failure toggle active
      }),
    });

    const res = await submitPayPalHandler(req, { params: { id: testDisputeDbId } });
    assert.strictEqual(res.status, 400);

    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.workflowStatus, "SUBMISSION_FAILED");
    assert.strictEqual(json.mode, "INTERNAL_SIMULATION");

    // ZERO external calls
    assert.strictEqual(externalFetchCallCount, 0, "Failure toggle must never make external calls");
  });

  // -------------------------------------------------------------------------
  // Test 5: Simulated failure updates database correctly and preserves draft approval
  // -------------------------------------------------------------------------
  it("5. Simulated failure updates database correctly and preserves draft.isApproved=true for retry", async () => {
    const disp = await prisma.dispute.findUnique({
      where: { id: testDisputeDbId },
      include: { draftResponses: true, submissionAttempts: true },
    });

    assert.ok(disp);
    assert.strictEqual(disp.responseWorkflowStatus, "SUBMISSION_FAILED");

    // CRITICAL: Draft approval MUST NOT be wiped out so the merchant can retry submission
    assert.strictEqual(
      disp.draftResponses[0].isApproved,
      true,
      "Draft approval must remain true after failed submission to allow retry"
    );

    // Verify submission attempt record
    const latestAttempt = disp.submissionAttempts[0];
    assert.ok(latestAttempt);
    assert.strictEqual(latestAttempt.status, "SUBMISSION_FAILED");
    assert.strictEqual(latestAttempt.httpStatusCode, 400);

    // Verify audit log
    const audit = await prisma.auditLogEntry.findFirst({
      where: { disputeId: testDisputeDbId, eventType: "SUBMISSION_FAILED" },
      orderBy: { timestamp: "desc" },
    });
    assert.ok(audit);
    assert.strictEqual(audit.severity, "ERROR");
  });

  // -------------------------------------------------------------------------
  // Test 6: Simulated success updates database and audit records correctly
  // -------------------------------------------------------------------------
  it("6. Simulated success updates database and audit records correctly", async () => {
    externalFetchCallCount = 0;
    interceptedUrls = [];

    // Re-verify dispute is ready for submission (simulateError: false)
    const req = new NextRequest(`http://localhost:3000/api/disputes/${testDisputeDbId}/submit-paypal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "PROVIDE_EVIDENCE",
        authorizedByMerchant: true,
        simulateError: false,
      }),
    });

    const res = await submitPayPalHandler(req, { params: { id: testDisputeDbId } });
    assert.strictEqual(res.status, 200, "Submission should return HTTP 200");

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.workflowStatus, "SUBMITTED");
    assert.strictEqual(json.mode, "INTERNAL_SIMULATION");

    // ZERO external requests
    assert.strictEqual(externalFetchCallCount, 0, "Simulation mode must make zero external requests");

    // Verify database updates
    const updatedDispute = await prisma.dispute.findUnique({
      where: { id: testDisputeDbId },
      include: { draftResponses: true, submissionAttempts: { orderBy: { attemptedAt: "desc" } } },
    });

    assert.ok(updatedDispute);
    assert.strictEqual(updatedDispute.responseWorkflowStatus, "SUBMITTED");
    assert.strictEqual(updatedDispute.status, "UNDER_REVIEW");
    assert.strictEqual(updatedDispute.draftResponses[0].status, "SUBMITTED");
    assert.strictEqual(updatedDispute.submissionAttempts[0].status, "SUBMITTED");

    // Verify Audit Trail records mode
    const successAudit = await prisma.auditLogEntry.findFirst({
      where: { disputeId: testDisputeDbId, eventType: "API_RESULT_RECEIVED" },
      orderBy: { timestamp: "desc" },
    });
    assert.ok(successAudit);
    assert.strictEqual(successAudit.severity, "SUCCESS");
    assert.ok(successAudit.summary.startsWith("[SIMULATED]"));
    assert.ok(successAudit.detailsJson?.includes("INTERNAL_SIMULATION"));
  });

  // -------------------------------------------------------------------------
  // Test 7: Duplicate submissions are rejected or safely handled
  // -------------------------------------------------------------------------
  it("7. Duplicate submissions are rejected with HTTP 409 Conflict", async () => {
    // Calling submit again on already SUBMITTED dispute
    const dupReq = new NextRequest(`http://localhost:3000/api/disputes/${testDisputeDbId}/submit-paypal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "PROVIDE_EVIDENCE",
        authorizedByMerchant: true,
      }),
    });

    const dupRes = await submitPayPalHandler(dupReq, { params: { id: testDisputeDbId } });
    assert.strictEqual(dupRes.status, 409, "Duplicate submission must return HTTP 409 Conflict");

    const json = await dupRes.json();
    assert.strictEqual(json.success, false);
    assert.ok(json.error.includes("already been submitted"));
  });

  // -------------------------------------------------------------------------
  // Test 8: Live mode is blocked in DEMO/HACKATHON mode
  // -------------------------------------------------------------------------
  it("8. Live mode is strictly blocked in DEMO/HACKATHON mode", () => {
    // In DEMO mode, attempting to construct PAYPAL_LIVE must throw
    const originalAppMode = process.env.APP_MODE;
    try {
      process.env.APP_MODE = "DEMO";

      assert.throws(
        () => {
          new PayPalDisputesClient({
            clientId: "GENUINE_LOOKING_KEY_12345678",
            clientSecret: "GENUINE_LOOKING_SECRET_98765432",
            environment: "live",
            forceMode: "PAYPAL_LIVE",
          });
        },
        /prohibited/i,
        "Should throw error prohibiting PAYPAL_LIVE in DEMO mode"
      );
    } finally {
      process.env.APP_MODE = originalAppMode;
    }
  });

  // -------------------------------------------------------------------------
  // Test 9: Refreshing dispute page via GET preserves correct submission state
  // -------------------------------------------------------------------------
  it("9. Refreshing dispute page via GET preserves correct submission state", async () => {
    const req = new NextRequest(`http://localhost:3000/api/disputes/${testDisputeDbId}`);
    const res = await getDisputeHandler(req, { params: { id: testDisputeDbId } });
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.dispute.responseWorkflowStatus, "SUBMITTED");
    assert.strictEqual(json.dispute.draftResponses[0].status, "SUBMITTED");
    assert.strictEqual(json.dispute.draftResponses[0].isApproved, true);
    assert.strictEqual(json.executionMode, "INTERNAL_SIMULATION");
    assert.strictEqual(json.isSimulation, true);
    assert.strictEqual(json.dispute.executionMode, "INTERNAL_SIMULATION");
    assert.strictEqual(json.dispute.isSimulation, true);
  });

  // -------------------------------------------------------------------------
  // Test 10: Confirmation that PP-D-25182 remains APPROVED and NOT submitted
  // -------------------------------------------------------------------------
  it("10. Verify dispute PP-D-25182 remains intact in APPROVED state without submission", async () => {
    const dispute25182 = await prisma.dispute.findUnique({
      where: { paypalDisputeId: "PP-D-25182" },
      include: { draftResponses: true, submissionAttempts: true },
    });

    assert.ok(dispute25182, "Dispute PP-D-25182 must exist");
    assert.strictEqual(
      dispute25182.responseWorkflowStatus,
      "APPROVED",
      "PP-D-25182 must remain in APPROVED state"
    );
    assert.strictEqual(
      dispute25182.draftResponses[0].isApproved,
      true,
      "PP-D-25182 draft must remain approved"
    );
    assert.strictEqual(
      dispute25182.submissionAttempts.length,
      0,
      "PP-D-25182 must have zero submission attempts"
    );
  });

  // -------------------------------------------------------------------------
  // Test 11: PP-D-47237 Submission Screen Inspection & Zero Request Safety
  // -------------------------------------------------------------------------
  it("11. Verify dispute PP-D-47237 reflects INTERNAL_SIMULATION and remains intact without submission", async () => {
    // 1. Fetch dispute PP-D-47237 through the backend API route
    const dispute47237 = await prisma.dispute.findUnique({
      where: { paypalDisputeId: "PP-D-47237" },
      include: { draftResponses: true, submissionAttempts: true },
    });
    assert.ok(dispute47237, "Dispute PP-D-47237 must exist in database");

    const req = new NextRequest(`http://localhost:3000/api/disputes/${dispute47237.id}`);
    const res = await getDisputeHandler(req, { params: { id: dispute47237.id } });
    assert.strictEqual(res.status, 200, "GET /api/disputes/PP-D-47237 should return HTTP 200");

    const json = await res.json();
    assert.strictEqual(json.success, true);

    // 2. Execution mode reflects actual backend mode, NOT merely a frontend label
    assert.strictEqual(
      json.executionMode,
      "INTERNAL_SIMULATION",
      "Authoritative backend execution mode must be INTERNAL_SIMULATION"
    );
    assert.strictEqual(
      json.isSimulation,
      true,
      "Authoritative backend isSimulation must be true"
    );
    assert.strictEqual(
      json.dispute.executionMode,
      "INTERNAL_SIMULATION",
      "Dispute object payload must include executionMode: INTERNAL_SIMULATION"
    );
    assert.strictEqual(
      json.dispute.isSimulation,
      true,
      "Dispute object payload must include isSimulation: true"
    );

    // 3. Confirm PP-D-47237 was NOT submitted and remains APPROVED
    assert.strictEqual(
      json.dispute.responseWorkflowStatus,
      "APPROVED",
      "PP-D-47237 responseWorkflowStatus must remain APPROVED"
    );
    assert.strictEqual(
      json.dispute.draftResponses[0].isApproved,
      true,
      "PP-D-47237 draft must remain approved"
    );
    assert.strictEqual(
      json.dispute.submissionAttempts.length,
      0,
      "PP-D-47237 must have 0 submission attempts"
    );

    // 4. Confirm ZERO external network requests were made during inspection
    assert.strictEqual(
      externalFetchCallCount,
      0,
      "Inspection of PP-D-47237 must make ZERO external requests to PayPal"
    );
  });
});
