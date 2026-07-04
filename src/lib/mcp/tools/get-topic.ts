import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_topic",
  title: "Get topic",
  description: "Fetch a topic with its posts by topic ID.",
  inputSchema: {
    topic_id: z.string().uuid().describe("Topic UUID."),
    post_limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ topic_id, post_limit }) => {
    const supabase = createClient(
      (globalThis as any).process.env.SUPABASE_URL as string,
      (globalThis as any).process.env.SUPABASE_PUBLISHABLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: topic, error: te } = await supabase
      .from("topics")
      .select("id, title, content, forum_id, category_id, user_id, views, created_at, is_hidden")
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
