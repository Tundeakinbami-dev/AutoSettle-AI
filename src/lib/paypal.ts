/**
 * PayPal Disputes API Client
 * Supports three strict execution modes:
 * - INTERNAL_SIMULATION: Internal mock responses only; strictly zero external network requests.
 * - PAYPAL_SANDBOX: External PayPal Sandbox requests, only when explicitly configured and authorized.
 * - PAYPAL_LIVE: Prohibited in DEMO/HACKATHON mode.
 */

export type PayPalExecutionMode =
  | "INTERNAL_SIMULATION"
  | "PAYPAL_SANDBOX"
  | "PAYPAL_LIVE";

export interface PayPalConfig {
  clientId?: string;
  clientSecret?: string;
  environment: "sandbox" | "live";
  isSimulation?: boolean; // Explicit simulation flag
  forceMode?: PayPalExecutionMode;
}

export interface ProvideEvidenceParams {
  disputeId: string;
  evidenceType: string;
  notes: string;
  trackingNumber?: string;
  carrierName?: string;
  documents?: { name: string; url?: string }[];
}

export interface AcceptClaimParams {
  disputeId: string;
  note: string;
}

export interface MakeOfferParams {
  disputeId: string;
  note: string;
  offerAmount: string;
  currencyCode?: string;
}

/**
 * Recognized placeholder patterns that must NEVER be treated as genuine credentials
 */
export function isPlaceholderCredential(val?: string | null): boolean {
  if (!val || typeof val !== "string") return true;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed.length < 8) return true;
  const upper = trimmed.toUpperCase();
  return (
    upper.includes("YOUR_") ||
    upper.includes("PLACEHOLDER") ||
    upper.includes("TEST_CLIENT") ||
    upper.includes("SANDBOX_CLIENT_ID") ||
    upper.includes("SANDBOX_CLIENT_SECRET") ||
    upper.includes("EXAMPLE") ||
    upper.includes("MOCK")
  );
}

