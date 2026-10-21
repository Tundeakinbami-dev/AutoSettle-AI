import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    let merchant = await prisma.merchant.findFirst({
      where: { id: "default_merchant" },
      include: {
        paypalConnection: true,
      },
    });

    if (!merchant) {
      merchant = await prisma.merchant.create({
        data: {
          id: "default_merchant",
          businessName: "Apex Gear Outfitters",
          supportEmail: "support@apexgear.example.com",
          requireHumanApproval: true, // DEFAULT REQUIREMENT: Human approval mandatory!
          strictEvidenceEnforced: true,
          autoAnalyzeOnArrival: true,
          paypalConnection: {
            create: {
              environment: "sandbox",
              status: "SIMULATION",
              clientId: process.env.PAYPAL_CLIENT_ID || "",
              clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
            },
          },
        },
        include: { paypalConnection: true },
      });
    }

    const conn = merchant.paypalConnection;

    return NextResponse.json({
      success: true,
      settings: {
        id: merchant.id,
        businessName: merchant.businessName,
        supportEmail: merchant.supportEmail,
        requireHumanApproval: merchant.requireHumanApproval, // DEFAULT: true
        strictEvidenceEnforced: merchant.strictEvidenceEnforced,
        autoAnalyzeOnArrival: merchant.autoAnalyzeOnArrival,
        paypalEnvironment: conn?.environment || "sandbox",
        paypalClientId: conn?.clientId || "",
        paypalClientSecret: conn?.clientSecret
          ? `${conn.clientSecret.slice(0, 4)}••••••••${conn.clientSecret.slice(-4)}`
          : "",
        hasLivePayPalConfig: Boolean(conn?.clientId && conn?.clientSecret && conn.clientId.trim() !== ""),
        connectionStatus: conn?.status || "SIMULATION",
      },
    });
  } catch (error: any) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const merchantUpdate: any = {
      businessName: body.businessName,
      supportEmail: body.supportEmail,
      requireHumanApproval: body.requireHumanApproval !== undefined ? Boolean(body.requireHumanApproval) : true,
      strictEvidenceEnforced: Boolean(body.strictEvidenceEnforced),
      autoAnalyzeOnArrival: Boolean(body.autoAnalyzeOnArrival),
    };

    const updatedMerchant = await prisma.merchant.upsert({
      where: { id: "default_merchant" },
      create: {
        id: "default_merchant",
        ...merchantUpdate,
      },
      update: merchantUpdate,
    });

    const connUpdate: any = {
      environment: body.paypalEnvironment || "sandbox",
    };
    if (body.paypalClientId !== undefined) {
      connUpdate.clientId = body.paypalClientId;
    }
    if (body.paypalClientSecret && !body.paypalClientSecret.includes("•••")) {
      connUpdate.clientSecret = body.paypalClientSecret;
    }

    await prisma.payPalConnection.upsert({
      where: { merchantId: updatedMerchant.id },
      create: {
        merchantId: updatedMerchant.id,
        ...connUpdate,
        status: connUpdate.clientId ? "CONNECTED" : "SIMULATION",
      },
      update: {
        ...connUpdate,
        status: connUpdate.clientId ? "CONNECTED" : "SIMULATION",
      },
    });

    await recordAuditLog({
      merchantId: updatedMerchant.id,
      eventType: "DISPUTE_UPDATED",
      severity: "INFO",
      summary: `Merchant configuration updated. Human approval required: ${updatedMerchant.requireHumanApproval}.`,
      details: {
        businessName: updatedMerchant.businessName,
        requireHumanApproval: updatedMerchant.requireHumanApproval,
      },
      actor: "merchant_user",
    });

    return NextResponse.json({
      success: true,
      message: "Merchant and PayPal connection settings saved.",
      settings: updatedMerchant,
    });
  } catch (error: any) {
    console.error("POST /api/settings error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
