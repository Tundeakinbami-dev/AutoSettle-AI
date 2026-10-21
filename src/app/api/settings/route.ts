import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    let settings = await prisma.merchantSettings.findFirst({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await prisma.merchantSettings.create({
        data: {
          id: "default",
          businessName: "Apex Gear Outfitters",
          supportEmail: "support@apexgear.example.com",
          paypalClientId: process.env.PAYPAL_CLIENT_ID || "",
          paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
          paypalEnvironment: "sandbox",
          openAiApiKey: process.env.OPENAI_API_KEY || "",
          autoAnalyzeOnArrival: true,
          strictEvidenceEnforced: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        ...settings,
        // Mask secret for UI security display
        paypalClientSecret: settings.paypalClientSecret
          ? `${settings.paypalClientSecret.slice(0, 4)}••••••••${settings.paypalClientSecret.slice(-4)}`
          : "",
        openAiApiKey: settings.openAiApiKey
          ? `${settings.openAiApiKey.slice(0, 3)}••••••••${settings.openAiApiKey.slice(-4)}`
          : "",
        hasLivePayPalConfig: Boolean(
          settings.paypalClientId &&
          settings.paypalClientSecret &&
          settings.paypalClientId.trim() !== ""
        ),
        hasLiveOpenAiConfig: Boolean(
          settings.openAiApiKey &&
          settings.openAiApiKey.trim() !== ""
        ),
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

    const updateData: any = {
      businessName: body.businessName,
      supportEmail: body.supportEmail,
      paypalEnvironment: body.paypalEnvironment || "sandbox",
      autoAnalyzeOnArrival: Boolean(body.autoAnalyzeOnArrival),
      strictEvidenceEnforced: Boolean(body.strictEvidenceEnforced),
    };

    if (body.paypalClientId !== undefined) {
      updateData.paypalClientId = body.paypalClientId;
    }
    if (body.paypalClientSecret && !body.paypalClientSecret.includes("•••")) {
      updateData.paypalClientSecret = body.paypalClientSecret;
    }
    if (body.openAiApiKey && !body.openAiApiKey.includes("•••")) {
      updateData.openAiApiKey = body.openAiApiKey;
    }

    const updated = await prisma.merchantSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Merchant settings saved successfully.",
      settings: updated,
    });
  } catch (error: any) {
    console.error("POST /api/settings error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
