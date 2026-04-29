import type { AIGenerateOptions, ModelProvider } from "../types";

export class KimiK26Provider implements ModelProvider {
  async generateText(env: Env, options: AIGenerateOptions, model: string): Promise<string> {
    const payload: any = { ...options };

    // Kimi K2.6 requires `messages` format and is designed for heavy context
    // Convert generic prompt to message if needed
    if (payload.prompt && !payload.messages) {
      payload.messages = [{ role: "user", content: payload.prompt }];
      delete payload.prompt;
    }

    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    const aiResponse = (await env.AI.run(model, payload)) as any;
    
    // Kimi K2.6 uses standard response formats
    return aiResponse.response || aiResponse.text || JSON.stringify(aiResponse);
  }
}
