import { PrismaClient, Dispute, Transaction, Order, TrackingInfo, EvidenceItem } from '@prisma/client';

/**
 * Types for timeline events and operational signals
 */
export interface TimelineEvent {
  type: string; // e.g. 'PAYMENT_CAPTURED', 'ORDER_CREATED', 'DISPUTE_CREATED', 'TRACKING_UPDATE'
  timestamp: Date;
  description: string;
}

export interface OperationalSignal {
  code: string; // e.g. 'MISSING_ORDER', 'NO_TRACKING', 'INCOMPLETE_EVIDENCE', 'REFUND_REQUIRED', 'INCONSISTENT_RECORDS'
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
}

/**
 * Assemble a unified timeline for a given dispute (by internal id).
 * Includes payment, order, tracking, and dispute events.
 */
export async function buildTimeline(prisma: PrismaClient, disputeId: string): Promise<TimelineEvent[]> {
  const dispute = await prisma.dispute.findFirst({
    where: { id: disputeId },
    include: {
      transaction: true,
      order: true,
      trackingInfo: true,
    },
  });

  if (!dispute) throw new Error('Dispute not found');

  const events: TimelineEvent[] = [];

  // 1. Dispute creation (webhook ingestion time not stored, approximate using createdAt)
  events.push({
    type: 'DISPUTE_CREATED',
    timestamp: dispute.createdAt,
    description: `Dispute ${dispute.paypalDisputeId} created with status ${dispute.status}`,
  });

  // 2. Transaction events (if present)
  if (dispute.transaction) {
    const t = dispute.transaction as Transaction;
    events.push({
      type: 'PAYMENT_CAPTURED',
      timestamp: t.transactionTime,
      description: `Payment of ${t.currency} ${t.grossAmount.toFixed(2)} captured (sellerTransactionId: ${t.sellerTransactionId})`,
    });
  }

  // 3. Order events
  if (dispute.order) {
    const o = dispute.order as Order;
    events.push({
      type: 'ORDER_CREATED',
      timestamp: o.orderDate,
      description: `Order ${o.orderNumber} created for ${o.customerName}`,
    });
    events.push({
      type: 'ORDER_FULFILLED',
      timestamp: o.updatedAt,
      description: `Order fulfillment status: ${o.fulfillmentStatus}`,
    });
  }

  // 4. Tracking events
  if (dispute.trackingInfo) {
    const tr = dispute.trackingInfo as TrackingInfo;
    events.push({
      type: 'TRACKING_ADDED',
      timestamp: tr.createdAt,
      description: `Tracking ${tr.trackingNumber} via ${tr.carrier} – status ${tr.status}`,
    });
    if (tr.deliveredDate) {
      events.push({
        type: 'DELIVERED',
        timestamp: tr.deliveredDate,
        description: `Package delivered to zip ${tr.destinationZip}`,
      });
    }
  }

  // 5. Dispute status updates (use updatedAt as rough proxy for latest status change)
  events.push({
    type: 'DISPUTE_STATUS_UPDATED',
    timestamp: dispute.updatedAt,
    description: `Dispute status now ${dispute.status}`,
  });

  // Sort chronologically
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return events;
}

/**
 * Generate operational signals based on the current data state.
 */
export async function generateSignals(prisma: PrismaClient, disputeId: string): Promise<OperationalSignal[]> {
  const dispute = await prisma.dispute.findFirst({
    where: { id: disputeId },
    include: {
      transaction: true,
      order: true,
      trackingInfo: true,
      evidenceItems: true,
    },
  });

  if (!dispute) throw new Error('Dispute not found');

  const signals: OperationalSignal[] = [];

  // Signal 1: Captured payment with missing order association
  if (dispute.transaction && !dispute.order) {
    signals.push({
      code: 'MISSING_ORDER',
      severity: 'WARNING',
      message: 'Payment captured but no linked merchant order record.',
    });
  }

  // Signal 2: Order marked shipped without tracking information
  if (dispute.order && dispute.order.fulfillmentStatus === 'FULFILLED' && !dispute.trackingInfo) {
    signals.push({
      code: 'NO_TRACKING',
      severity: 'INFO',
      message: 'Order fulfilled but no carrier tracking information attached.',
    });
  }

  // Signal 3: Dispute received with incomplete evidence
  if (dispute.evidenceItems.length === 0) {
    signals.push({
      code: 'INCOMPLETE_EVIDENCE',
      severity: 'WARNING',
      message: 'Dispute has no supporting evidence attached.',
    });
  }

  // Signal 4: Refund or reversal requiring attention (simplified: check if disputeAmount > 0 and status indicates refund)
  if (dispute.status.includes('REFUND')) {
    signals.push({
      code: 'REFUND_REQUIRED',
      severity: 'INFO',
      message: `Dispute amount ${dispute.disputeAmount} requires refund processing.`,
    });
  }

  // Signal 5: Inconsistent transaction and order records
  if (dispute.transaction && dispute.order) {
    const tEmail = dispute.transaction.payerEmail || '';
    const oEmail = dispute.order.customerEmail;
    if (tEmail && oEmail && tEmail !== oEmail) {
      signals.push({
        code: 'INCONSISTENT_RECORDS',
        severity: 'CRITICAL',
        message: 'Payer email on transaction does not match order customer email.',
      });
    }
  }

  return signals;
}
