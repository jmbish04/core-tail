import type { AIGenerateOptions, ModelProvider } from "../types";

export class Gpt120bProvider implements ModelProvider {
  async generateText(env: Env, options: AIGenerateOptions, model: string): Promise<string> {
    const payload: any = { ...options };

    // gpt-oss-120b supports both `prompt` and `messages` according to the schema.
    // However, if the user provides `prompt`, it maps cleanly to the Prompt schema.
    // If they provide `messages`, it maps to the Messages schema.
    
    // Convert generic AIGenerateOptions to raw payload if necessary.
    // Remove undefined properties to keep the payload clean
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    const aiResponse = (await env.AI.run(model, payload)) as any;
    
    // Determine how to extract the string based on the response format
    return aiResponse.response || aiResponse.text || JSON.stringify(aiResponse);
  }
}
