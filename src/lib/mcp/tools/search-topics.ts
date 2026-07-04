import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "search_topics",
  title: "Search topics",
  description: "Full-text search for forum topics across ProHub, Code Forum, and FlexDev.",
  inputSchema: {
    query: z.string().min(1).describe("Search text matched against topic titles."),
    forum_id: z
      .enum(["prohub", "codeforum", "flexdev"])
      .optional()
      .describe("Restrict results to a specific forum."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, forum_id, limit }) => {
    const supabase = createClient(
      (globalThis as any).process.env.SUPABASE_URL as string,
      (globalThis as any).process.env.SUPABASE_PUBLISHABLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase
      .from("topics")
      .select("id, title, forum_id, category_id, user_id, views, created_at")
      .eq("is_hidden", false)
      .ilike("title", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (forum_id) q = q.eq("forum_id", forum_id);
    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { topics: data ?? [] },
    };
  },
});
