/**
 * @fileoverview Centralized interface for Cloudflare Workers AI processing.
 * 
 * Provides typed wrappers for specific models like gpt-oss-120b, handling
 * fallbacks, defaults, and response parsing.
 */

export interface Gpt120bOptions {
  /**
   * Simple text input for single-turn interactions.
   */
  prompt?: string;
  
  /**
   * Structured conversation format with roles (user, assistant, system).
   */
  messages?: Array<{ role: string; content: string }>;
  
  /**
   * Maximum number of tokens to generate.
   * Default: 256
   */
  max_tokens?: number;
  
  /**
   * Controls randomness. Higher values = more random.
   * Default: 0.6 (min: 0, max: 5)
   */
  temperature?: number;
  
  /**
   * If true, response streams back via Server Sent Events.
   */
  stream?: boolean;

  /**
   * JSON Mode response formatting
   */
  response_format?: {
    type: "json_object" | "json_schema";
    json_schema?: any;
  };
}

/**
 * Runs the @cf/openai/gpt-oss-120b model for powerful reasoning and agentic tasks.
 * 
 * @param env Cloudflare Env containing the AI binding
 * @param options Model options (prompt or messages)
 * @returns The generated text string
 */
export async function runGpt120b(env: Env, options: Gpt120bOptions): Promise<string> {
  if (!env.AI) {
    throw new Error("Cloudflare Workers AI binding (env.AI) is not available.");
  }

  try {
    const aiResponse = (await env.AI.run("@cf/openai/gpt-oss-120b", options as any)) as any;
    
    // For non-streaming, extract the response text
    if (!options.stream) {
        return aiResponse.response || aiResponse.text || JSON.stringify(aiResponse);
    }
    
    // If streaming, the caller should handle the stream appropriately
    return aiResponse;
  } catch (error) {
    console.error("[AI] Error running @cf/openai/gpt-oss-120b:", error);
    throw error;
  }
}
