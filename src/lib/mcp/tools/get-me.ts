import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { mcpClient, requireAdmin } from "./_admin";

export default defineTool({
  name: "get_me",
  title: "Get my profile",
  description: "Return the signed-in admin's profile (username, reputation, roles). Admin-only.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const supabase = mcpClient(ctx);
    const userId = ctx.getUserId();
    const [{ data: profile }, { data: rep }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_reputation").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      content: [{ type: "text", text: JSON.stringify({ profile, reputation: rep, roles }) }],
      structuredContent: { profile, reputation: rep, roles: roles ?? [] },
    };
  },
});
