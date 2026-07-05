import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpClient, requireAdmin } from "./_admin";

export default defineTool({
  name: "list_categories",
  title: "List categories",
  description: "List forum categories for ProHub, Code Forum, or FlexDev. Admin-only.",
  inputSchema: {
    forum_id: z
      .enum(["prohub", "codeforum", "flexdev"])
      .optional()
      .describe("Filter by forum (defaults to all)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ forum_id }, ctx: ToolContext) => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const supabase = mcpClient(ctx);
    let q = supabase.from("categories").select("*").order("order_position", { ascending: true });
    if (forum_id) q = q.eq("forum_id", forum_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { categories: data ?? [] },
    };
  },
});
