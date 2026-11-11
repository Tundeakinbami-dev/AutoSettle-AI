import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";

// Allowed MIME types and their expected magic bytes
export const ALLOWED_MIME_TYPES: Record<string, { ext: string; check: (buf: Buffer) => boolean }> = {
  "application/pdf": {
    ext: "pdf",
    check: (buf: Buffer) =>
      buf.length >= 4 &&
      buf[0] === 0x25 &&
      buf[1] === 0x50 &&
      buf[2] === 0x44 &&
      buf[3] === 0x46, // %PDF
  },
  "image/png": {
    ext: "png",
    check: (buf: Buffer) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a, // \x89PNG\r\n\x1a\n
  },
  "image/jpeg": {
    ext: "jpg",
    check: (buf: Buffer) =>
      buf.length >= 3 &&
      buf[0] === 0xff &&
      buf[1] === 0xd8 &&
      buf[2] === 0xff, // \xFF\xD8\xFF
  },
};

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit per file
export const EVIDENCE_STORAGE_DIR = path.resolve(process.cwd(), "storage", "evidence");

/**
 * Ensures the private storage directory exists.
 */
export async function ensureStorageDir(): Promise<string> {
  if (!fsSync.existsSync(EVIDENCE_STORAGE_DIR)) {
    await fs.mkdir(EVIDENCE_STORAGE_DIR, { recursive: true });
  }
  return EVIDENCE_STORAGE_DIR;
}

/**
 * Validates a file buffer using magic byte file signatures and checks size.
 */
export function validateEvidenceFile(
  buffer: Buffer,
  declaredMimeType: string
): { valid: boolean; detectedMime?: string; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Empty file provided." };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }

  // Detect genuine MIME type from magic bytes
  let detectedMime: string | undefined;
  for (const [mime, config] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (config.check(buffer)) {
      detectedMime = mime;
      break;
    }
  }

  if (!detectedMime) {
    return {
      valid: false,
      error: "Unsupported file type. Only genuine PDF, PNG, and JPEG documents are permitted.",
    };
  }

  // Check declared vs detected MIME match where appropriate
  if (declaredMimeType && declaredMimeType !== detectedMime) {
    // Normalise jpg/jpeg declared mime
    const isJpegVariant =
      (declaredMimeType === "image/jpg" || declaredMimeType === "image/jpeg") &&
      detectedMime === "image/jpeg";
    if (!isJpegVariant) {
      return {
        valid: false,
        error: `MIME type mismatch: declared '${declaredMimeType}' does not match detected '${detectedMime}'.`,
      };
    }
  }

  return { valid: true, detectedMime };
}

/**
 * Saves an evidence buffer to the private storage directory with an unguessable UUID filename.
 * Prevents directory traversal by enforcing basename and resolving within EVIDENCE_STORAGE_DIR.
 */
export async function saveEvidenceToDisk(
  buffer: Buffer,
  originalFilename: string,
  detectedMime: string
): Promise<{ safeFileName: string; filePath: string; fileSize: number }> {
  await ensureStorageDir();

  const ext = ALLOWED_MIME_TYPES[detectedMime]?.ext || "bin";
  const uniqueId = crypto.randomUUID();
  const safeFileName = `${uniqueId}.${ext}`;

  // Enforce strict path resolution to prevent path traversal
  const targetPath = path.resolve(EVIDENCE_STORAGE_DIR, path.basename(safeFileName));
  if (!targetPath.startsWith(EVIDENCE_STORAGE_DIR)) {
    throw new Error("Path traversal security violation.");
  }

  await fs.writeFile(targetPath, buffer);

  return {
    safeFileName,
    filePath: targetPath,
    fileSize: buffer.length,
  };
}

/**
 * Reads a stored evidence file from disk.
 * Returns null if file does not exist or if path traversal is attempted.
 */
export async function getEvidenceFromDisk(safeFileName: string): Promise<Buffer | null> {
  if (!safeFileName || safeFileName.includes("..") || safeFileName.includes("/") || safeFileName.includes("\\")) {
    throw new Error("Path traversal security violation.");
  }
  const sanitizedName = path.basename(safeFileName);
  const targetPath = path.resolve(EVIDENCE_STORAGE_DIR, sanitizedName);

  if (!targetPath.startsWith(EVIDENCE_STORAGE_DIR)) {
    throw new Error("Path traversal security violation.");
  }

  try {
    return await fs.readFile(targetPath);
  } catch (err: any) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Deletes a stored evidence file from disk.
 */
export async function deleteEvidenceFromDisk(safeFileName: string): Promise<boolean> {
  if (!safeFileName || safeFileName.includes("..") || safeFileName.includes("/") || safeFileName.includes("\\")) {
    throw new Error("Path traversal security violation.");
  }
  const sanitizedName = path.basename(safeFileName);
  const targetPath = path.resolve(EVIDENCE_STORAGE_DIR, sanitizedName);

  if (!targetPath.startsWith(EVIDENCE_STORAGE_DIR)) {
    throw new Error("Path traversal security violation.");
  }

  try {
    await fs.unlink(targetPath);
    return true;
  } catch (err: any) {
    if (err.code === "ENOENT") return false;
    throw err;
  }
}
