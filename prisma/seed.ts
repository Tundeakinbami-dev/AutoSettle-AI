import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding AutoSettle AI dispute database...");

  // Clear existing
  await prisma.submissionAuditLog.deleteMany();
  await prisma.disputeAnalysis.deleteMany();
  await prisma.evidenceItem.deleteMany();
  await prisma.customerMessage.deleteMany();
  await prisma.trackingInfo.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.merchantSettings.deleteMany();

  // Create default merchant settings
  await prisma.merchantSettings.create({
    data: {
      id: "default",
      businessName: "Apex Gear Outfitters",
      supportEmail: "support@apexgear.example.com",
      paypalClientId: "",
      paypalClientSecret: "",
      paypalEnvironment: "sandbox",
      openAiApiKey: "",
      autoAnalyzeOnArrival: true,
      strictEvidenceEnforced: true,
      webhookSecret: "WH-SIM-99281-AUTOHACKATHON",
    },
  });

  const now = new Date();

  // 1. Case 1: High Win Potential INR (Item Not Received) with UPS signature
  const dispute1 = await prisma.dispute.create({
    data: {
      paypalDisputeId: "PP-D-91042",
      status: "REQUIRED_ACTION",
      disputeLifeCycleStage: "CHARGEBACK",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      disputeAmount: 289.50,
      currency: "USD",
      buyerId: "BUYER-88412",
      buyerName: "Marcus Vance",
      buyerEmail: "marcus.vance@example.com",
      sellerTransactionId: "TXN-839218491",
      createTime: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      responseDueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      externalReasonCode: "INSUFFICIENT_FULFILLMENT_PROOF",
      merchantNotes: "Buyer filed chargeback claiming package never arrived. UPS tracking indicates signed delivery.",
      aiAnalyzed: true,
      aiConfidenceScore: 94,
      aiRecommendedAction: "PROVIDE_EVIDENCE",
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
          paymentMethod: "PayPal Express Checkout",
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
          checkpointHistory: JSON.stringify([
            { time: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), location: "Portland, OR", activity: "Origin Scan" },
            { time: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(), location: "Eugene, OR", activity: "Out for Delivery" },
            { time: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(), location: "Springfield, OR", activity: "Delivered - Signed by M. VANCE" },
          ]),
        },
      },
      messages: {
        create: [
          {
            sender: "BUYER",
            channel: "PAYPAL_MESSAGE",
            timestamp: new Date(Date.now() - 48 * 3600 * 1000),
            messageText: "I did not receive my poles and gaiters. Tracking says delivered but I don't see it anywhere.",
            sentiment: "FRUSTRATED",
          },
          {
            sender: "MERCHANT",
            channel: "PAYPAL_MESSAGE",
            timestamp: new Date(Date.now() - 36 * 3600 * 1000),
            messageText: "Hi Marcus, thank you for reaching out. UPS recorded delivery on Oct 15th signed by M. VANCE. Please check with your front desk or household members.",
            sentiment: "NEUTRAL",
          },
        ],
      },
      evidenceItems: {
        create: [
          {
            evidenceType: "PROOF_OF_DELIVERY",
            title: "UPS Delivery Confirmation & Signature Record",
            description: "Official UPS carrier manifest with signature confirmation from M. VANCE at destination zip 97477.",
            fileUrl: "/evidence/ups_signed_receipt_94812.pdf",
            fileName: "ups_signed_receipt_94812.pdf",
            fileType: "application/pdf",
            fileSize: 428000,
            strength: "STRONG",
            verified: true,
          },
          {
            evidenceType: "PROOF_OF_FULFILLMENT",
            title: "Order Invoice & Warehouse Pack Slip",
            description: "System invoice detailing purchased line items, buyer billing/shipping address match, and transaction ID.",
            fileUrl: "/evidence/order_invoice_AG-94812.pdf",
            fileName: "order_invoice_AG-94812.pdf",
            fileType: "application/pdf",
            fileSize: 182000,
            strength: "STRONG",
            verified: true,
          },
          {
            evidenceType: "TERMS_OF_SERVICE",
            title: "Published Return and Dispute Policy",
            description: "Apex Gear Outfitters verified customer terms of sale and lost shipment resolution procedure.",
            fileUrl: "/evidence/apex_terms_policy.pdf",
            fileName: "apex_terms_policy.pdf",
            fileType: "application/pdf",
            fileSize: 94000,
            strength: "MODERATE",
            verified: true,
          },
        ],
      },
      analysis: {
        create: {
          summary: "Dispute PP-D-91042 (MERCHANDISE_OR_SERVICE_NOT_RECEIVED) for USD 289.50. 4 verified evidence points found. Evidence Completeness evaluated at 94%. Recommended Action: PROVIDE_EVIDENCE.",
          completenessScore: 94,
          recommendedAction: "PROVIDE_EVIDENCE",
          recommendationRationale: "Strong merchant defense: Order #AG-94812 has verified carrier delivery via UPS to the customer's specified address with electronic signature 'M. VANCE'. Fulfills PayPal Seller Protection requirements.",
          keyStrengthsJson: JSON.stringify([
            "Verifiable Order #AG-94812 matching buyer email marcus.vance@example.com.",
            "Confirmed carrier delivery via UPS (Tracking: 1Z9999999999999999).",
            "Signature proof of delivery on file: Signed by 'M. VANCE'.",
            "Delivery zip code (97477) matches authorized checkout address.",
          ]),
          criticalGapsJson: JSON.stringify([
            "None. All fulfillment and delivery milestones are documented with verifiable provenance.",
          ]),
          rebuttalDraft: `To the PayPal Dispute Review Team,\n\nRegarding Dispute PP-D-91042 for transaction TXN-839218491 in the amount of USD 289.50:\n\n1. ORDER & PURCHASE VALIDATION:\nCustomer Marcus Vance placed Order #AG-94812 on the purchase date for 1x Apex Ultra-Lite Carbon Trekking Poles (Pair), 1x Waterproof Alpine Summit Gaiters (L). The shipping address provided and authorized during checkout was: 742 Evergreen Terrace, Apt 4B, Springfield, OR 97477.\n\n2. FULFILLMENT & DELIVERY DETAILS:\nThe order was fulfilled and dispatched via UPS under tracking number 1Z9999999999999999. According to official carrier records, the status is DELIVERED with delivery accepted and signed by "M. VANCE".\n\n3. SUPPORTING DOCUMENTATION ATTACHED:\n- UPS Delivery Confirmation & Signature Record: Official UPS carrier manifest with signature confirmation from M. VANCE at destination zip 97477.\n- Order Invoice & Warehouse Pack Slip: System invoice detailing purchased line items, buyer billing/shipping address match, and transaction ID.\n\nWe respectfully provide this factual documentation for your review in accordance with PayPal Seller Protection guidelines.\n\nSincerely,\nMerchant Operations Team`,
          citationsJson: JSON.stringify([
            { fact: "Order #AG-94812 matching buyer email marcus.vance@example.com", source: "Merchant ERP / Order Database (#AG-94812)", verified: true },
            { fact: "UPS Tracking #1Z9999999999999999 with status DELIVERED", source: "UPS Carrier API Integration", verified: true },
            { fact: "Direct recipient signature obtained: M. VANCE", source: "UPS Electronic Signature Confirmation", verified: true },
          ]),
          riskLevel: "LOW",
        },
      },
    },
  });

  // 2. Case 2: "Item Not as Described" (SNAD) with missing pick-pack photo gap
  const dispute2 = await prisma.dispute.create({
    data: {
      paypalDisputeId: "PP-D-83910",
      status: "REQUIRED_ACTION",
      disputeLifeCycleStage: "CLAIM",
      reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
      disputeAmount: 420.00,
      currency: "USD",
      buyerId: "BUYER-77192",
      buyerName: "Elena Rostova",
      buyerEmail: "elena.r@example.com",
      sellerTransactionId: "TXN-746291038",
      createTime: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      responseDueDate: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      externalReasonCode: "PRODUCT_DEFECT_OR_DIFFERENT",
      merchantNotes: "Buyer claims the parka arrived in wrong color (Navy instead of Black) with damaged seam.",
      aiAnalyzed: true,
      aiConfidenceScore: 56,
      aiRecommendedAction: "OFFER_PARTIAL_REFUND",
      order: {
        create: {
          orderNumber: "AG-93205",
          orderDate: new Date(Date.now() - 16 * 24 * 3600 * 1000),
          customerName: "Elena Rostova",
          customerEmail: "elena.r@example.com",
          shippingAddress: "1088 Sansome St, Fl 3, San Francisco, CA 94111",
          billingAddress: "1088 Sansome St, Fl 3, San Francisco, CA 94111",
          orderTotal: 420.00,
          currency: "USD",
          itemsJson: JSON.stringify([
            { description: "Apex Arctic Expedition Down Parka (L, Obsidian Black)", sku: "AG-PARKA-BLK-L", qty: 1, price: 420.00 },
          ]),
          paymentMethod: "PayPal",
        },
      },
      trackingInfo: {
        create: {
          carrier: "FEDEX",
          trackingNumber: "782910482019",
          status: "DELIVERED",
          shippedDate: new Date(Date.now() - 14 * 24 * 3600 * 1000),
          deliveredDate: new Date(Date.now() - 9 * 24 * 3600 * 1000),
          destinationZip: "94111",
          signedBy: "E. ROSTOVA",
          deliveryProofUrl: "https://carriers.example.com/proofs/fedex-782910482019.pdf",
        },
      },
      messages: {
        create: [
          {
            sender: "BUYER",
            channel: "PAYPAL_MESSAGE",
            timestamp: new Date(Date.now() - 50 * 3600 * 1000),
            messageText: "The jacket sent to me has loose stitching on the chest baffle and looks like dark midnight navy rather than jet black. I want a refund.",
            sentiment: "FRUSTRATED",
          },
        ],
      },
      evidenceItems: {
        create: [
          {
            evidenceType: "PROOF_OF_FULFILLMENT",
            title: "Original Product Catalog Specifications",
            description: "Product page technical specification showing fabric, color palette and manufacturer warranty.",
            fileName: "product_spec_obsidian_parka.pdf",
            fileType: "application/pdf",
            fileSize: 310000,
            strength: "MODERATE",
            verified: true,
          },
        ],
      },
      analysis: {
        create: {
          summary: "Dispute PP-D-83910 (MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED) for USD 420.00. Evidence Completeness: 56%. Missing warehouse pack photo. Recommended Action: OFFER_PARTIAL_REFUND.",
          completenessScore: 56,
          recommendedAction: "OFFER_PARTIAL_REFUND",
          recommendationRationale: "Buyer claims item is significantly not as described (color mismatch & stitching). Merchant lacks warehouse pick-pack photography or serial logging. Offering a partial refund ($80-$120) or prepaid return label avoids complete loss and chargeback processing fees.",
          keyStrengthsJson: JSON.stringify([
            "Item was successfully delivered and signed for by buyer.",
            "Order invoice confirms buyer chose SKU AG-PARKA-BLK-L.",
            "Return policy requires item to be returned in original packaging for full refund.",
          ]),
          criticalGapsJson: JSON.stringify([
            "CRITICAL GAP: Missing warehouse pre-shipment photo proving condition and color before sealing box.",
            "No recorded inspection log or manufacturer QC certificate attached to shipment.",
          ]),
          rebuttalDraft: `To the PayPal Dispute Resolution Team,\n\nRegarding Dispute PP-D-83910 for transaction TXN-746291038 in the amount of USD 420.00:\n\n1. TRANSACTION CONTEXT:\nCustomer Elena Rostova ordered the Apex Arctic Expedition Down Parka (SKU: AG-PARKA-BLK-L) on the recorded date. The item was fulfilled and verified delivered via FedEx Tracking 782910482019.\n\n2. MERCHANT SETTLEMENT POSITION:\nOur products undergo strict manufacturer batch quality checks. To provide immediate customer satisfaction while preserving the integrity of the purchase, we are prepared to offer a 25% courtesy settlement ($105.00) or issue a prepaid return authorization label for a full refund upon receipt.\n\nSincerely,\nMerchant Operations Team`,
          citationsJson: JSON.stringify([
            { fact: "Order #AG-93205 placed for SKU AG-PARKA-BLK-L", source: "Merchant ERP", verified: true },
            { fact: "FedEx Tracking #782910482019 delivered", source: "FedEx Carrier API", verified: true },
          ]),
          riskLevel: "MEDIUM",
        },
      },
    },
  });

  // 3. Case 3: "Urgent Deadline Expiring in 3 Hours!"
  const dispute3 = await prisma.dispute.create({
    data: {
      paypalDisputeId: "PP-D-61023",
      status: "REQUIRED_ACTION",
      disputeLifeCycleStage: "CHARGEBACK",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      disputeAmount: 79.99,
      currency: "USD",
      buyerId: "BUYER-33901",
      buyerName: "Tariq Morales",
      buyerEmail: "tariq.m@example.com",
      sellerTransactionId: "TXN-901847112",
      createTime: new Date(Date.now() - 9 * 24 * 3600 * 1000),
      // Set due date to 3 hours from now!
      responseDueDate: new Date(Date.now() + 3 * 3600 * 1000),
      externalReasonCode: "BUYER_DISPUTE_DEADLINE_APPROACHING",
      merchantNotes: "URGENT: Dispute deadline expires today in under 3 hours! Needs immediate evidence submission to avoid default forfeiture.",
      aiAnalyzed: true,
      aiConfidenceScore: 91,
      aiRecommendedAction: "PROVIDE_EVIDENCE",
      order: {
        create: {
          orderNumber: "AG-95110",
          orderDate: new Date(Date.now() - 14 * 24 * 3600 * 1000),
          customerName: "Tariq Morales",
          customerEmail: "tariq.m@example.com",
          shippingAddress: "320 West 42nd Street, Apt 11C, New York, NY 10036",
          billingAddress: "320 West 42nd Street, Apt 11C, New York, NY 10036",
          orderTotal: 79.99,
          currency: "USD",
          itemsJson: JSON.stringify([
            { description: "Apex Trail Runner Hydration Vest (12L)", sku: "AG-VEST-12L", qty: 1, price: 79.99 },
          ]),
          paymentMethod: "PayPal",
        },
      },
      trackingInfo: {
        create: {
          carrier: "USPS",
          trackingNumber: "9400111899223190284712",
          status: "DELIVERED",
          shippedDate: new Date(Date.now() - 12 * 24 * 3600 * 1000),
          deliveredDate: new Date(Date.now() - 8 * 24 * 3600 * 1000),
          destinationZip: "10036",
          signedBy: "Front Desk / Concierge (T. MORALES)",
          deliveryProofUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223190284712",
        },
      },
      messages: {
        create: [
          {
            sender: "BUYER",
            channel: "PAYPAL_MESSAGE",
            timestamp: new Date(Date.now() - 72 * 3600 * 1000),
            messageText: "Package was not found in my building mailroom.",
            sentiment: "NEUTRAL",
          },
        ],
      },
      evidenceItems: {
        create: [
          {
            evidenceType: "PROOF_OF_DELIVERY",
            title: "USPS Electronic Delivery Confirmation (Zip 10036)",
            description: "Official USPS carrier delivery scan to building reception in New York, NY 10036.",
            fileName: "usps_delivery_confirmation_95110.pdf",
            fileType: "application/pdf",
            fileSize: 154000,
            strength: "STRONG",
            verified: true,
          },
        ],
      },
      analysis: {
        create: {
          summary: "Dispute PP-D-61023 (MERCHANDISE_OR_SERVICE_NOT_RECEIVED) for USD 79.99. URGENT: Response deadline expires in 3 hours. Carrier confirmed delivery to zip 10036. Recommended: SUBMIT EVIDENCE IMMEDIATELY.",
          completenessScore: 91,
          recommendedAction: "PROVIDE_EVIDENCE",
          recommendationRationale: "USPS carrier delivery timestamp and zip code (10036) directly match buyer's shipping address. Case is fully documented and ready for 1-click submission.",
          keyStrengthsJson: JSON.stringify([
            "Official USPS tracking confirms delivery to destination zip 10036.",
            "Order details match authorized checkout data.",
            "Evidence meets all PayPal Seller Protection requirements.",
          ]),
          criticalGapsJson: JSON.stringify([
            "URGENCY GAP: Deadline is under 3 hours. Action required now to prevent automatic buyer default award.",
          ]),
          rebuttalDraft: `To PayPal Dispute Resolution Team,\n\nRegarding Dispute PP-D-61023 for USD 79.99 (Order #AG-95110):\nFulfillment record demonstrates shipment via USPS under tracking 9400111899223190284712 to 320 West 42nd Street, Apt 11C, New York, NY 10036. Official USPS records confirm delivery to the address.\n\nRespectfully submitted,\nMerchant Operations`,
          citationsJson: JSON.stringify([
            { fact: "USPS Tracking #9400111899223190284712 delivered", source: "USPS Carrier API", verified: true },
          ]),
          riskLevel: "LOW",
        },
      },
    },
  });

  // 4. Case 4: "Unauthorised Transaction" (AVS / Seller Protection Match)
  const dispute4 = await prisma.dispute.create({
    data: {
      paypalDisputeId: "PP-D-72149",
      status: "WAITING_FOR_SELLER",
      disputeLifeCycleStage: "INQUIRY",
      reason: "UNAUTHORISED",
      disputeAmount: 165.00,
      currency: "USD",
      buyerId: "BUYER-55209",
      buyerName: "Chloe Davenport",
      buyerEmail: "chloe.davenport@example.com",
      sellerTransactionId: "TXN-552190884",
      createTime: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      responseDueDate: new Date(Date.now() + 8 * 24 * 3600 * 1000),
      externalReasonCode: "FRAUD_CLAIM_CARD_NOT_PRESENT",
      merchantNotes: "Buyer states card was used without authorization. Checkout passed 3D Secure / AVS match.",
      aiAnalyzed: false,
      order: {
        create: {
          orderNumber: "AG-95620",
          orderDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
          customerName: "Chloe Davenport",
          customerEmail: "chloe.davenport@example.com",
          shippingAddress: "450 North Brand Blvd, Suite 700, Glendale, CA 91203",
          billingAddress: "450 North Brand Blvd, Suite 700, Glendale, CA 91203",
          orderTotal: 165.00,
          currency: "USD",
          itemsJson: JSON.stringify([
            { description: "Apex Merino 250 Thermal Base Layer Set", sku: "AG-BASE-M250", qty: 1, price: 165.00 },
          ]),
          paymentMethod: "PayPal Verified Checkout",
        },
      },
      trackingInfo: {
        create: {
          carrier: "FEDEX",
          trackingNumber: "774910284910",
          status: "DELIVERED",
          shippedDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
          deliveredDate: new Date(Date.now() - 2 * 24 * 3600 * 1000),
          destinationZip: "91203",
          signedBy: "C. DAVENPORT",
          deliveryProofUrl: "https://fedex.example.com/proofs/774910284910.pdf",
        },
      },
      evidenceItems: {
        create: [
          {
            evidenceType: "PROOF_OF_DELIVERY",
            title: "FedEx Signed Proof of Delivery to Billing Address",
            description: "Proof of delivery signed by C. Davenport at the exact billing address authorized in PayPal checkout.",
            fileName: "fedex_pod_glendale.pdf",
            fileType: "application/pdf",
            fileSize: 215000,
            strength: "STRONG",
            verified: true,
          },
        ],
      },
    },
  });

  // 5. Case 5: Historical Resolved / Won Dispute with full audit trail
  const dispute5 = await prisma.dispute.create({
    data: {
      paypalDisputeId: "PP-D-50218",
      status: "RESOLVED",
      disputeLifeCycleStage: "CHARGEBACK",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      disputeAmount: 540.00,
      currency: "USD",
      buyerId: "BUYER-22019",
      buyerName: "Julian Thorne",
      buyerEmail: "j.thorne@example.com",
      sellerTransactionId: "TXN-441092831",
      createTime: new Date(Date.now() - 20 * 24 * 3600 * 1000),
      responseDueDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      merchantNotes: "Dispute decided in merchant favor by PayPal review team after evidence submitted by AutoSettle AI.",
      aiAnalyzed: true,
      aiConfidenceScore: 98,
      aiRecommendedAction: "PROVIDE_EVIDENCE",
      resolutionOutcome: "WON",
      order: {
        create: {
          orderNumber: "AG-92100",
          orderDate: new Date(Date.now() - 28 * 24 * 3600 * 1000),
          customerName: "Julian Thorne",
          customerEmail: "j.thorne@example.com",
          shippingAddress: "1200 Westlake Ave N, Seattle, WA 98109",
          billingAddress: "1200 Westlake Ave N, Seattle, WA 98109",
          orderTotal: 540.00,
          currency: "USD",
          itemsJson: JSON.stringify([
            { description: "Apex 4-Season All-Weather Geodesic Tent", sku: "AG-TENT-4S", qty: 1, price: 540.00 },
          ]),
          paymentMethod: "PayPal",
        },
      },
      trackingInfo: {
        create: {
          carrier: "UPS",
          trackingNumber: "1Z8888888888888888",
          status: "DELIVERED",
          shippedDate: new Date(Date.now() - 25 * 24 * 3600 * 1000),
          deliveredDate: new Date(Date.now() - 22 * 24 * 3600 * 1000),
          destinationZip: "98109",
          signedBy: "J. THORNE",
        },
      },
      analysis: {
        create: {
          summary: "Dispute PP-D-50218 successfully defended with 98% completeness. Full delivery signature and invoice verified.",
          completenessScore: 98,
          recommendedAction: "PROVIDE_EVIDENCE",
          recommendationRationale: "Complete fulfillment record with UPS signature match.",
          keyStrengthsJson: JSON.stringify([
            "Verifiable delivery with UPS signature confirmation.",
            "Billing and shipping address match.",
          ]),
          criticalGapsJson: JSON.stringify([]),
          rebuttalDraft: "Factual rebuttal submitted with proof of delivery.",
          citationsJson: JSON.stringify([
            { fact: "UPS Delivered to 98109", source: "UPS Tracking", verified: true },
          ]),
          riskLevel: "LOW",
        },
      },
      auditLogs: {
        create: [
          {
            action: "AUTO_ANALYZED",
            status: "SUCCESS",
            payloadSent: JSON.stringify({ mode: "auto_intake", score: 98 }),
            paypalResponse: null,
            submittedBy: "autosettle_agent",
            submittedAt: new Date(Date.now() - 19 * 24 * 3600 * 1000),
          },
          {
            action: "PROVIDE_EVIDENCE",
            status: "SUCCESS",
            payloadSent: JSON.stringify({
              evidence_type: "PROOF_OF_DELIVERY",
              carrier_name: "UPS",
              tracking_number: "1Z8888888888888888",
              notes: "Evidence provided via AutoSettle AI",
            }),
            paypalResponse: JSON.stringify({
              status: "UNDER_REVIEW",
              acknowledged_at: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(),
              http_code: 200,
            }),
            submittedBy: "merchant_authorized",
            submittedAt: new Date(Date.now() - 18 * 24 * 3600 * 1000),
          },
          {
            action: "SYNC_STATUS",
            status: "SUCCESS",
            payloadSent: null,
            paypalResponse: JSON.stringify({
              dispute_id: "PP-D-50218",
              status: "RESOLVED",
              dispute_outcome: { outcome_code: "RESOLVED_BUYER_FAVOUR_NO", seller_protection: "ELIGIBLE" },
            }),
            submittedBy: "system_sync",
            submittedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
          },
        ],
      },
    },
  });

  console.log("✅ Seed completed successfully! Created 5 rich dispute test cases.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
