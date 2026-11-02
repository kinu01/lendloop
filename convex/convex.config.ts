import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    N8N_WEBHOOK_URL: v.optional(v.string()),
    CONVEX_TO_N8N_SECRET: v.optional(v.string()),
    N8N_TO_CONVEX_SECRET: v.optional(v.string()),
    ALLOW_DEMO_SEED: v.optional(v.string()),
  },
});
app.use(rateLimiter);

export default app;
