import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpClient, requireAdmin } from "./_admin";

export default defineTool({
  name: "get_topic",
  title: "Get topic",
  description: "Fetch a topic with its posts by topic ID. Admin-only.",
  inputSchema: {
    topic_id: z.string().uuid().describe("Topic UUID."),
    post_limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ topic_id, post_limit }, ctx: ToolContext) => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const supabase = mcpClient(ctx);
    const { data: topic, error: te } = await supabase
      .from("topics")
      .select("id, title, content, category_id, user_id, views, created_at, is_hidden")
      .eq("id", topic_id)
      .maybeSingle();
    if (te) return { content: [{ type: "text", text: te.message }], isError: true };
    if (!topic || topic.is_hidden)
      return { content: [{ type: "text", text: "Topic not found." }], isError: true };
    const { data: posts } = await supabase
      .from("posts")
      .select("id, content, user_id, created_at")
      .eq("topic_id", topic_id)
      .eq("is_hidden", false)
      .order("created_at", { ascending: true })
      .limit(post_limit ?? 50);
    return {
      content: [{ type: "text", text: JSON.stringify({ topic, posts }) }],
      structuredContent: { topic, posts: posts ?? [] },
    };
  },
});
