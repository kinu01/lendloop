import { api } from "@convex/_generated/api";
import { todayUtc } from "@convex/lib/dates";
import { preloadQuery } from "convex/nextjs";
import { PublicToolList } from "@/components/tools/public-tool-list";

export async function AvailableTools() {
  const today = todayUtc();
  const preloaded = await preloadQuery(api.tools.listPublic, { today });
  return <PublicToolList preloaded={preloaded} today={today} />;
}
