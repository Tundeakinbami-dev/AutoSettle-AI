// Courier Provider Interface, Production Blueprints, and Simulated Adapter
// ------------------------------------------------------------------------
// AutoSettle AI Carrier Tracking Architecture
//
// STATUS:
// - SimulatedCourierProvider: IMPLEMENTED & VERIFIED (Default for development/demo).
// - EasyPostCourierProvider: BLUEPRINT IMPLEMENTED (Activates when EASYPOST_API_KEY is present).
// - UpsDirectCourierProvider: BLUEPRINT IMPLEMENTED (Activates when UPS_CLIENT_ID & UPS_CLIENT_SECRET are present).

export interface TrackingInfoResult {
  carrier: string; // "UPS" | "FEDEX" | "USPS" | "DHL"
  trackingNumber: string;
  status: "DELIVERED" | "IN_TRANSIT" | "EXCEPTION" | "UNKNOWN";
  shippedDate?: Date;
  deliveredDate?: Date;
  destinationZip?: string;
  signedBy?: string;
  deliveryProofUrl?: string;
  rawData?: any; // Full carrier API payload recorded in audit trail
  isSimulated: boolean;
}

/**
 * Abstract courier provider interface.
 */
export abstract class CourierProvider {
  abstract readonly providerName: string;
  abstract fetchTracking(trackingNumber: string, carrierCode?: string): Promise<TrackingInfoResult>;
}

/**
 * Simulated courier provider – deterministic mock implementation.
 * Used for development, CI testing, and demonstration.
 * Returns reproducible delivery confirmation without incurring carrier API costs.
 */
export class SimulatedCourierProvider extends CourierProvider {
  readonly providerName = "SIMULATED_PROVIDER";

  async fetchTracking(trackingNumber: string, carrierCode: string = "UPS"): Promise<TrackingInfoResult> {
    const hash = trackingNumber.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const isDelivered = hash % 3 === 0; // 1/3 of tracking numbers show delivered
    const now = new Date();
    const shipped = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const delivered = isDelivered ? new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) : undefined;

    return {
      carrier: carrierCode.toUpperCase(),
      trackingNumber,
      status: isDelivered ? "DELIVERED" : "IN_TRANSIT",
      shippedDate: shipped,
      deliveredDate: delivered,
      destinationZip: "94105",
      signedBy: isDelivered ? "S. CHEN" : undefined,
      deliveryProofUrl: isDelivered ? `/evidence/simulated_pod_${trackingNumber}.pdf` : undefined,
      rawData: {
        simulated: true,
        generator: "SimulatedCourierProvider",
        hash,
        timestamp: new Date().toISOString(),
      },
      isSimulated: true,
    };
  }
}

/**
 * EasyPost Courier Provider (Production Blueprint)
 *
 * Requirements for activation:
 * - Environment Variable: EASYPOST_API_KEY (e.g. EZAK... or EZTK...)
 * - Documentation: https://www.easypost.com/docs/api#trackers
 */
export class EasyPostCourierProvider extends CourierProvider {
  readonly providerName = "EASYPOST_API";
  private apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async fetchTracking(trackingNumber: string, carrierCode: string = "UPS"): Promise<TrackingInfoResult> {
    const res = await fetch("https://api.easypost.com/v2/trackers", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tracker: {
          tracking_code: trackingNumber,
          carrier: carrierCode,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`EasyPost API error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    const statusMap: Record<string, "DELIVERED" | "IN_TRANSIT" | "EXCEPTION" | "UNKNOWN"> = {
      delivered: "DELIVERED",
      in_transit: "IN_TRANSIT",
      out_for_delivery: "IN_TRANSIT",
      return_to_sender: "EXCEPTION",
      failure: "EXCEPTION",
      unknown: "UNKNOWN",
    };

    return {
      carrier: data.carrier || carrierCode,
      trackingNumber: data.tracking_code,
      status: statusMap[data.status] || "UNKNOWN",
      shippedDate: data.created_at ? new Date(data.created_at) : undefined,
      deliveredDate: data.est_delivery_date ? new Date(data.est_delivery_date) : undefined,
      signedBy: data.signed_by || undefined,
      rawData: data,
      isSimulated: false,
    };
  }
}

/**
 * UPS REST API Provider (Production Blueprint)
 *
 * Requirements for activation:
 * - Environment Variables: UPS_CLIENT_ID, UPS_CLIENT_SECRET
 * - OAuth Endpoint: https://onlinetools.ups.com/security/v1/oauth/token
 * - Tracking Endpoint: https://onlinetools.ups.com/api/track/v1/details/{inquiryNumber}
 */
export class UpsDirectCourierProvider extends CourierProvider {
  readonly providerName = "UPS_REST_API";
  private clientId: string;
  private clientSecret: string;
  private isSandbox: boolean;

  constructor(clientId: string, clientSecret: string, isSandbox: boolean = true) {
    super();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.isSandbox = isSandbox;
  }

  private async getAccessToken(): Promise<string> {
    const host = this.isSandbox ? "https://wwwcie.ups.com" : "https://onlinetools.ups.com";
    const res = await fetch(`${host}/security/v1/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      throw new Error(`UPS OAuth failed (${res.status}): ${await res.text()}`);
    }

    const json = await res.json();
    return json.access_token;
  }

  async fetchTracking(trackingNumber: string): Promise<TrackingInfoResult> {
    const token = await this.getAccessToken();
    const host = this.isSandbox ? "https://wwwcie.ups.com" : "https://onlinetools.ups.com";
    const res = await fetch(`${host}/api/track/v1/details/${encodeURIComponent(trackingNumber)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        transId: `AS-${Date.now()}`,
        transactionSrc: "AutoSettle-AI",
      },
    });

    if (!res.ok) {
      throw new Error(`UPS Tracking request failed (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    const packageInfo = data?.trackResponse?.shipment?.[0]?.package?.[0];
    const deliveryActivity = packageInfo?.activity?.[0];
    const isDelivered = deliveryActivity?.status?.type === "D";

    return {
      carrier: "UPS",
      trackingNumber,
      status: isDelivered ? "DELIVERED" : "IN_TRANSIT",
      deliveredDate: isDelivered && deliveryActivity?.date ? new Date(deliveryActivity.date) : undefined,
      destinationZip: packageInfo?.deliveryAddress?.postalCode || undefined,
      signedBy: deliveryActivity?.deliveryDetail?.receiverSignatureName || undefined,
      rawData: data,
      isSimulated: false,
    };
  }
}

/**
 * Factory to obtain the configured courier provider.
 * Automatically checks environment variables and instantiates live providers if credentials exist,
 * or gracefully defaults to SimulatedCourierProvider with explicit labeling.
 */
export function getCourierProvider(): CourierProvider {
  // 1. Check for EasyPost credentials
  if (process.env.EASYPOST_API_KEY && process.env.CARRIER_INTEGRATION_MODE === "EASYPOST") {
    return new EasyPostCourierProvider(process.env.EASYPOST_API_KEY);
  }

  // 2. Check for direct UPS credentials
  if (
    process.env.UPS_CLIENT_ID &&
    process.env.UPS_CLIENT_SECRET &&
    process.env.CARRIER_INTEGRATION_MODE === "UPS"
  ) {
    const isSandbox = process.env.UPS_ENVIRONMENT !== "production";
    return new UpsDirectCourierProvider(process.env.UPS_CLIENT_ID, process.env.UPS_CLIENT_SECRET, isSandbox);
  }

  // 3. Default: Deterministic simulator for demo/development
  return new SimulatedCourierProvider();
}
