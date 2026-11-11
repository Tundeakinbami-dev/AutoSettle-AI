import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import {
  validateEvidenceFile,
  saveEvidenceToDisk,
  deleteEvidenceFromDisk,
} from "@/lib/evidence-storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/disputes/[id]/evidence
 * Supports both multipart/form-data (secure file upload) and application/json (metadata only).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Verify dispute exists and identify associated merchant
    const dispute = await prisma.dispute.findFirst({
      where: {
        OR: [{ id }, { paypalDisputeId: id }],
      },
      include: { merchant: true },
    });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Dispute not found" },
        { status: 404 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    const createdItems: any[] = [];
    const savedDiskFiles: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const evidenceType = (formData.get("evidenceType") as string) || "PROOF_OF_FULFILLMENT";
      const title = (formData.get("title") as string) || "Uploaded Evidence Document";
      const description = (formData.get("description") as string) || "Merchant submitted document.";
      const strength = (formData.get("strength") as string) || "STRONG";

      // Support single or multiple files
      const files: File[] = [];
      const singleFile = formData.get("file") as File | null;
      if (singleFile && singleFile.size > 0) {
        files.push(singleFile);
      }
      const multipleFiles = formData.getAll("files") as File[];
      for (const f of multipleFiles) {
        if (f && f.size > 0 && !files.includes(f)) {
          files.push(f);
        }
      }

      if (files.length === 0) {
        return NextResponse.json(
          { success: false, error: "No valid file provided in multipart upload." },
          { status: 400 }
        );
      }

      try {
        for (const file of files) {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Validate file size and genuine magic byte signature
          const validation = validateEvidenceFile(buffer, file.type);
          if (!validation.valid) {
            throw new Error(`File '${file.name}' rejected: ${validation.error}`);
          }

          // Save to secure private directory with unguessable UUID filename
          const { safeFileName, fileSize } = await saveEvidenceToDisk(
            buffer,
            file.name,
            validation.detectedMime!
          );
          savedDiskFiles.push(safeFileName);

          // Create database record
          const evidence = await prisma.evidenceItem.create({
            data: {
              disputeId: dispute.id,
              evidenceType,
              title: files.length > 1 ? `${title} (${file.name})` : title,
              description,
              fileName: safeFileName,
              fileUrl: `/api/disputes/${dispute.id}/evidence/${safeFileName}`,
              fileType: validation.detectedMime,
              fileSize,
              strength,
              verified: true,
              provenanceSource: "Secure Merchant Multipart Upload",
            },
          });
          createdItems.push(evidence);
        }
      } catch (uploadError: any) {
        // Rollback any disk files written before failure
        for (const diskFile of savedDiskFiles) {
          try {
            await deleteEvidenceFromDisk(diskFile);
          } catch {
            // best-effort cleanup
          }
        }
        return NextResponse.json(
          { success: false, error: uploadError.message || "Failed to process multipart upload." },
          { status: 400 }
        );
      }
    } else {
      // JSON payload fallback
      const body = await req.json();
      const {
        evidenceType,
        title,
        description,
        fileName,
        fileUrl,
        strength = "STRONG",
      } = body;

      if (!evidenceType || !title || !description) {
        return NextResponse.json(
          { success: false, error: "Missing required evidence fields (evidenceType, title, description)" },
          { status: 400 }
        );
      }

      const evidence = await prisma.evidenceItem.create({
        data: {
          disputeId: dispute.id,
          evidenceType,
          title,
          description,
          fileName: fileName || `${title.toLowerCase().replace(/\s+/g, "_")}.pdf`,
          fileUrl: fileUrl || `/evidence/${fileName || "doc.pdf"}`,
          fileType: "application/pdf",
          strength,
          verified: true,
          provenanceSource: "Merchant Upload",
        },
      });
      createdItems.push(evidence);
    }

    // Reset workflow status to NEEDS_REVIEW when new evidence is attached
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { responseWorkflowStatus: "NEEDS_REVIEW" },
    });

    // Record audit log for evidence added
    await recordAuditLog({
      disputeId: dispute.id,
      merchantId: dispute.merchantId,
      eventType: "EVIDENCE_ADDED",
      severity: "INFO",
      summary: `Evidence added to locker: ${createdItems.map((e) => e.title).join(", ")}`,
      details: {
        count: createdItems.length,
        evidenceIds: createdItems.map((e) => e.id),
      },
      actor: "merchant_user",
    });

    return NextResponse.json({
      success: true,
      evidence: createdItems.length === 1 ? createdItems[0] : createdItems,
      count: createdItems.length,
      workflowStatus: "NEEDS_REVIEW",
      message: "Evidence item(s) successfully attached to locker.",
    });
  } catch (error: any) {
    console.error("POST /api/disputes/[id]/evidence error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to attach evidence" },
      { status: 500 }
    );
  }
}
