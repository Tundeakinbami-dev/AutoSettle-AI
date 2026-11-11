import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ingestDisputeWebhook } from "@/lib/dispute-ingestion";

export const dynamic = "force-dynamic";

const SUPPORTED_EVENT_TYPES = [
  "PAYMENT.DISPUTE.CREATED",
  "PAYMENT.DISPUTE.UPDATED",
  "PAYMENT.DISPUTE.RESOLVED",
];

const SUPPORTED_SCENARIOS = ["INR", "SNAD", "UNAUTH"];

/**
 * POST /api/webhooks/simulate
 * Dedicated internal simulation endpoint for Webhook Lab.
 * Enables developer and merchant testing of dispute lifecycle webhooks without
 * exposing bypasses or compromising real PayPal cryptographic webhook security.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Simulation / Demo Mode Environment Guard
    const merchant = await prisma.merchant.findFirst({
      where: { id: "default_merchant" },
    });

    const isSimulationAllowed =
      process.env.APP_MODE === "DEMO" ||
      process.env.APP_MODE === "SANDBOX" ||
      merchant?.mode === "DEMO" ||
      process.env.NODE_ENV !== "production" ||
      process.env.ENABLE_WEBHOOK_SIMULATOR === "true";

    if (!isSimulationAllowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Webhook simulation is disabled in live production mode. Switch to DEMO mode or configure ENABLE_WEBHOOK_SIMULATOR=true.",
        },
        { status: 403 }
      );
    }

    // 2. Server-Side Origin & Authorization Guard
    const authHeader =
      req.headers.get("authorization") ||
      req.headers.get("x-simulator-auth") ||
      "";
    const host = req.headers.get("host") || "";
    const origin = req.headers.get("origin") || "";
    const referer = req.headers.get("referer") || "";

    // If SIMULATOR_API_KEY or SIMULATOR_SECRET is set, enforce token authorization
    if (process.env.SIMULATOR_API_KEY) {
      const expected = `Bearer ${process.env.SIMULATOR_API_KEY}`;
      if (authHeader !== expected && authHeader !== process.env.SIMULATOR_API_KEY) {
        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized: Invalid or missing simulation API key.",
          },
          { status: 401 }
        );
      }
    } else {
      // In production without dedicated secret, verify same-origin or localhost
      const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
      const isSameOrigin = origin ? origin.includes(host) : referer ? referer.includes(host) : isLocalhost;

      if (!isSameOrigin && process.env.NODE_ENV === "production") {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden: Cross-origin simulation requests are rejected in production.",
          },
          { status: 403 }
        );
      }
    }

    // 3. Payload Parsing & Validation
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Malformed payload: Expected JSON object" },
        { status: 400 }
      );
    }

    const eventType = body.event_type;
    if (!eventType || !SUPPORTED_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported event_type: '${eventType}'. Supported types: ${SUPPORTED_EVENT_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (body.scenario && !SUPPORTED_SCENARIOS.includes(body.scenario)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported scenario: '${body.scenario}'. Supported scenarios: ${SUPPORTED_SCENARIOS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate resource if provided
    const resource = body.resource || {};
    if (resource.dispute_amount) {
      const amountVal = parseFloat(resource.dispute_amount.value);
      if (isNaN(amountVal) || amountVal <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid dispute_amount: Amount must be a positive number.",
          },
          { status: 400 }
        );
      }
    }

    // 4. Construct Deterministic / Idempotent Event Identifier
    const eventId =
      body.id ||
      body.eventId ||
      `WH-SIM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Explicitly annotate simulated metadata so it can never be mistaken for real PayPal event
    const simulatedPayload = {
      ...body,
      _simulation: {
        is_simulated: true,
        dispatched_by: "AutoSettle AI Webhook Simulator",
        simulated_at: new Date().toISOString(),
      },
    };

    // 5. Ingest via Shared Business Service
    const result = await ingestDisputeWebhook({
      eventId,
      eventType,
      payload: simulatedPayload,
      resource,
      isSimulated: true,
      signatureVerified: false, // Clearly false: simulated event, not cryptographically signed by PayPal
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/webhooks/simulate error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process simulated webhook" },
      { status: 500 }
    );
  }
}
