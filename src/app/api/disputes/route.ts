import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const reason = searchParams.get("reason");
    const search = searchParams.get("search");

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (reason && reason !== "ALL") {
      where.reason = reason;
    }

    if (search && search.trim() !== "") {
      const q = search.trim();
      where.OR = [
        { paypalDisputeId: { contains: q } },
        { buyerName: { contains: q } },
        { buyerEmail: { contains: q } },
        { sellerTransactionId: { contains: q } },
      ];
    }

    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        order: true,
        trackingInfo: true,
        analysis: true,
        evidenceItems: {
          select: { id: true, evidenceType: true, strength: true, title: true, verified: true },
        },
        _count: {
          select: { messages: true, evidenceItems: true, auditLogs: true },
        },
      },
      orderBy: [
        { responseDueDate: "asc" },
      ],
    });

    return NextResponse.json({
      success: true,
      count: disputes.length,
      disputes,
    });
  } catch (error: any) {
    console.error("GET /api/disputes error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch disputes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const paypalDisputeId = body.paypalDisputeId || `PP-D-${Math.floor(10000 + Math.random() * 90000)}`;
    const reason = body.reason || "MERCHANDISE_OR_SERVICE_NOT_RECEIVED";
    const amount = parseFloat(body.disputeAmount) || 129.99;
    const buyerName = body.buyerName || "Jordan Smith";
    const buyerEmail = body.buyerEmail || "jordan.smith@example.com";
    const responseDueDate = body.responseDueDate
      ? new Date(body.responseDueDate)
      : new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const dispute = await prisma.dispute.create({
      data: {
        paypalDisputeId,
        status: "REQUIRED_ACTION",
        disputeLifeCycleStage: "CHARGEBACK",
        reason,
        disputeAmount: amount,
        currency: body.currency || "USD",
        buyerName,
        buyerEmail,
        sellerTransactionId: body.sellerTransactionId || `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`,
        responseDueDate,
        merchantNotes: body.merchantNotes || "Simulated dispute intake for demonstration testing.",
        order: {
          create: {
            orderNumber: body.orderNumber || `AG-${Math.floor(90000 + Math.random() * 9999)}`,
            orderDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
            customerName: buyerName,
            customerEmail: buyerEmail,
            shippingAddress: body.shippingAddress || "1400 6th Ave, Seattle, WA 98101",
            billingAddress: body.shippingAddress || "1400 6th Ave, Seattle, WA 98101",
            orderTotal: amount,
            itemsJson: JSON.stringify([
              { description: "Summit Expedition Daypack (30L)", sku: "AG-BAG-30L", qty: 1, price: amount },
            ]),
          },
        },
        trackingInfo: {
          create: {
            carrier: body.carrier || "UPS",
            trackingNumber: body.trackingNumber || `1Z${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`,
            status: body.trackingStatus || "DELIVERED",
            shippedDate: new Date(Date.now() - 8 * 24 * 3600 * 1000),
            deliveredDate: new Date(Date.now() - 4 * 24 * 3600 * 1000),
            destinationZip: "98101",
            signedBy: "J. SMITH",
          },
        },
      },
      include: {
        order: true,
        trackingInfo: true,
      },
    });

    return NextResponse.json({ success: true, dispute });
  } catch (error: any) {
    console.error("POST /api/disputes error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create dispute" },
      { status: 500 }
    );
  }
}
