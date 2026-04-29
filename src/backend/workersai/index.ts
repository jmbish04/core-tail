/**
 * @fileoverview Single entry point for Workers AI orchestration.
 * Maintains a registry of model providers and routes requests accordingly.
 */

import type { AIGenerateOptions, ModelProvider } from "./types";
import { Gpt120bProvider } from "./providers/gpt-oss-120b";
import { Llama3370bProvider } from "./providers/llama-3.3-70b";
import { KimiK26Provider } from "./providers/kimi-k2.6";
import { QwenProvider } from "./providers/qwen";

export class WorkersAI {
  private providers: Map<string, ModelProvider>;

  constructor(private env: Env) {
    this.providers = new Map();
    
    // Register specific providers
    this.providers.set("@cf/openai/gpt-oss-120b", new Gpt120bProvider());
    this.providers.set("@cf/meta/llama-3.3-70b-instruct-fp8-fast", new Llama3370bProvider());
    this.providers.set("@cf/moonshotai/kimi-k2.6", new KimiK26Provider());
    
    // Register Qwen models using the shared Qwen provider
    const qwenProvider = new QwenProvider();
    this.providers.set("@cf/qwen/qwen3-30b-a3b-fp8", qwenProvider);
    this.providers.set("@cf/qwen/qwen2.5-coder-32b-instruct", qwenProvider);
    this.providers.set("@cf/qwen/qwq-32b", qwenProvider);
  }

  /**
   * Generates text using the specified model.
   * If the model encounters an error, it fails hard (no automatic fallback).
   */
  async generateText(model: string, options: AIGenerateOptions): Promise<string> {
    const provider = this.providers.get(model);
    
    if (!provider) {
      throw new Error(`[WorkersAI] Unsupported model requested: ${model}`);
    }

    try {
      return await provider.generateText(this.env, options, model);
    } catch (error) {
      console.error(`[WorkersAI] Fatal error in model ${model}:`, error);
      throw error;
    }
  }
}

export * from "./types";
export * from "./health";
