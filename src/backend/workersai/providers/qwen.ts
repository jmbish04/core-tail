import type { AIGenerateOptions, ModelProvider, ToolResponse } from "../types";

export class QwenProvider implements ModelProvider {
  private async runRaw(env: Env, options: AIGenerateOptions, model: string): Promise<any> {
    const payload: any = { ...options };

    // Qwen models use `messages` payload natively
    if (payload.prompt && !payload.messages) {
      payload.messages = [{ role: "user", content: payload.prompt }];
      delete payload.prompt;
    }

    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    return await env.AI.run(model, payload);
  }

  /**
   * Generates text using the Qwen model.
   * @param env Environment variables.
   * @param options Generation options.
   * @param model Model to use.
   * @returns Generated text.
   */

  async generateText(env: Env, options: AIGenerateOptions, model: string): Promise<string> {
    const aiResponse = await this.runRaw(env, options, model);
    return aiResponse.response || aiResponse.text || JSON.stringify(aiResponse);
  }

  /**
   * Generates structured response using the Qwen model.
   * @param env Environment variables.
   * @param options Structured response options.
   * @param model Model to use.
   * @returns Structured response.
   */  async generateStructuredResponse<T>(env: Env, options: AIGenerateOptions, model: string): Promise<T> {
    const payload = { ...options, response_format: options.response_format || { type: "json_object" } };
    const text = await this.generateText(env, payload, model);
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      console.warn(`[WorkersAI] Failed to parse structured response from ${model}:`, text);
      throw new Error(`Failed to parse structured response from ${model}`);
    }
  }

  /**
   * Generates tool calls using the Qwen model.
   * @param env Environment variables.
   * @param options Tool call options.
   * @param model Model to use.
   * @returns Tool response.
   */
  async generateWithTools(env: Env, options: AIGenerateOptions, model: string): Promise<ToolResponse> {
    const aiResponse = await this.runRaw(env, options, model);
    return {
      response: aiResponse.response || aiResponse.text || "",
      tool_calls: aiResponse.tool_calls
    };
  }
}
