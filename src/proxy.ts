import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { env } from "@/env";

// Only a redirect for signed-out visitors; every rule is enforced in Convex.
const isAppRoute = createRouteMatcher([
  "/board(.*)",
  "/listings(.*)",
  "/requests(.*)",
  "/incoming(.*)",
  "/admin(.*)",
]);

const convexUrl = env.NEXT_PUBLIC_CONVEX_URL;

export default clerkMiddleware(
  async (auth, request) => {
    if (isAppRoute(request)) await auth.protect();
  },
  {
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "connect-src": [convexUrl, convexUrl.replace(/^http/, "ws")],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "object-src": ["'none'"],
      },
    },
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
