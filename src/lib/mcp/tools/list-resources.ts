import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_resources",
  title: "List resources",
  description: "List published resources (guides, tools, downloads) on the platform.",
  inputSchema: {
    forum_id: z.enum(["prohub", "codeforum", "flexdev"]).optional(),
    query: z.string().optional().describe("Optional title filter."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ forum_id, query, limit }) => {
    const supabase = createClient(
      (globalThis as any).process.env.SUPABASE_URL as string,
      (globalThis as any).process.env.SUPABASE_PUBLISHABLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase
      .from("resources")
      .select("id, title, description, forum_id, user_id, downloads, created_at")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (forum_id) q = q.eq("forum_id", forum_id);
    if (query) q = q.ilike("title", `%${query}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resources: data ?? [] },
    };
  },
});
