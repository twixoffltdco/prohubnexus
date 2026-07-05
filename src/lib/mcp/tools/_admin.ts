import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export function mcpClient(ctx?: ToolContext) {
  return createClient(
    (globalThis as any).process.env.SUPABASE_URL as string,
    (globalThis as any).process.env.SUPABASE_PUBLISHABLE_KEY as string,
    {
      global: ctx?.getToken ? { headers: { Authorization: `Bearer ${ctx.getToken()}` } } : undefined,
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export type McpDenied = { content: { type: "text"; text: string }[]; isError: true };

/**
 * Returns null when the caller is an admin. Otherwise returns a tool-error object
 * to be returned directly from the handler.
 */
export async function requireAdmin(ctx: ToolContext): Promise<McpDenied | null> {
  if (!ctx.isAuthenticated()) {
    return {
      content: [{ type: "text", text: "MCP доступ ограничен: требуется авторизация." }],
      isError: true,
    };
  }
  const supabase = mcpClient(ctx);
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.getUserId())
    .eq("role", "admin")
    .maybeSingle();
  if (!data) {
    return {
      content: [
        { type: "text", text: "MCP-сервер ProHub доступен только администраторам платформы." },
      ],
      isError: true,
    };
  }
  return null;
}
