// Ambient declaration so tool files can read env vars at runtime (Deno edge function).
declare const process: { env: Record<string, string | undefined> };
