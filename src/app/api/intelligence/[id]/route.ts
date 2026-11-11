import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildTimeline, generateSignals } from "@/lib/payment-intelligence";

/**
 * GET /api/intelligence/:id
 * Returns a unified transaction timeline and operational signals for a given dispute.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params; // PayPal dispute ID (paypalDisputeId)
  try {
    // Find internal dispute ID
    const dispute = await prisma.dispute.findFirst({
      where: { paypalDisputeId: id },
      select: { id: true },
    });
    if (!dispute) {
      return NextResponse.json({ success: false, error: "Dispute not found" }, { status: 404 });
    }

    const timeline = await buildTimeline(prisma, dispute.id);
    const signals = await generateSignals(prisma, dispute.id);

    return NextResponse.json({ success: true, timeline, signals });
  } catch (err: any) {
    console.error("GET /api/intelligence/[id] error:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch intelligence" }, { status: 500 });
  }
}
