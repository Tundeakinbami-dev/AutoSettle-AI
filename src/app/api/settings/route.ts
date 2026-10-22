// src/app/api/settings/route.ts
// Settings API – GET current merchant configuration and POST updates.
// Supports mode selection (DEMO | SANDBOX) stored in the Merchant model.
// Input validation & safe error handling are applied.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Utility to pick only allowed fields from the request body.
function sanitizeInput(body: any) {
  const allowed = [
    "businessName",
    "supportEmail",
    "paypalClientId",
    "paypalClientSecret",
    "paypalEnvironment",
    "mode",
    "requireHumanApproval",
    "autoAnalyzeOnArrival",
    "strictEvidenceEnforced",
  ];
  const sanitized: any = {};
  for (const key of allowed) {
    if (body[key] !== undefined) sanitized[key] = body[key];
  }
  return sanitized;
}

export async function GET(_: NextRequest) {
  try {
    // For this demo we assume a single merchant (default_merchant).
    const merchant = await prisma.merchant.findFirst({
      where: { id: "default_merchant" },
      include: { paypalConnection: true },
    });
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Merchant not found" },
        { status: 404 }
      );
    }
    // Assemble response (omit secrets when mode is DEMO).
    const data: any = {
      businessName: merchant.businessName,
      supportEmail: merchant.supportEmail,
      requireHumanApproval: merchant.requireHumanApproval,
      autoAnalyzeOnArrival: merchant.autoAnalyzeOnArrival,
      strictEvidenceEnforced: merchant.strictEvidenceEnforced,
      mode: (merchant as any).mode ?? "DEMO",
    };
    if (merchant.payPalConnection) {
      data.paypalEnvironment = merchant.payPalConnection.environment;
      if (merchant.payPalConnection.clientId) data.paypalClientId = merchant.payPalConnection.clientId;
      // Never expose secret in GET – client can leave blank to keep existing.
    }
    return NextResponse.json({ success: true, settings: data });
  } catch (error: any) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updates = sanitizeInput(body);
    // Basic validation – ensure non‑empty strings where required.
    if (updates.businessName && typeof updates.businessName !== "string") {
      return NextResponse.json({ success: false, error: "Invalid businessName" }, { status: 400 });
    }
    if (updates.supportEmail && typeof updates.supportEmail !== "string") {
      return NextResponse.json({ success: false, error: "Invalid supportEmail" }, { status: 400 });
    }
    // Update PayPal connection separately if credentials are provided.
    const connectionUpdates: any = {};
    if (updates.paypalClientId !== undefined) connectionUpdates.clientId = updates.paypalClientId;
    if (updates.paypalClientSecret !== undefined) connectionUpdates.clientSecret = updates.paypalClientSecret;
    if (updates.paypalEnvironment !== undefined) connectionUpdates.environment = updates.paypalEnvironment;

    // Transaction ensures both merchant and connection stay consistent.
    const result = await prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.update({
        where: { id: "default_merchant" },
        data: {
          businessName: updates.businessName,
          supportEmail: updates.supportEmail,
          requireHumanApproval: updates.requireHumanApproval,
          autoAnalyzeOnArrival: updates.autoAnalyzeOnArrival,
          strictEvidenceEnforced: updates.strictEvidenceEnforced,
          mode: updates.mode,
        },
      });
      if (Object.keys(connectionUpdates).length > 0) {
        await tx.payPalConnection.upsert({
          where: { merchantId: merchant.id },
          create: { merchantId: merchant.id, ...connectionUpdates },
          update: connectionUpdates,
        });
      }
      return merchant;
    });
    return NextResponse.json({ success: true, settings: result });
  } catch (error: any) {
    console.error("POST /api/settings error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
