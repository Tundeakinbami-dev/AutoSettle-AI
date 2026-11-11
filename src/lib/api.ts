// API helper functions used by the UI components
// ---------------------------------------------------
// These thin wrappers call the Next.js API routes and return JSON data.
// They are deliberately minimal – error handling is delegated to the caller.

export async function fetchDispute(disputeId: string) {
  const res = await fetch(`/api/disputes/${disputeId}`);
  if (!res.ok) throw new Error(`Failed to fetch dispute ${disputeId}`);
  const data = await res.json();
  return data.dispute as any; // raw Prisma Dispute object
}

export async function fetchIntelligence(disputeId: string) {
  const res = await fetch(`/api/intelligence/${disputeId}`);
  if (!res.ok) throw new Error(`Failed to fetch intelligence for ${disputeId}`);
  const data = await res.json();
  return data;
}

export async function fetchAnalysis(disputeId: string) {
  const res = await fetch(`/api/disputes/${disputeId}/analyze`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to run AI analysis for ${disputeId}`);
  const data = await res.json();
  return data.analysis as any;
}

export async function approveDraft(disputeId: string) {
  const res = await fetch(`/api/disputes/${disputeId}/approve`, { method: "POST" });
  if (!res.ok) throw new Error(`Approve failed for ${disputeId}`);
  return await res.json();
}

export async function submitToPayPal(disputeId: string, payload: any) {
  const res = await fetch(`/api/disputes/${disputeId}/submit-paypal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Submission failed");
  }
  return await res.json();
}
