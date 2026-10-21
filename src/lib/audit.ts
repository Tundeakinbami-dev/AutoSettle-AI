import prisma from "./prisma";

export type AuditEventType =
  | "DISPUTE_CREATED"
  | "DISPUTE_UPDATED"
  | "WEBHOOK_RECEIVED"
  | "WEBHOOK_VERIFIED"
  | "EVIDENCE_RETRIEVED"
  | "EVIDENCE_ADDED"
  | "AI_ANALYSIS_GENERATED"
  | "RESPONSE_EDITED"
  | "APPROVAL_GRANTED"
  | "SUBMISSION_ATTEMPTED"
  | "API_RESULT_RECEIVED"
  | "SUBMISSION_FAILED"
  | "RETRY_ATTEMPTED";

export interface LogAuditParams {
  disputeId?: string;
  merchantId?: string;
  eventType: AuditEventType;
  severity?: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  summary: string;
  details?: Record<string, any> | null;
  actor?: "merchant_user" | "ai_agent" | "system_webhook" | "paypal_api";
  actorId?: string;
}

/**
 * Sensitive Data Sanitizer
 * Removes access tokens, client secrets, full card numbers, and authorization headers.
 */
export function sanitizeData(data: any): any {
  if (!data) return data;
  if (typeof data === "string") {
    // Mask potential token/secret strings
    return data.replace(/([a-zA-Z0-9_-]{20,})/g, (match) => {
      if (match.length > 28) return `${match.slice(0, 4)}••••${match.slice(-4)}`;
      return match;
    });
  }
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  const sanitized: Record<string, any> = {};
  const sensitiveKeys = [
    "secret",
    "clientsecret",
    "client_secret",
    "token",
    "access_token",
    "refreshtoken",
    "refresh_token",
    "authorization",
    "password",
    "credit_card",
    "card_number",
    "cvv",
  ];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      sanitized[key] = "[REDACTED_SENSITIVE_CREDENTIAL]";
    } else {
      sanitized[key] = sanitizeData(value);
    }
  }

  return sanitized;
}

/**
 * Record immutable audit log entry
 */
export async function recordAuditLog(params: LogAuditParams) {
  try {
    const sanitizedDetails = params.details ? JSON.stringify(sanitizeData(params.details)) : null;

    return await prisma.auditLogEntry.create({
      data: {
        disputeId: params.disputeId || null,
        merchantId: params.merchantId || "default_merchant",
        eventType: params.eventType,
        severity: params.severity || "INFO",
        summary: params.summary,
        detailsJson: sanitizedDetails,
        actor: params.actor || "ai_agent",
        actorId: params.actorId || null,
        timestamp: new Date(),
      },
    });
  } catch (err) {
    console.error("Failed to record audit log entry:", err);
    return null;
  }
}
