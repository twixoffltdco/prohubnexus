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

/**
 * Ensures the caller is authenticated AND has the 'admin' role.
 * Returns a text error object usable as a tool response when denied.
 */
export async function requireAdmin(ctx: ToolContext): Promise<{ ok: true } | { ok: false; error: any }> {
  if (!ctx.isAuthenticated()) {
    return {
      ok: false,
      error: {
        content: [{ type: "text", text: "MCP доступ ограничен: требуется авторизация." }],
        isError: true,
      },
    };
  }
  const supabase = mcpClient(ctx);
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.getUserId())
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) {
    return {
      ok: false,
      error: {
        content: [
          {
            type: "text",
            text: "MCP-сервер ProHub доступен только администраторам платформы.",
          },
        ],
        isError: true,
      },
    };
  }
  return { ok: true };
}
