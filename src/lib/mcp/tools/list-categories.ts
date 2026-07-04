import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_categories",
  title: "List categories",
  description: "List forum categories for ProHub, Code Forum, or FlexDev.",
  inputSchema: {
    forum_id: z
      .enum(["prohub", "codeforum", "flexdev"])
      .optional()
      .describe("Filter by forum (defaults to all)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ forum_id }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase.from("categories").select("*").order("position", { ascending: true });
    if (forum_id) q = q.eq("forum_id", forum_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { categories: data ?? [] },
    };
  },
});
