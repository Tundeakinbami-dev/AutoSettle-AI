import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { analyzeDispute } from "@/lib/ai-agent";
import { buildDisputeContext } from "@/lib/ai-context";
import { recordAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/disputes/:id/analyze
 * Forces a (re)run of the AI analysis for the given dispute.
 * Returns the analysis result and stores it in the DB.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    // Resolve internal dispute record by CUID or paypalDisputeId
    const dispute = await prisma.dispute.findFirst({
      where: {
        OR: [{ id }, { paypalDisputeId: id }],
      },
    });
    if (!dispute) {
      return NextResponse.json({ success: false, error: "Dispute not found" }, { status: 404 });
    }

    // Build full context (includes evidence, tracking, order, etc.)
    const context = await buildDisputeContext(dispute.id);

    const analysis = await analyzeDispute(context);

    // Persist (upsert) the AI analysis record
    await prisma.aiAnalysis.upsert({
      where: { disputeId: dispute.id },
      create: {
        disputeId: dispute.id,
        summary: analysis.summary,
        completenessScore: analysis.completenessScore,
        recommendedAction: analysis.recommendedAction,
        recommendationRationale: analysis.recommendationRationale,
        keyStrengthsJson: JSON.stringify(analysis.keyStrengths),
        criticalGapsJson: JSON.stringify(analysis.criticalGaps),
        citationsJson: JSON.stringify(analysis.citations),
        riskLevel: analysis.riskLevel,
      },
      update: {
        summary: analysis.summary,
        completenessScore: analysis.completenessScore,
        recommendedAction: analysis.recommendedAction,
        recommendationRationale: analysis.recommendationRationale,
        keyStrengthsJson: JSON.stringify(analysis.keyStrengths),
        criticalGapsJson: JSON.stringify(analysis.criticalGaps),
        citationsJson: JSON.stringify(analysis.citations),
        riskLevel: analysis.riskLevel,
        updatedAt: new Date(),
      },
    });

    await recordAuditLog({
      disputeId: dispute.id,
      eventType: "AI_ANALYSIS_GENERATED",
      severity: "SUCCESS",
      summary: `Manual AI analysis run for dispute ${id}`,
      actor: "merchant_user",
    });

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error("POST /api/disputes/[id]/analyze error:", err);
    await recordAuditLog({
      disputeId: undefined,
      eventType: "AI_ANALYSIS_FAILED",
      severity: "ERROR",
      summary: `Failed manual AI analysis for dispute ${id}: ${err.message}`,
      actor: "system",
    });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
