import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpClient, requireAdmin } from "./_admin";

export default defineTool({
  name: "create_post",
  title: "Reply to a topic",
  description: "Post a reply in a forum topic as the signed-in admin. Admin-only.",
  inputSchema: {
    topic_id: z.string().uuid().describe("Topic UUID to reply in."),
    content: z.string().min(1).describe("Reply body (BBCode/text)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ topic_id, content }, ctx: ToolContext) => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const supabase = mcpClient(ctx);
    const { data, error } = await supabase
      .from("posts")
      .insert({ topic_id, content, user_id: ctx.getUserId() })
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Post created: ${data?.id}` }],
      structuredContent: { post: data },
    };
  },
});
