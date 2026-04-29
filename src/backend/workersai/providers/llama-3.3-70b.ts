import type { AIGenerateOptions, ModelProvider } from "../types";

export class Llama3370bProvider implements ModelProvider {
  async generateText(env: Env, options: AIGenerateOptions, model: string): Promise<string> {
    const payload: any = { ...options };

    // Llama 3.3 natively handles the `messages` array for chat completions.
    // If a simple prompt is provided without messages, convert it to a message payload
    // to ensure reliable instruction following.
    if (payload.prompt && !payload.messages) {
      payload.messages = [{ role: "user", content: payload.prompt }];
      delete payload.prompt;
    }

    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    const aiResponse = (await env.AI.run(model, payload)) as any;
    
    return aiResponse.response || aiResponse.text || JSON.stringify(aiResponse);
  }
}
