import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (hash && (type === "invite" || type === "recovery")) {
    const client = await createClient();
    const { error } = await client.auth.verifyOtp({ token_hash: hash, type });
    if (!error) {
      const url = new URL("/update-password", request.url);
      url.searchParams.set(
        "flow",
        request.nextUrl.searchParams.get("flow") === "invite" ||
          type === "invite"
          ? "invite"
          : "recovery",
      );
      const response = NextResponse.redirect(url);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
  }
  return NextResponse.redirect(
    new URL("/login?error=expired-link", request.url),
  );
}
