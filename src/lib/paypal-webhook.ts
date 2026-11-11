// PayPal Webhook Signature Verification Helper
// -------------------------------------------------
// Provides a thin wrapper around PayPal's "Verify Webhook Signature" API.
// Used by the webhook endpoint to ensure incoming events are authentic.
//
// The function expects the raw JSON payload received from PayPal and the
// request headers. It obtains an OAuth2 access token via the existing
// PayPalDisputesClient and then calls the verification endpoint.
// If any step fails, it returns false and logs a warning.

import { PayPalDisputesClient } from "./paypal";

export interface VerificationResult {
  valid: boolean;
  status: number;
  message: string;
}

/**
 * Verify a PayPal webhook signature.
 *
 * @param payload     The raw JSON body sent by PayPal (object).
 * @param headers     The request headers object (key‑value map). Must contain
 *                    "paypal-transmission-id", "paypal-transmission-time",
 *                    "paypal-transmission-sig", "paypal-auth-algo",
 *                    and "paypal-cert-url".
 * @param webhookId   PayPal webhook ID configured for this merchant.
 * @returns           VerificationResult – `valid` true when signature checks out.
 */
export async function verifyWebhookSignature(
  payload: any,
  headers: Record<string, string | string[]>,
  webhookId: string
): Promise<VerificationResult> {
  // Extract required PayPal transmission headers (case‑insensitive).
  const getHeader = (name: string) => {
    const val = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(val)) return val[0];
    return val as string | undefined;
  };

  const transmissionId = getHeader("paypal-transmission-id");
  const transmissionTime = getHeader("paypal-transmission-time");
  const certUrl = getHeader("paypal-cert-url");
  const authAlgo = getHeader("paypal-auth-algo");
  const transmissionSig = getHeader("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.warn("Missing required PayPal webhook verification headers.");
    return { valid: false, status: 400, message: "Missing verification headers" };
  }

  const client = new PayPalDisputesClient();
  const accessToken = await client.getAccessToken();

  try {
    const res = await fetch(`${client['baseUrl']}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: payload,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`PayPal webhook verification failed (${res.status}): ${err}`);
      return { valid: false, status: res.status, message: err };
    }
    const data = await res.json();
    // PayPal returns { verification_status: "SUCCESS" } on success.
    const isValid = data?.verification_status === "SUCCESS";
    return { valid: isValid, status: res.status, message: data?.verification_status || "unknown" };
  } catch (e) {
    console.warn("Exception during PayPal webhook verification:", e);
    return { valid: false, status: 500, message: (e as Error).message };
  }
}
