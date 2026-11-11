import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paypal-webhook";
import { recordAuditLog } from "@/lib/audit";
import { ingestDisputeWebhook } from "@/lib/dispute-ingestion";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/paypal
 * Real PayPal Webhook Ingestion Endpoint.
 * Strictly requires cryptographic verification headers from PayPal.
 */
export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const eventType = body.event_type || "PAYMENT.DISPUTE.CREATED";
    const eventId =
      body.id || `WH-EVENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const resource = body.resource || {};

    const webhookId = process.env.PAYPAL_WEBHOOK_ID || "";

    // Convert Next.js Headers object to a plain record for verification
    const headerRecord: Record<string, string> = {};
    req.headers.forEach((value: string, key: string) => {
      headerRecord[key] = value;
    });

    // 1. Strict PayPal Cryptographic Signature Verification
    const verification = await verifyWebhookSignature(
      body,
      headerRecord,
      webhookId
    );

    if (!verification.valid) {
      await recordAuditLog({
        disputeId: undefined,
        eventType: "WEBHOOK_VERIFICATION_FAILED",
        severity: "ERROR",
        summary: `Webhook verification failed: ${verification.message}`,
        actor: "system_webhook",
      });

      return NextResponse.json(
        {
          success: false,
          error: "Invalid PayPal webhook signature: Missing or invalid verification headers",
        },
        { status: 400 }
      );
    }

    // 2. Delegate to Core Ingestion Service (marked as verified real PayPal event)
    const result = await ingestDisputeWebhook({
      eventId,
      eventType,
      payload: body,
      resource,
      isSimulated: false,
      signatureVerified: true,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/webhooks/paypal error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process webhook" },
      { status: 500 }
    );
  }
}
