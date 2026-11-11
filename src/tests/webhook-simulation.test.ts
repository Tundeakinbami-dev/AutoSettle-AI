import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import prisma from "../lib/prisma";
import { ingestDisputeWebhook } from "../lib/dispute-ingestion";
import { POST as simulateHandler } from "../app/api/webhooks/simulate/route";
import { POST as paypalHandler } from "../app/api/webhooks/paypal/route";
import { NextRequest } from "next/server";

describe("AutoSettle AI - Webhook Simulator & PayPal Security Verification Tests", () => {
  const TEST_SIM_EVENT_ID = `WH-SIM-TEST-${Date.now()}`;
  const TEST_DISPUTE_ID = `PP-D-SIM-${Date.now()}`;
  const TEST_TXN_ID = `TXN-SIM-${Date.now()}`;

  before(async () => {
    // Ensure default merchant exists and is configured for demo/simulation
    await prisma.merchant.upsert({
      where: { id: "default_merchant" },
      create: {
        id: "default_merchant",
        businessName: "AutoSettle Demo Store",
        supportEmail: "support@autosettle.demo",
        mode: "DEMO",
        autoAnalyzeOnArrival: true,
        requireHumanApproval: true,
      },
      update: {
        mode: "DEMO",
      },
    });
  });

  after(async () => {
    // Clean up test dispute if created
    const disp = await prisma.dispute.findUnique({
      where: { paypalDisputeId: TEST_DISPUTE_ID },
    });
    if (disp) {
      await prisma.dispute.delete({ where: { id: disp.id } }).catch(() => {});
    }

    // Clean up simulated webhook event
    await prisma.webhookEvent.deleteMany({
      where: { paypalWebhookEventId: TEST_SIM_EVENT_ID },
    }).catch(() => {});
  });

  // =========================================================================
  // TEST A: Internal Simulation Endpoint (/api/webhooks/simulate)
  // =========================================================================
  describe("Test A: Internal Simulation Endpoint (/api/webhooks/simulate)", () => {
    it("A.1: should successfully ingest $195.00 Item Not Received dispute scenario", async () => {
      const payload = {
        id: TEST_SIM_EVENT_ID,
        event_type: "PAYMENT.DISPUTE.CREATED",
        create_time: new Date().toISOString(),
        scenario: "INR",
        resource: {
          dispute_id: TEST_DISPUTE_ID,
          reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
          status: "REQUIRED_ACTION",
          dispute_amount: {
            value: "195.00",
            currency_code: "USD",
          },
          disputed_transactions: [
            {
              seller_transaction_id: TEST_TXN_ID,
              buyer_info: {
                name: "Zachary Taylor",
                email: "z.taylor@example.com",
              },
            },
          ],
        },
      };

      const req = new NextRequest("http://localhost:3000/api/webhooks/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "host": "localhost:3000",
        },
        body: JSON.stringify(payload),
      });

      const response = await simulateHandler(req);
      const json = await response.json();

      assert.strictEqual(response.status, 200, "Should return HTTP 200");
      assert.strictEqual(json.success, true, "Success should be true");
      assert.strictEqual(json.isSimulated, true, "Must be flagged as isSimulated=true");
      assert.strictEqual(json.disputeId, TEST_DISPUTE_ID, "Should match disputeId");
      assert.strictEqual(json.status, "PROCESSED", "Status must be PROCESSED");
    });

    it("A.2: should verify database records, simulation flag, and audit trail", async () => {
      // 1. Verify WebhookEvent in database
      const webhookEvent = await prisma.webhookEvent.findUnique({
        where: { paypalWebhookEventId: TEST_SIM_EVENT_ID },
      });
      assert.ok(webhookEvent, "WebhookEvent must exist in DB");
      assert.strictEqual(webhookEvent.signatureVerified, false, "Simulated event must have signatureVerified=false");
      assert.ok(webhookEvent.summary.startsWith("[SIMULATED]"), "Summary must start with [SIMULATED]");
      assert.strictEqual(webhookEvent.status, "PROCESSED");

      // 2. Verify Dispute record in database
      const dispute = await prisma.dispute.findUnique({
        where: { paypalDisputeId: TEST_DISPUTE_ID },
        include: {
          transaction: true,
          order: true,
          trackingInfo: true,
          evidenceItems: true,
          aiAnalysis: true,
        },
      });
      assert.ok(dispute, "Dispute must exist in DB");
      assert.strictEqual(dispute.disputeAmount, 195.00, "Dispute amount must be 195.00");
      assert.strictEqual(dispute.currency, "USD");
      assert.strictEqual(dispute.buyerName, "Zachary Taylor");
      assert.strictEqual(dispute.reason, "MERCHANDISE_OR_SERVICE_NOT_RECEIVED");
      assert.strictEqual(dispute.status, "REQUIRED_ACTION");
      assert.ok(dispute.merchantNotes?.includes("[SIMULATED]"), "Merchant notes should reflect simulated source");

      // 3. Verify Associated Transaction
      assert.ok(dispute.transaction, "Dispute must have associated transaction");
      assert.strictEqual(dispute.transaction.sellerTransactionId, TEST_TXN_ID);
      assert.strictEqual(dispute.transaction.grossAmount, 195.00);

      // 4. Verify Tracking and Evidence attached
      assert.ok(dispute.trackingInfo, "Dispute must have tracking info attached");
      assert.strictEqual(dispute.trackingInfo.carrier, "UPS");
      assert.ok(dispute.evidenceItems.length > 0, "Dispute must have default proof of delivery");

      // 5. Verify Audit Log entry
      const auditLog = await prisma.auditLogEntry.findFirst({
        where: {
          disputeId: dispute.id,
          eventType: "WEBHOOK_SIMULATED",
        },
      });
      assert.ok(auditLog, "Audit log entry with WEBHOOK_SIMULATED must exist");
      assert.strictEqual(auditLog.actor, "simulator", "Audit actor must be simulator");
      assert.ok(auditLog.summary.includes("[SIMULATED]"), "Audit summary must state [SIMULATED]");
    });

    it("A.3: should enforce idempotency and deduplication when duplicate event is received", async () => {
      const duplicatePayload = {
        id: TEST_SIM_EVENT_ID, // Exact same event ID
        event_type: "PAYMENT.DISPUTE.CREATED",
        resource: {
          dispute_id: TEST_DISPUTE_ID,
          dispute_amount: { value: "195.00", currency_code: "USD" },
        },
      };

      const req = new NextRequest("http://localhost:3000/api/webhooks/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "host": "localhost:3000" },
        body: JSON.stringify(duplicatePayload),
      });

      const response = await simulateHandler(req);
      const json = await response.json();

      assert.strictEqual(response.status, 200, "Should return HTTP 200 for idempotent request");
      assert.strictEqual(json.duplicate, true, "Must flag duplicate=true");
      assert.strictEqual(json.status, "IGNORED_DUPLICATE", "Status must be IGNORED_DUPLICATE");

      // Ensure disputes count hasn't multiplied
      const matchingDisputes = await prisma.dispute.findMany({
        where: { paypalDisputeId: TEST_DISPUTE_ID },
      });
      assert.strictEqual(matchingDisputes.length, 1, "Must never create duplicate disputes from identical event");
    });

    it("A.4: should reject invalid or unsupported simulation event payloads", async () => {
      // 1. Unsupported event type
      const badTypeReq = new NextRequest("http://localhost:3000/api/webhooks/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "host": "localhost:3000" },
        body: JSON.stringify({ event_type: "UNSUPPORTED.EVENT.TYPE" }),
      });
      const badTypeRes = await simulateHandler(badTypeReq);
      assert.strictEqual(badTypeRes.status, 400);
      const badTypeJson = await badTypeRes.json();
      assert.ok(badTypeJson.error.includes("Unsupported event_type"));

      // 2. Unsupported scenario
      const badScenarioReq = new NextRequest("http://localhost:3000/api/webhooks/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "host": "localhost:3000" },
        body: JSON.stringify({
          event_type: "PAYMENT.DISPUTE.CREATED",
          scenario: "INVALID_SCENARIO",
        }),
      });
      const badScenarioRes = await simulateHandler(badScenarioReq);
      assert.strictEqual(badScenarioRes.status, 400);

      // 3. Invalid negative amount
      const badAmountReq = new NextRequest("http://localhost:3000/api/webhooks/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "host": "localhost:3000" },
        body: JSON.stringify({
          event_type: "PAYMENT.DISPUTE.CREATED",
          scenario: "INR",
          resource: { dispute_amount: { value: "-50.00" } },
        }),
      });
      const badAmountRes = await simulateHandler(badAmountReq);
      assert.strictEqual(badAmountRes.status, 400);
    });
  });

  // =========================================================================
  // TEST B: Real PayPal Webhook Endpoint Security (/api/webhooks/paypal)
  // =========================================================================
  describe("Test B: Real PayPal Webhook Security (/api/webhooks/paypal)", () => {
    it("B.1: should reject unsigned requests with HTTP 400 and security error", async () => {
      // Direct POST to /api/webhooks/paypal without PayPal cryptographic headers
      const unsignedPayload = {
        id: `WH-REAL-ATTEMPT-${Date.now()}`,
        event_type: "PAYMENT.DISPUTE.CREATED",
        resource: {
          dispute_id: `PP-D-ATTEMPT-${Date.now()}`,
        },
      };

      const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Notice: NO paypal-auth-algo, paypal-cert-url, paypal-transmission-id, etc.
        },
        body: JSON.stringify(unsignedPayload),
      });

      const response = await paypalHandler(req);
      assert.strictEqual(response.status, 400, "Unsigned request must be rejected with HTTP 400");

      const json = await response.json();
      assert.strictEqual(json.success, false);
      assert.ok(
        json.error.includes("Invalid PayPal webhook signature") ||
        json.error.includes("verification headers"),
        "Error message must specify signature / verification header failure"
      );
    });

    it("B.2: should reject requests with spoofed or invalid PayPal signature headers", async () => {
      // POST with fake / spoofed PayPal verification headers
      const spoofedPayload = {
        id: `WH-SPOOF-${Date.now()}`,
        event_type: "PAYMENT.DISPUTE.CREATED",
        resource: {
          dispute_id: `PP-D-SPOOF-${Date.now()}`,
        },
      };

      const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "paypal-auth-algo": "SHA256withRSA",
          "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1234",
          "paypal-transmission-id": "fake-trans-id-999",
          "paypal-transmission-sig": "fake-invalid-signature-value-==",
          "paypal-transmission-time": new Date().toISOString(),
        },
        body: JSON.stringify(spoofedPayload),
      });

      const response = await paypalHandler(req);
      assert.strictEqual(response.status, 400, "Spoofed signature must be rejected with HTTP 400");

      const json = await response.json();
      assert.strictEqual(json.success, false);
    });

    it("B.3: should record security audit log on verification failure", async () => {
      const failedAudit = await prisma.auditLogEntry.findFirst({
        where: { eventType: "WEBHOOK_VERIFICATION_FAILED" },
        orderBy: { timestamp: "desc" },
      });

      assert.ok(failedAudit, "A WEBHOOK_VERIFICATION_FAILED audit entry must be recorded");
      assert.strictEqual(failedAudit.severity, "ERROR");
      assert.strictEqual(failedAudit.actor, "system_webhook");
    });
  });
});
