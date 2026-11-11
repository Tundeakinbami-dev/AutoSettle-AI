import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import prisma from "../lib/prisma";
import { POST as approveHandler } from "../app/api/disputes/[id]/approve/route";
import { PATCH as updateDisputeHandler } from "../app/api/disputes/[id]/route";
import { NextRequest } from "next/server";

describe("AutoSettle AI - Human Approval Workflow Tests", () => {
  const TEST_DISPUTE_ID = `PP-D-APPROVE-${Date.now()}`;
  let disputeDbId: string;
  let draftId: string;

  before(async () => {
    // 1. Create a clean test dispute with unapproved draft response
    const dispute = await prisma.dispute.create({
      data: {
        merchantId: "default_merchant",
        paypalDisputeId: TEST_DISPUTE_ID,
        status: "REQUIRED_ACTION",
        disputeLifeCycleStage: "CHARGEBACK",
        reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        disputeAmount: 195.00,
        currency: "USD",
        buyerName: "Zachary Taylor",
        buyerEmail: "z.taylor@example.com",
        responseDueDate: new Date(Date.now() + 6 * 24 * 3600 * 1000),
        responseWorkflowStatus: "NEEDS_REVIEW",
        draftResponses: {
          create: {
            version: 1,
            status: "NEEDS_REVIEW",
            targetAction: "PROVIDE_EVIDENCE",
            rebuttalNarrative: "Initial unedited draft rebuttal statement for testing.",
            characterCount: 52,
            isApproved: false,
          },
        },
      },
      include: {
        draftResponses: true,
      },
    });

    disputeDbId = dispute.id;
    draftId = dispute.draftResponses[0].id;

    // Ensure dispute PP-D-30329 exists in NEEDS_REVIEW state with unapproved draft for Test 7
    const existing30329 = await prisma.dispute.findUnique({
      where: { paypalDisputeId: "PP-D-30329" },
      include: { draftResponses: true },
    });

    if (!existing30329) {
      await prisma.dispute.create({
        data: {
          merchantId: "default_merchant",
          paypalDisputeId: "PP-D-30329",
          status: "REQUIRED_ACTION",
          disputeLifeCycleStage: "CHARGEBACK",
          reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
          disputeAmount: 195.00,
          currency: "USD",
          buyerName: "Zachary Taylor",
          buyerEmail: "z.taylor@example.com",
          responseDueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
          responseWorkflowStatus: "NEEDS_REVIEW",
          draftResponses: {
            create: {
              version: 1,
              status: "NEEDS_REVIEW",
              targetAction: "PROVIDE_EVIDENCE",
              rebuttalNarrative: "To PayPal Disputes Team: The merchandise for order #AG-30329 was delivered with signature.",
              characterCount: 95,
              isApproved: false,
            },
          },
        },
      });
    } else {
      // Reset state for clean test execution
      await prisma.dispute.update({
        where: { id: existing30329.id },
        data: {
          responseWorkflowStatus: "NEEDS_REVIEW",
        },
      });
      if (existing30329.draftResponses.length > 0) {
        await prisma.draftResponse.update({
          where: { id: existing30329.draftResponses[0].id },
          data: {
            status: "NEEDS_REVIEW",
            isApproved: false,
            approvedBy: null,
            approvedAt: null,
          },
        });
      }
    }
  });

  after(async () => {
    // Clean up test dispute cascade
    await prisma.dispute.delete({
      where: { id: disputeDbId },
    }).catch(() => {});
  });

  it("1. Save draft: should edit draft narrative and record RESPONSE_EDITED in Audit Trail", async () => {
    const updatedText = "Edited rebuttal narrative containing verified carrier tracking proof.";
    const req = new NextRequest(`http://localhost:3000/api/disputes/${disputeDbId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rebuttalNarrative: updatedText }),
    });

    const res = await updateDisputeHandler(req, { params: { id: disputeDbId } });
    assert.strictEqual(res.status, 200);

    // Verify draft was updated in database
    const draft = await prisma.draftResponse.findUnique({
      where: { id: draftId },
    });
    assert.ok(draft);
    assert.strictEqual(draft.rebuttalNarrative, updatedText);
    assert.strictEqual(draft.isApproved, false, "Draft must still be unapproved after save");

    // Verify RESPONSE_EDITED in audit trail
    const editAudit = await prisma.auditLogEntry.findFirst({
      where: { disputeId: disputeDbId, eventType: "RESPONSE_EDITED" },
      orderBy: { timestamp: "desc" },
    });
    assert.ok(editAudit, "RESPONSE_EDITED audit entry must exist");
    assert.strictEqual(editAudit.actor, "merchant_user");
  });

  it("2. Approve draft: should approve via database CUID and update database state", async () => {
    // Calling approve endpoint using disputeDbId (the CUID passed by the frontend workbench)
    const req = new NextRequest(`http://localhost:3000/api/disputes/${disputeDbId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approver: "merchant_compliance_reviewer" }),
    });

    const res = await approveHandler(req, { params: { id: disputeDbId } });
    assert.strictEqual(res.status, 200, "Approval request must succeed with HTTP 200");

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.status, "APPROVED");
    assert.strictEqual(json.approvedBy, "merchant_compliance_reviewer");

    // 3. Confirm database approval state
    const updatedDraft = await prisma.draftResponse.findUnique({
      where: { id: draftId },
    });
    assert.ok(updatedDraft);
    assert.strictEqual(updatedDraft.isApproved, true, "Draft must be marked isApproved=true in DB");
    assert.strictEqual(updatedDraft.status, "APPROVED");
    assert.strictEqual(updatedDraft.approvedBy, "merchant_compliance_reviewer");
    assert.ok(updatedDraft.approvedAt !== null, "approvedAt must be set");

    const updatedDispute = await prisma.dispute.findUnique({
      where: { id: disputeDbId },
    });
    assert.ok(updatedDispute);
    assert.strictEqual(
      updatedDispute.responseWorkflowStatus,
      "APPROVED",
      "Dispute responseWorkflowStatus must transition to APPROVED"
    );
  });

  it("3. Confirm RESPONSE_APPROVED appears in Audit Trail", async () => {
    const approvalAudit = await prisma.auditLogEntry.findFirst({
      where: { disputeId: disputeDbId, eventType: "RESPONSE_APPROVED" },
      orderBy: { timestamp: "desc" },
    });

    assert.ok(approvalAudit, "RESPONSE_APPROVED audit entry must exist in immutable audit log");
    assert.strictEqual(approvalAudit.severity, "SUCCESS");
    assert.strictEqual(approvalAudit.actor, "merchant_user");
    assert.ok(approvalAudit.summary.includes("approved draft response version 1"));
  });

  it("4. Confirm duplicate approval is handled safely (idempotent)", async () => {
    // Call approve again on already approved dispute
    const dupReq = new NextRequest(`http://localhost:3000/api/disputes/${disputeDbId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approver: "merchant_compliance_reviewer" }),
    });

    const dupRes = await approveHandler(dupReq, { params: { id: disputeDbId } });
    assert.strictEqual(dupRes.status, 200, "Duplicate approval should return HTTP 200");

    const dupJson = await dupRes.json();
    assert.strictEqual(dupJson.success, true);
    assert.strictEqual(dupJson.alreadyApproved, true, "Must indicate alreadyApproved=true");
    assert.strictEqual(dupJson.status, "APPROVED");

    // Ensure audit log count has not doubled
    const approvalAudits = await prisma.auditLogEntry.findMany({
      where: { disputeId: disputeDbId, eventType: "RESPONSE_APPROVED" },
    });
    assert.strictEqual(approvalAudits.length, 1, "Duplicate click must not create duplicate audit logs");
  });

  it("5. Confirm empty draft cannot be approved (negative test)", async () => {
    // Create temporary dispute with empty draft
    const emptyDisp = await prisma.dispute.create({
      data: {
        merchantId: "default_merchant",
        paypalDisputeId: `PP-D-EMPTY-${Date.now()}`,
        status: "REQUIRED_ACTION",
        disputeLifeCycleStage: "CHARGEBACK",
        reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        disputeAmount: 50.00,
        buyerName: "Empty Test",
        buyerEmail: "empty@test.com",
        responseDueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
        responseWorkflowStatus: "NEEDS_REVIEW",
        draftResponses: {
          create: {
            version: 1,
            status: "NEEDS_REVIEW",
            targetAction: "PROVIDE_EVIDENCE",
            rebuttalNarrative: "   ", // whitespace only
            characterCount: 3,
            isApproved: false,
          },
        },
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/disputes/${emptyDisp.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approver: "merchant_user" }),
    });

    const res = await approveHandler(req, { params: { id: emptyDisp.id } });
    assert.strictEqual(res.status, 400, "Empty draft must be rejected with HTTP 400");
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.ok(json.error.includes("empty"));

    // Cleanup
    await prisma.dispute.delete({ where: { id: emptyDisp.id } }).catch(() => {});
  });

  it("6. Confirm submission remains a separate action (never auto-submitted)", async () => {
    const disp = await prisma.dispute.findUnique({
      where: { id: disputeDbId },
    });
    assert.ok(disp);
    assert.strictEqual(
      disp.responseWorkflowStatus,
      "APPROVED",
      "Dispute must be in APPROVED state, NOT SUBMITTED"
    );

    // Verify no submission attempts were automatically initiated
    const submissionAttempts = await prisma.submissionAttempt.findMany({
      where: { disputeId: disputeDbId },
    });
    assert.strictEqual(submissionAttempts.length, 0, "No submission attempt must exist after approval alone");
  });

  // =========================================================================
  // Specific Test for Dispute PP-D-30329
  // =========================================================================
  it("7. Test dispute PP-D-30329: approve draft and confirm persistence in database & audit trail", async () => {
    // Find dispute PP-D-30329
    const dispute30329 = await prisma.dispute.findUnique({
      where: { paypalDisputeId: "PP-D-30329" },
      include: { draftResponses: { orderBy: { version: "desc" }, take: 1 } },
    });

    assert.ok(dispute30329, "Dispute PP-D-30329 must exist in database");

    // Call approve using either PP-D-30329 or dispute30329.id
    const req = new NextRequest(`http://localhost:3000/api/disputes/${dispute30329.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approver: "merchant_compliance_reviewer" }),
    });

    const res = await approveHandler(req, { params: { id: dispute30329.id } });
    assert.strictEqual(res.status, 200, "Approval for PP-D-30329 must succeed with HTTP 200");

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.status, "APPROVED");

    // Verify database state for PP-D-30329
    const verifiedDispute = await prisma.dispute.findUnique({
      where: { paypalDisputeId: "PP-D-30329" },
      include: { draftResponses: { orderBy: { version: "desc" }, take: 1 } },
    });

    assert.ok(verifiedDispute);
    assert.strictEqual(
      verifiedDispute.responseWorkflowStatus,
      "APPROVED",
      "PP-D-30329 responseWorkflowStatus must be APPROVED"
    );
    assert.strictEqual(
      verifiedDispute.draftResponses[0].isApproved,
      true,
      "PP-D-30329 draftResponse must be marked isApproved=true"
    );
    assert.strictEqual(
      verifiedDispute.draftResponses[0].approvedBy,
      "merchant_compliance_reviewer"
    );
    assert.ok(verifiedDispute.draftResponses[0].approvedAt !== null);

    // Verify RESPONSE_APPROVED audit log entry for PP-D-30329
    const audit = await prisma.auditLogEntry.findFirst({
      where: {
        disputeId: verifiedDispute.id,
        eventType: "RESPONSE_APPROVED",
      },
      orderBy: { timestamp: "desc" },
    });

    assert.ok(audit, "Audit trail for PP-D-30329 must contain RESPONSE_APPROVED entry");
    assert.strictEqual(audit.severity, "SUCCESS");
    assert.strictEqual(audit.actor, "merchant_user");
  });
});
