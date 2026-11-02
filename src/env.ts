import { z } from "zod";

// Next inlines NEXT_PUBLIC values by exact name, so each one must be written out.
export const env = z
  .object({ NEXT_PUBLIC_CONVEX_URL: z.url() })
  .parse({ NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL });
