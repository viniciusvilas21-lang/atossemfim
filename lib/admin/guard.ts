import { NextResponse } from "next/server";
import { AdminAuthError, requireAdminSession } from "@/lib/admin/session";

/** Wraps an admin Route Handler so an expired/missing session always yields a clean 401. */
export async function withAdmin<T>(handler: () => Promise<T>): Promise<T | NextResponse> {
  try {
    await requireAdminSession();
    return await handler();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
