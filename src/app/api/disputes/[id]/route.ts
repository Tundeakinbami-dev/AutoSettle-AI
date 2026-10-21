import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const dispute = await prisma.dispute.findFirst({
      where: {
        OR: [
          { id },
          { paypalDisputeId: id },
        ],
      },
      include: {
        order: true,
        trackingInfo: true,
        evidenceItems: {
          orderBy: { createdAt: "desc" },
        },
        messages: {
          orderBy: { timestamp: "asc" },
        },
        analysis: true,
        auditLogs: {
          orderBy: { submittedAt: "desc" },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Dispute not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      dispute,
    });
  } catch (error: any) {
    console.error("GET /api/disputes/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch dispute details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const updated = await prisma.dispute.update({
      where: { id },
      data: {
        merchantNotes: body.merchantNotes,
        status: body.status,
      },
    });

    return NextResponse.json({ success: true, dispute: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update dispute" },
      { status: 500 }
    );
  }
}