export class PayPalDisputesClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private executionMode: PayPalExecutionMode;

  constructor(config?: Partial<PayPalConfig>) {
    const rawClientId =
      config?.clientId !== undefined
        ? config.clientId
        : (process.env.PAYPAL_CLIENT_ID || "");
    const rawClientSecret =
      config?.clientSecret !== undefined
        ? config.clientSecret
        : (process.env.PAYPAL_CLIENT_SECRET || "");

    this.clientId = rawClientId.trim();
    this.clientSecret = rawClientSecret.trim();

    const env = config?.environment || process.env.PAYPAL_ENVIRONMENT || "sandbox";
    this.baseUrl =
      env === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

    const isDemoAppMode =
      process.env.APP_MODE === "DEMO" ||
      process.env.APP_MODE === "HACKATHON" ||
      process.env.APP_MODE === "SIMULATION";

    // 1. Prohibit PAYPAL_LIVE in DEMO/HACKATHON mode
    if ((env === "live" || config?.forceMode === "PAYPAL_LIVE") && isDemoAppMode) {
      throw new Error("PAYPAL_LIVE mode is strictly prohibited in DEMO/HACKATHON environment.");
    }

    // 2. Explicit Simulation Priority
    if (config?.isSimulation === true || config?.forceMode === "INTERNAL_SIMULATION") {
      this.executionMode = "INTERNAL_SIMULATION";
      return;
    }

    // 3. Demo / Hackathon Mode Enforcement: Force internal simulation
    if (isDemoAppMode && config?.forceMode !== "PAYPAL_SANDBOX") {
      this.executionMode = "INTERNAL_SIMULATION";
      return;
    }

    // 3. Placeholder Credential Check
    const hasPlaceholder =
      isPlaceholderCredential(this.clientId) ||
      isPlaceholderCredential(this.clientSecret);

    if (hasPlaceholder) {
      if (config?.forceMode === "PAYPAL_SANDBOX" || config?.forceMode === "PAYPAL_LIVE") {
        throw new Error(
          `Cannot initialize ${config.forceMode}: PayPal credentials contain placeholder or empty values.`
        );
      }
      // Never silently fall back to Sandbox/Live with placeholders
      this.executionMode = "INTERNAL_SIMULATION";
      return;
    }

    // 4. Genuine Credentials: Check Environment
    if (env === "live") {
      if (isDemoAppMode) {
        throw new Error("PAYPAL_LIVE mode is prohibited in DEMO/HACKATHON environment.");
      }
      this.executionMode = "PAYPAL_LIVE";
    } else {
      this.executionMode = "PAYPAL_SANDBOX";
    }
  }

  get mode(): PayPalExecutionMode {
    return this.executionMode;
  }

  get isSimulation(): boolean {
    return this.executionMode === "INTERNAL_SIMULATION";
  }

  get isLiveConfigured(): boolean {
    return this.executionMode === "PAYPAL_SANDBOX" || this.executionMode === "PAYPAL_LIVE";
  }

  /**
   * Fetch OAuth2 Bearer Access Token from PayPal
   */
  async getAccessToken(): Promise<string> {
    if (this.executionMode === "INTERNAL_SIMULATION") {
      return "simulated_paypal_sandbox_bearer_token_" + Date.now();
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
      const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`PayPal OAuth failed (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      return data.access_token;
    } catch (err: unknown) {
      console.warn("PayPal OAuth error:", (err as Error).message);
      throw err;
    }
  }

  /**
   * Fetch disputes list from PayPal Sandbox
   */
  async listDisputes(): Promise<any> {
    if (this.executionMode === "INTERNAL_SIMULATION") {
      return {
        mode: "INTERNAL_SIMULATION",
        total_items: 5,
        items: [],
      };
    }

    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v1/customer/disputes`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to list PayPal disputes: ${err}`);
    }

    return await res.json();
  }

  /**
   * Retrieve Single Dispute from PayPal
   */
  async getDispute(disputeId: string): Promise<any> {
    if (this.executionMode === "INTERNAL_SIMULATION") {
      return {
        dispute_id: disputeId,
        status: "UNDER_REVIEW",
        dispute_life_cycle_stage: "CHARGEBACK",
        reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        dispute_amount: { value: "195.00", currency_code: "USD" },
        buyer_name: "Zachary Taylor",
        buyer_email: "z.taylor@example.com",
        seller_response_due_date: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
        _mode: "INTERNAL_SIMULATION",
      };
    }

    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v1/customer/disputes/${disputeId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`PayPal dispute fetch failed (${res.status}): ${txt}`);
    }

    return await res.json();
  }

  /**
   * Provide Evidence to PayPal Disputes API
   * POST /v1/customer/disputes/{dispute_id}/provide-evidence
   */
  async provideEvidence(params: ProvideEvidenceParams): Promise<{
    success: boolean;
    mode: "simulation" | "live_sandbox";
    executionMode: PayPalExecutionMode;
    statusCode: number;
    responsePayload: any;
  }> {
    const payload: Record<string, any> = {
      evidence_type: params.evidenceType || "PROOF_OF_DELIVERY",
      notes: params.notes,
    };

    if (params.trackingNumber && params.carrierName) {
      payload.evidence_info = {
        tracking_info: [
          {
            carrier_name: params.carrierName,
            tracking_number: params.trackingNumber,
          },
        ],
      };
    }

    if (params.documents && params.documents.length > 0) {
      payload.documents = params.documents.map((doc, idx) => ({
        name: doc.name,
        document_id: `DOC-VERIFIED-${Date.now()}-${idx + 1}`,
      }));
    }

    if (this.executionMode === "INTERNAL_SIMULATION") {
      // Return high-fidelity PayPal API response simulation without making ANY network requests
      return {
        success: true,
        mode: "simulation",
        executionMode: "INTERNAL_SIMULATION",
        statusCode: 200,
        responsePayload: {
          dispute_id: params.disputeId,
          status: "UNDER_REVIEW",
          acknowledged_at: new Date().toISOString(),
          links: [
            {
              href: `${this.baseUrl}/v1/customer/disputes/${params.disputeId}`,
              rel: "self",
              method: "GET",
            },
          ],
          message: "Evidence successfully accepted by PayPal Disputes API [SIMULATED].",
          submission_details: payload,
          _execution_mode: "INTERNAL_SIMULATION",
        },
      };
    }

    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v1/customer/disputes/${params.disputeId}/provide-evidence`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { raw: responseText };
    }

    if (!res.ok) {
      return {
        success: false,
        mode: "live_sandbox",
        executionMode: this.executionMode,
        statusCode: res.status,
        responsePayload: parsed,
      };
    }

    return {
      success: true,
      mode: "live_sandbox",
      executionMode: this.executionMode,
      statusCode: res.status,
      responsePayload: parsed,
    };
  }

  /**
   * Accept Claim
   * POST /v1/customer/disputes/{dispute_id}/accept-claim
   */
  async acceptClaim(params: AcceptClaimParams): Promise<{
    success: boolean;
    mode: "simulation" | "live_sandbox";
    executionMode: PayPalExecutionMode;
    statusCode: number;
    responsePayload: any;
  }> {
    const payload = {
      note: params.note || "Merchant accepts claim based on internal policy evaluation.",
      accept_claim_reason: "DID_NOT_SHIP_MERCHANDISE",
    };

    if (this.executionMode === "INTERNAL_SIMULATION") {
      return {
        success: true,
        mode: "simulation",
        executionMode: "INTERNAL_SIMULATION",
        statusCode: 200,
        responsePayload: {
          dispute_id: params.disputeId,
          status: "RESOLVED",
          outcome: "ACCEPTED_BY_MERCHANT",
          resolved_at: new Date().toISOString(),
          message: "Dispute claim accepted. Refund authorized to buyer [SIMULATED].",
          links: [
            {
              href: `${this.baseUrl}/v1/customer/disputes/${params.disputeId}`,
              rel: "self",
              method: "GET",
            },
          ],
          _execution_mode: "INTERNAL_SIMULATION",
        },
      };
    }

    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v1/customer/disputes/${params.disputeId}/accept-claim`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const parsed = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      mode: "live_sandbox",
      executionMode: this.executionMode,
      statusCode: res.status,
      responsePayload: parsed,
    };
  }

  /**
   * Make an Offer to Buyer (Settlement / Partial Refund)
   * POST /v1/customer/disputes/{dispute_id}/make-offer
   */
  async makeOffer(params: MakeOfferParams): Promise<{
    success: boolean;
    mode: "simulation" | "live_sandbox";
    executionMode: PayPalExecutionMode;
    statusCode: number;
    responsePayload: any;
  }> {
    const payload = {
      note: params.note,
      offer_amount: {
        currency_code: params.currencyCode || "USD",
        value: params.offerAmount,
      },
      offer_type: "REFUND",
    };

    if (this.executionMode === "INTERNAL_SIMULATION") {
      return {
        success: true,
        mode: "simulation",
        executionMode: "INTERNAL_SIMULATION",
        statusCode: 200,
        responsePayload: {
          dispute_id: params.disputeId,
          status: "WAITING_FOR_BUYER",
          offer_status: "PENDING_BUYER_ACCEPTANCE",
          offer_details: payload,
          message: "Settlement offer dispatched to buyer via PayPal [SIMULATED].",
          _execution_mode: "INTERNAL_SIMULATION",
        },
      };
    }

    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v1/customer/disputes/${params.disputeId}/make-offer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const parsed = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      mode: "live_sandbox",
      executionMode: this.executionMode,
      statusCode: res.status,
      responsePayload: parsed,
    };
  }
}
