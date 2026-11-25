import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 1. Keeps the admin session fresh: refreshes the Supabase token and writes the new cookies.
// 2. Keeps the admin on its own address (ADMIN_HOST, e.g. admin.reeta-eg.com): on the store's address /admin is a plain 404,
//    and the admin address only ever shows the admin. Without ADMIN_HOST nothing is restricted (local development).
// It only runs on /admin and on the admin address, so shoppers on the store never pay for it.
const ADMIN_HOST = (process.env.ADMIN_HOST ?? "").toLowerCase();

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const path = request.nextUrl.pathname;
  const onAdminHost = Boolean(ADMIN_HOST) && host === ADMIN_HOST;

  if (ADMIN_HOST && !onAdminHost && host !== "localhost" && host !== "127.0.0.1") {
    // The store's address (and any other) does not expose the admin at all.
    return NextResponse.rewrite(new URL("/not-found", request.url), { status: 404 });
  }
  if (onAdminHost && !path.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const isPublicAdminPath = path.startsWith("/admin/login") || path.startsWith("/admin/auth");

  if (!signedIn && !isPublicAdminPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // The admin is never for search engines.
  if (onAdminHost) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    // Every page on the admin address (not Next's own files or anything with a file extension). Keep in step with ADMIN_HOST.
    { source: "/((?!_next/static|_next/image|.*\\..*).*)", has: [{ type: "host", value: "admin.reeta-eg.com" }] },
  ],
};
