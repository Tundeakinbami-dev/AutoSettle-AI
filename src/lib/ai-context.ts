import { Dispute, TrackingInfo, EvidenceItem, Order, Merchant } from "@prisma/client";
import prisma from "@/lib/prisma";
import { DisputeContext } from "./ai-agent";

/**
 * Build the DisputeContext object consumed by the AI analysis engine.
 * Mirrors the logic used in the webhook handler but can be reused elsewhere.
 */
export async function buildDisputeContext(disputeId: string): Promise<DisputeContext> {
  const dispute = await prisma.dispute.findFirst({
    where: { id: disputeId },
    include: {
      transaction: true,
      order: true,
      trackingInfo: true,
      evidenceItems: true,
      messages: true,
    },
  });

  if (!dispute) throw new Error("Dispute not found");

  const ctx: DisputeContext = {
    disputeId: dispute.id,
    paypalDisputeId: dispute.paypalDisputeId,
    reason: dispute.reason,
    disputeAmount: dispute.disputeAmount,
    currency: dispute.currency,
    buyerName: dispute.buyerName,
    buyerEmail: dispute.buyerEmail,
    sellerTransactionId: dispute.transaction?.sellerTransactionId || "",
    responseDueDate: dispute.responseDueDate,
    order: dispute.order
      ? {
          orderNumber: dispute.order.orderNumber,
          orderDate: dispute.order.orderDate,
          customerName: dispute.order.customerName,
          customerEmail: dispute.order.customerEmail,
          shippingAddress: dispute.order.shippingAddress,
          orderTotal: dispute.order.orderTotal,
          items: JSON.parse(dispute.order.itemsJson || "[]"),
        }
      : null,
    tracking: dispute.trackingInfo
      ? {
          carrier: dispute.trackingInfo.carrier,
          trackingNumber: dispute.trackingInfo.trackingNumber,
          status: dispute.trackingInfo.status,
          shippedDate: dispute.trackingInfo.shippedDate,
          deliveredDate: dispute.trackingInfo.deliveredDate,
          destinationZip: dispute.trackingInfo.destinationZip,
          signedBy: dispute.trackingInfo.signedBy,
        }
      : null,
    messages: dispute.messages.map((m) => ({
      sender: m.sender,
      channel: m.channel,
      timestamp: m.timestamp,
      messageText: m.messageText,
    })),
    evidenceItems: dispute.evidenceItems.map((e) => ({
      evidenceType: e.evidenceType,
      title: e.title,
      description: e.description,
      strength: e.strength,
      verified: e.verified,
    })),
  };

  return ctx;
}
