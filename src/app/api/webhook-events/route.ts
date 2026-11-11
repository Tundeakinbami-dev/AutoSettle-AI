import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/webhook-events
 * Returns paginated webhook event history from the WebhookEvent table.
 * Supports ?limit=&offset=&eventType= query parameters.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0");
    const eventType = searchParams.get("eventType");

    const where: any = {};
    if (eventType && eventType !== "ALL") where.eventType = eventType;

    const [events, total] = await Promise.all([
      prisma.webhookEvent.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          dispute: {
            select: {
              id: true,
              paypalDisputeId: true,
              status: true,
              buyerName: true,
              disputeAmount: true,
              currency: true,
            },
          },
        },
      }),
      prisma.webhookEvent.count({ where }),
    ]);

    return NextResponse.json({ success: true, events, total, limit, offset });
  } catch (error: any) {
    console.error("GET /api/webhook-events error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch webhook events" },
      { status: 500 }
    );
  }
}
