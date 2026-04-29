/**
 * @fileoverview Health check utilities for the Workers AI orchestration module.
 */

export async function checkWorkersAIHealth(env: Env) {
  try {
    if (!env.AI) {
      return {
        ok: false,
        detail: "Missing AI binding in environment",
      };
    }

    // Attempt a lightweight ping using a fast model to verify end-to-end connectivity
    const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      prompt: "ping",
      max_tokens: 5,
    } as any);

    return {
      ok: true,
      detail: "AI binding available and functional",
      ping: "success"
    };
  } catch (error: any) {
    return {
      ok: false,
      detail: "AI binding available but ping failed",
      error: error.message || String(error),
    };
  }
}
