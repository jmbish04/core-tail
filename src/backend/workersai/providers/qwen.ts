import type { AIGenerateOptions, ModelProvider } from "../types";

export class QwenProvider implements ModelProvider {
  async generateText(env: Env, options: AIGenerateOptions, model: string): Promise<string> {
    const payload: any = { ...options };

    // Qwen models use `messages` payload natively
    if (payload.prompt && !payload.messages) {
      payload.messages = [{ role: "user", content: payload.prompt }];
      delete payload.prompt;
    }

    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    const aiResponse = (await env.AI.run(model, payload)) as any;
    
    return aiResponse.response || aiResponse.text || JSON.stringify(aiResponse);
  }
}
