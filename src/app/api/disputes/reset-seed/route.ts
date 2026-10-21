import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  try {
    const { stdout, stderr } = await execAsync("npx -y ts-node -O '{\"module\":\"commonjs\"}' prisma/seed.ts");
    return NextResponse.json({
      success: true,
      message: "Database successfully reset to pristine demo disputes.",
      output: stdout,
    });
  } catch (err: any) {
    console.error("Reset seed error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to reset seed" },
      { status: 500 }
    );
  }
}
