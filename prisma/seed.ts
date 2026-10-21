import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding AutoSettle AI enterprise dispute database with all 11 models...");

  // 1. Clean existing records in correct foreign key order
  await prisma.auditLogEntry.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.submissionAttempt.deleteMany();
  await prisma.draftResponse.deleteMany();
  await prisma.aiAnalysis.deleteMany();
  await prisma.evidenceItem.deleteMany();
  await prisma.customerMessage.deleteMany();
  await prisma.trackingInfo.deleteMany();
  await prisma.order.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.payPalConnection.deleteMany();
  await prisma.merchant.deleteMany();

  // 2. Create Default Merchant (Default configuration requires human approval!)
  const merchant = await prisma.merchant.create({
    data: {
      id: "default_merchant",
      businessName: "Apex Gear Outfitters",
      supportEmail: "support@apexgear.example.com",
      requireHumanApproval: true, // DEFAULT REQUIREMENT: Human approval mandatory
      strictEvidenceEnforced: true,
      autoAnalyzeOnArrival: true,
      paypalConnection: {
        create: {
          environment: "sandbox",
          status: "SIMULATION",
          clientId: "",
          clientSecret: "",
          webhookId: "WH-SIM-99281-AUTOHACKATHON",
          lastSyncAt: new Date(),
        },
      },
    },
  });

  // 3. Case 1: "PP-D-91042" - State: NEEDS_REVIEW (High win potential INR with UPS signature)
  const dispute1 = await prisma.dispute.create({
    data: {
      merchantId: merchant.id,
      paypalDisputeId: "PP-D-91042",
      status: "REQUIRED_ACTION",
      disputeLifeCycleStage: "CHARGEBACK",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      disputeAmount: 289.50,
      currency: "USD",
      buyerId: "BUYER-88412",
      buyerName: "Marcus Vance",
      buyerEmail: "marcus.vance@example.com",
      createTime: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      responseDueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      merchantNotes: "Buyer filed chargeback claiming package never arrived. UPS tracking indicates signed delivery.",
      responseWorkflowStatus: "NEEDS_REVIEW", // Distinct state
      transaction: {
        create: {
          sellerTransactionId: "TXN-839218491",
          paypalTransactionId: "PAYPAL-TXN-839218491",
          grossAmount: 289.50,
          feeAmount: 8.68,
          netAmount: 280.82,
          currency: "USD",
          paymentStatus: "COMPLETED",
          paymentSource: "PAYPAL",
          payerId: "PAYER-MV88412",
          payerEmail: "marcus.vance@example.com",
          transactionTime: new Date(Date.now() - 12 * 24 * 3600 * 1000),
        },
      },
      order: {
        create: {
          orderNumber: "AG-94812",
          orderDate: new Date(Date.now() - 12 * 24 * 3600 * 1000),
          customerName: "Marcus Vance",
          customerEmail: "marcus.vance@example.com",
          shippingAddress: "742 Evergreen Terrace, Apt 4B, Springfield, OR 97477",
          billingAddress: "742 Evergreen Terrace, Apt 4B, Springfield, OR 97477",
          orderTotal: 289.50,
          currency: "USD",
          itemsJson: JSON.stringify([
            { description: "Apex Ultra-Lite Carbon Trekking Poles (Pair)", sku: "AG-POLE-CARB", qty: 1, price: 189.50 },
            { description: "Waterproof Alpine Summit Gaiters (L)", sku: "AG-GAIT-L", qty: 1, price: 100.00 },
          ]),
          fulfillmentStatus: "FULFILLED",
        },
      },
      trackingInfo: {
        create: {
          carrier: "UPS",
          trackingNumber: "1Z9999999999999999",
          status: "DELIVERED",
          shippedDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
          deliveredDate: new Date(Date.now() - 6 * 24 * 3600 * 1000),
          destinationZip: "97477",
          signedBy: "M. VANCE",
          deliveryProofUrl: "https://carriers.example.com/proofs/ups-1z9999999999999999.pdf",
        },
      },
      evidenceItems: {
        create: [
          {
            evidenceType: "PROOF_OF_DELIVERY",
            title: "UPS Delivery Confirmation & Signature Record",
            description: "Official UPS carrier manifest with signature confirmation from M. VANCE at destination zip 97477.",
            fileName: "ups_signed_receipt_94812.pdf",
            fileUrl: "/evidence/ups_signed_receipt_94812.pdf",
            fileType: "application/pdf",
            strength: "STRONG",
            verified: true,
            provenanceSource: "UPS Electronic Tracking API",
          },
          {
            evidenceType: "PROOF_OF_FULFILLMENT",
            title: "Order Invoice & Warehouse Pack Slip",
            description: "System invoice detailing purchased line items, buyer billing/shipping address match, and transaction ID.",
            fileName: "order_invoice_AG-94812.pdf",
            fileUrl: "/evidence/order_invoice_AG-94812.pdf",
            fileType: "application/pdf",
            strength: "STRONG",
            verified: true,
            provenanceSource: "Apex Store ERP",
          },
        ],
      },
      aiAnalysis: {
        create: {
          summary: "Dispute PP-D-91042 (MERCHANDISE_OR_SERVICE_NOT_RECEIVED) for USD 289.50. 4 verified evidence points found. Evidence Completeness: 94%. Recommended Action: PROVIDE_EVIDENCE.",
          completenessScore: 94,
          recommendedAction: "PROVIDE_EVIDENCE",
          recommendationRationale: "Strong merchant defense: Order #AG-94812 has verified carrier delivery via UPS with electronic signature 'M. VANCE'. Fulfills PayPal Seller Protection requirements.",
          keyStrengthsJson: JSON.stringify([
            "Verifiable Order #AG-94812 matching buyer email marcus.vance@example.com.",
            "Confirmed carrier delivery via UPS (Tracking: 1Z9999999999999999).",
            "Signature proof of delivery on file: Signed by 'M. VANCE'.",
            "Delivery zip code (97477) matches authorized checkout address.",
          ]),
          criticalGapsJson: JSON.stringify([
            "None. All fulfillment and delivery milestones are documented with verifiable provenance.",
          ]),
          citationsJson: JSON.stringify([
            { fact: "Order #AG-94812 matching buyer email", source: "Merchant ERP (#AG-94812)", verified: true },
            { fact: "UPS Tracking #1Z9999999999999999 delivered", source: "UPS Carrier API", verified: true },
            { fact: "Direct recipient signature: M. VANCE", source: "UPS Signature Service", verified: true },
          ]),
          riskLevel: "LOW",
          antiHallucinationVerified: true,
          modelUsed: "deterministic-factual-engine",
        },
      },
      draftResponses: {
        create: [
          {
            version: 1,
            status: "NEEDS_REVIEW", // DISTINCT STATE: Needs review
            targetAction: "PROVIDE_EVIDENCE",
            rebuttalNarrative: `To the PayPal Dispute Review Team,\n\nRegarding Dispute PP-D-91042 for transaction TXN-839218491 in the amount of USD 289.50:\n\n1. ORDER & PURCHASE VALIDATION:\nCustomer Marcus Vance placed Order #AG-94812 for 1x Apex Ultra-Lite Carbon Trekking Poles, 1x Waterproof Alpine Summit Gaiters. Address authorized at checkout was: 742 Evergreen Terrace, Apt 4B, Springfield, OR 97477.\n\n2. FULFILLMENT & DELIVERY DETAILS:\nThe order was dispatched via UPS under tracking number 1Z9999999999999999. Carrier records confirm delivery with signature obtained from "M. VANCE".\n\nRespectfully submitted,\nMerchant Operations`,
            characterCount: 520,
            isApproved: false,
          },
        ],
      },
      auditLogs: {
        create: [
          {
            merchantId: merchant.id,
            eventType: "DISPUTE_CREATED",
            severity: "INFO",
            summary: "Dispute PP-D-91042 ingested for transaction TXN-839218491",
            detailsJson: JSON.stringify({ amount: 289.50, reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" }),
            actor: "system_webhook",
            timestamp: new Date(Date.now() - 48 * 3600 * 1000),
          },
          {
            merchantId: merchant.id,
            eventType: "EVIDENCE_RETRIEVED",
            severity: "INFO",
            summary: "UPS carrier tracking and delivery signature retrieved for tracking 1Z9999999999999999",
            detailsJson: JSON.stringify({ carrier: "UPS", signedBy: "M. VANCE", status: "DELIVERED" }),
            actor: "ai_agent",
            timestamp: new Date(Date.now() - 47 * 3600 * 1000),
          },
          {
            merchantId: merchant.id,
            eventType: "AI_ANALYSIS_GENERATED",
            severity: "SUCCESS",
            summary: "AI generated evidence completeness score of 94% with zero critical gaps",
            detailsJson: JSON.stringify({ completeness: 94, recommendedAction: "PROVIDE_EVIDENCE" }),
            actor: "ai_agent",
            timestamp: new Date(Date.now() - 46 * 3600 * 1000),
          },
        ],
      },
    },
  });

  // 4. Case 2: "PP-D-83910" - State: DRAFT (Item Not as Described, missing pick-pack photo)
  const dispute2 = await prisma.dispute.create({
    data: {
      merchantId: merchant.id,
      paypalDisputeId: "PP-D-83910",
      status: "REQUIRED_ACTION",
      disputeLifeCycleStage: "CLAIM",
      reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
      disputeAmount: 420.00,
      currency: "USD",
      buyerId: "BUYER-77192",
      buyerName: "Elena Rostova",
      buyerEmail: "elena.r@example.com",
      createTime: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      responseDueDate: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      merchantNotes: "Buyer claims the parka arrived in wrong color (Navy instead of Black).",
      responseWorkflowStatus: "DRAFT", // DISTINCT STATE: Draft
      transaction: {
        create: {
          sellerTransactionId: "TXN-746291038",
          grossAmount: 420.00,
          currency: "USD",
          paymentStatus: "COMPLETED",
          paymentSource: "PAYPAL",
        },
      },
      order: {
        create: {
          orderNumber: "AG-93205",
          orderDate: new Date(Date.now() - 16 * 24 * 3600 * 1000),
          customerName: "Elena Rostova",
          customerEmail: "elena.r@example.com",
          shippingAddress: "1088 Sansome St, Fl 3, San Francisco, CA 94111",
          billingAddress: "1088 Sansome St, Fl 3, San Francisco, CA 94111",
          orderTotal: 420.00,
          itemsJson: JSON.stringify([
            { description: "Apex Arctic Expedition Down Parka (L, Obsidian Black)", sku: "AG-PARKA-BLK-L", qty: 1, price: 420.00 },
          ]),
        },
      },
      trackingInfo: {
        create: {
          carrier: "FEDEX",
          trackingNumber: "782910482019",
          status: "DELIVERED",
          destinationZip: "94111",
          signedBy: "E. ROSTOVA",
        },
      },
      aiAnalysis: {
        create: {
          summary: "Dispute PP-D-83910 (SNAD). Evidence Completeness: 56%. Missing warehouse pack photo. Recommended: OFFER_PARTIAL_REFUND.",
          completenessScore: 56,
          recommendedAction: "OFFER_PARTIAL_REFUND",
          recommendationRationale: "Buyer claims item is significantly not as described. Merchant lacks warehouse pack photo. Offering a 25% courtesy refund avoids chargeback dispute fees.",
          keyStrengthsJson: JSON.stringify([
            "Item was successfully delivered and signed for by buyer.",
            "Order invoice confirms buyer chose SKU AG-PARKA-BLK-L.",
          ]),
          criticalGapsJson: JSON.stringify([
            "CRITICAL GAP: Missing warehouse pre-shipment photo proving color/condition before sealing package.",
          ]),
          citationsJson: JSON.stringify([
            { fact: "Order #AG-93205 placed for SKU AG-PARKA-BLK-L", source: "Merchant ERP", verified: true },
          ]),
          riskLevel: "MEDIUM",
        },
      },
      draftResponses: {
        create: [
          {
            version: 1,
            status: "DRAFT",
            targetAction: "MAKE_OFFER",
            rebuttalNarrative: "Offering partial refund of $105.00 to resolve dispute amicably.",
            characterCount: 65,
            partialOfferAmount: 105.00,
            isApproved: false,
          },
        ],
      },
      auditLogs: {
        create: [
          {
            merchantId: merchant.id,
            eventType: "DISPUTE_CREATED",
            severity: "INFO",
            summary: "Dispute PP-D-83910 created via PayPal Webhook",
            actor: "system_webhook",
          },
          {
            merchantId: merchant.id,
            eventType: "AI_ANALYSIS_GENERATED",
            severity: "WARNING",
            summary: "AI gap analysis flagged missing warehouse pack photo; recommended partial refund",
            actor: "ai_agent",
          },
        ],
      },
    },
  });

  // 5. Case 3: "PP-D-61023" - State: APPROVED (Urgent deadline expiring in 3 hours, human approved, ready to submit)
  const dispute3 = await prisma.dispute.create({
    data: {
      merchantId: merchant.id,
      paypalDisputeId: "PP-D-61023",
      status: "REQUIRED_ACTION",
      disputeLifeCycleStage: "CHARGEBACK",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      disputeAmount: 79.99,
      currency: "USD",
      buyerId: "BUYER-33901",
      buyerName: "Tariq Morales",
      buyerEmail: "tariq.m@example.com",
      createTime: new Date(Date.now() - 9 * 24 * 3600 * 1000),
      responseDueDate: new Date(Date.now() + 3 * 3600 * 1000), // In 3 hours!
      merchantNotes: "Dispute response approved by merchant manager. Ready for PayPal API dispatch.",
      responseWorkflowStatus: "APPROVED", // DISTINCT STATE: Approved
      transaction: {
        create: {
          sellerTransactionId: "TXN-901847112",
          grossAmount: 79.99,
          currency: "USD",
          paymentStatus: "COMPLETED",
          paymentSource: "PAYPAL",
        },
      },
      order: {
        create: {
          orderNumber: "AG-95110",
          orderDate: new Date(Date.now() - 14 * 24 * 3600 * 1000),
          customerName: "Tariq Morales",
          customerEmail: "tariq.m@example.com",
          shippingAddress: "320 West 42nd Street, Apt 11C, New York, NY 10036",
          billingAddress: "320 West 42nd Street, Apt 11C, New York, NY 10036",
          orderTotal: 79.99,
          itemsJson: JSON.stringify([
            { description: "Apex Trail Runner Hydration Vest (12L)", sku: "AG-VEST-12L", qty: 1, price: 79.99 },
          ]),
        },
      },
      trackingInfo: {
        create: {
          carrier: "USPS",
          trackingNumber: "9400111899223190284712",
          status: "DELIVERED",
          destinationZip: "10036",
          signedBy: "T. MORALES",
        },
      },
      evidenceItems: {
        create: [
          {
            evidenceType: "PROOF_OF_DELIVERY",
            title: "USPS Official Delivery Confirmation",
            description: "Carrier confirmed delivery to building mailroom zip 10036.",
            fileName: "usps_pod_95110.pdf",
            fileType: "application/pdf",
            strength: "STRONG",
            verified: true,
          },
        ],
      },
      aiAnalysis: {
        create: {
          summary: "Dispute PP-D-61023 (INR). URGENT: 3h left. Completeness: 91%. Recommended: SUBMIT EVIDENCE.",
          completenessScore: 91,
          recommendedAction: "PROVIDE_EVIDENCE",
          recommendationRationale: "USPS delivery record matches authorized shipping destination zip.",
          keyStrengthsJson: JSON.stringify(["USPS confirmed delivery to zip 10036"]),
          criticalGapsJson: JSON.stringify(["Urgent deadline expiring today"]),
          citationsJson: JSON.stringify([{ fact: "USPS Tracking #9400111899223190284712 delivered", source: "USPS API", verified: true }]),
          riskLevel: "LOW",
        },
      },
      draftResponses: {
        create: [
          {
            version: 1,
            status: "APPROVED",
            targetAction: "PROVIDE_EVIDENCE",
            rebuttalNarrative: "Factual rebuttal verified and approved for immediate dispatch.",
            characterCount: 62,
            isApproved: true,
            approvedBy: "merchant_compliance_officer",
            approvedAt: new Date(Date.now() - 30 * 60 * 1000),
          },
        ],
      },
      auditLogs: {
        create: [
          {
            merchantId: merchant.id,
            eventType: "RESPONSE_EDITED",
            severity: "INFO",
            summary: "Merchant edited rebuttal narrative with USPS tracking reference",
            actor: "merchant_user",
            timestamp: new Date(Date.now() - 45 * 60 * 1000),
          },
          {
            merchantId: merchant.id,
            eventType: "APPROVAL_GRANTED",
            severity: "SUCCESS",
            summary: "Human approval granted by compliance officer. Ready for PayPal Disputes API submission.",
            actor: "merchant_user",
            actorId: "compliance_officer_1",
            timestamp: new Date(Date.now() - 30 * 60 * 1000),
          },
        ],
      },
    },
  });

  // 6. Case 4: "PP-D-72149" - State: SUBMISSION_FAILED (Simulated transient error with retry capability)
  const dispute4 = await prisma.dispute.create({
    data: {
      merchantId: merchant.id,
      paypalDisputeId: "PP-D-72149",
      status: "WAITING_FOR_SELLER",
      disputeLifeCycleStage: "INQUIRY",
      reason: "UNAUTHORISED",
      disputeAmount: 165.00,
      currency: "USD",
      buyerId: "BUYER-55209",
      buyerName: "Chloe Davenport",
      buyerEmail: "chloe.davenport@example.com",
      createTime: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      responseDueDate: new Date(Date.now() + 8 * 24 * 3600 * 1000),
      merchantNotes: "Submission attempt failed due to PayPal Sandbox rate limiting / timeout. Ready for retry.",
      responseWorkflowStatus: "SUBMISSION_FAILED", // DISTINCT STATE: Submission failed
      transaction: {
        create: {
          sellerTransactionId: "TXN-552190884",
          grossAmount: 165.00,
          currency: "USD",
          paymentStatus: "COMPLETED",
          paymentSource: "PAYPAL",
        },
      },
      order: {
        create: {
          orderNumber: "AG-95620",
          orderDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
          customerName: "Chloe Davenport",
          customerEmail: "chloe.davenport@example.com",
          shippingAddress: "450 North Brand Blvd, Suite 700, Glendale, CA 91203",
          billingAddress: "450 North Brand Blvd, Suite 700, Glendale, CA 91203",
          orderTotal: 165.00,
          itemsJson: JSON.stringify([
            { description: "Apex Merino 250 Thermal Base Layer Set", sku: "AG-BASE-M250", qty: 1, price: 165.00 },
          ]),
        },
      },
      trackingInfo: {
        create: {
          carrier: "FEDEX",
          trackingNumber: "774910284910",
          status: "DELIVERED",
          destinationZip: "91203",
          signedBy: "C. DAVENPORT",
        },
      },
      draftResponses: {
        create: [
          {
            version: 1,
            status: "APPROVED",
            targetAction: "PROVIDE_EVIDENCE",
            rebuttalNarrative: "Transaction verified with FedEx signature at authorized billing address.",
            characterCount: 78,
            isApproved: true,
            approvedBy: "merchant_user",
          },
        ],
      },
      submissionAttempts: {
        create: [
          {
            action: "PROVIDE_EVIDENCE",
            attemptNumber: 1,
            status: "SUBMISSION_FAILED",
            endpoint: "/v1/customer/disputes/PP-D-72149/provide-evidence",
            httpStatusCode: 504,
            errorMessage: "PayPal Sandbox gateway timeout (504). Downstream dispute service temporarily unavailable.",
            requestPayloadSanitized: JSON.stringify({ disputeId: "PP-D-72149", evidenceType: "PROOF_OF_DELIVERY" }),
            responsePayloadSanitized: JSON.stringify({ error: "GATEWAY_TIMEOUT", message: "Downstream service timeout" }),
            isRetry: false,
            retryCount: 0,
            attemptedAt: new Date(Date.now() - 2 * 3600 * 1000),
            completedAt: new Date(Date.now() - 2 * 3600 * 1000 + 45000),
          },
        ],
      },
      auditLogs: {
        create: [
          {
            merchantId: merchant.id,
            eventType: "SUBMISSION_ATTEMPTED",
            severity: "INFO",
            summary: "Dispatched provide-evidence request to PayPal Disputes API",
            actor: "merchant_user",
            timestamp: new Date(Date.now() - 2 * 3600 * 1000),
          },
          {
            merchantId: merchant.id,
            eventType: "SUBMISSION_FAILED",
            severity: "ERROR",
            summary: "PayPal Disputes API returned 504 Gateway Timeout. Marked for retry.",
            detailsJson: JSON.stringify({ httpStatus: 504, error: "GATEWAY_TIMEOUT" }),
            actor: "paypal_api",
            timestamp: new Date(Date.now() - 2 * 3600 * 1000 + 45000),
          },
        ],
      },
    },
  });

  // 7. Case 5: "PP-D-50218" - State: SUBMITTED & RESOLVED (Successful PayPal 200 OK result received)
  const dispute5 = await prisma.dispute.create({
    data: {
      merchantId: merchant.id,
      paypalDisputeId: "PP-D-50218",
      status: "RESOLVED",
      disputeLifeCycleStage: "CHARGEBACK",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      disputeAmount: 540.00,
      currency: "USD",
      buyerId: "BUYER-22019",
      buyerName: "Julian Thorne",
      buyerEmail: "j.thorne@example.com",
      createTime: new Date(Date.now() - 20 * 24 * 3600 * 1000),
      responseDueDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      merchantNotes: "Dispute decided in merchant favor by PayPal review team after verified evidence submission.",
      resolutionOutcome: "WON",
      responseWorkflowStatus: "SUBMITTED", // DISTINCT STATE: Submitted (only after successful PayPal result!)
      transaction: {
        create: {
          sellerTransactionId: "TXN-441092831",
          grossAmount: 540.00,
          currency: "USD",
          paymentStatus: "COMPLETED",
          paymentSource: "PAYPAL",
        },
      },
      order: {
        create: {
          orderNumber: "AG-92100",
          orderDate: new Date(Date.now() - 28 * 24 * 3600 * 1000),
          customerName: "Julian Thorne",
          customerEmail: "j.thorne@example.com",
          shippingAddress: "1200 Westlake Ave N, Seattle, WA 98109",
          billingAddress: "1200 Westlake Ave N, Seattle, WA 98109",
          orderTotal: 540.00,
          itemsJson: JSON.stringify([
            { description: "Apex 4-Season All-Weather Geodesic Tent", sku: "AG-TENT-4S", qty: 1, price: 540.00 },
          ]),
        },
      },
      trackingInfo: {
        create: {
          carrier: "UPS",
          trackingNumber: "1Z8888888888888888",
          status: "DELIVERED",
          destinationZip: "98109",
          signedBy: "J. THORNE",
        },
      },
      submissionAttempts: {
        create: [
          {
            action: "PROVIDE_EVIDENCE",
            attemptNumber: 1,
            status: "SUBMITTED", // Exact submitted state!
            endpoint: "/v1/customer/disputes/PP-D-50218/provide-evidence",
            httpStatusCode: 200,
            requestPayloadSanitized: JSON.stringify({
              disputeId: "PP-D-50218",
              evidenceType: "PROOF_OF_DELIVERY",
              tracking: "1Z8888888888888888",
            }),
            responsePayloadSanitized: JSON.stringify({
              status: "UNDER_REVIEW",
              message: "Evidence successfully accepted by PayPal Disputes API.",
              acknowledged_at: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(),
            }),
            isRetry: false,
            attemptedAt: new Date(Date.now() - 18 * 24 * 3600 * 1000),
            completedAt: new Date(Date.now() - 18 * 24 * 3600 * 1000 + 1200),
          },
        ],
      },
      webhookEvents: {
        create: [
          {
            paypalWebhookEventId: "WH-DEDUP-RESOLVE-50218", // Unique deduplication constraint
            eventType: "PAYMENT.DISPUTE.RESOLVED",
            summary: "Dispute decided in merchant favor with Seller Protection granted",
            status: "PROCESSED",
            signatureVerified: true,
            payloadSanitized: JSON.stringify({ outcome: "RESOLVED_BUYER_FAVOUR_NO", protection: "ELIGIBLE" }),
            receivedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
          },
        ],
      },
      auditLogs: {
        create: [
          {
            merchantId: merchant.id,
            eventType: "SUBMISSION_ATTEMPTED",
            severity: "INFO",
            summary: "Evidence payload dispatched to PayPal Disputes API",
            actor: "merchant_user",
            timestamp: new Date(Date.now() - 18 * 24 * 3600 * 1000),
          },
          {
            merchantId: merchant.id,
            eventType: "API_RESULT_RECEIVED",
            severity: "SUCCESS",
            summary: "PayPal returned 200 OK: Evidence successfully acknowledged and case placed UNDER_REVIEW",
            detailsJson: JSON.stringify({ httpStatus: 200, status: "UNDER_REVIEW" }),
            actor: "paypal_api",
            timestamp: new Date(Date.now() - 18 * 24 * 3600 * 1000 + 1200),
          },
          {
            merchantId: merchant.id,
            eventType: "WEBHOOK_VERIFIED",
            severity: "SUCCESS",
            summary: "Received verified PayPal webhook PAYMENT.DISPUTE.RESOLVED. Decision: WON.",
            actor: "system_webhook",
            timestamp: new Date(Date.now() - 10 * 24 * 3600 * 1000),
          },
        ],
      },
    },
  });

  console.log("✅ Seed completed successfully! Created full 11-model relational structure with distinct workflow states.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
