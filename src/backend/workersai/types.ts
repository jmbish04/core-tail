/**
 * @fileoverview Shared types for the Workers AI orchestration module.
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
}

export interface AIGenerateOptions {
  /**
   * Simple text input for single-turn interactions. (If provided, converted to user message for chat models)
   */
  prompt?: string;
  
  /**
   * Structured conversation format with roles.
   */
  messages?: Message[];
  
  /**
   * Maximum number of tokens to generate.
   */
  max_tokens?: number;
  
  /**
   * Controls randomness.
   */
  temperature?: number;
  
  /**
   * JSON Mode / Function Calling response schema
   */
  response_format?: {
    type: "json_object" | "json_schema";
    json_schema?: any;
  };
}

export interface ModelProvider {
  /**
   * Formats a universal payload into the specific model's required format.
   * Then executes the fetch via the AI binding and normalizes the response to a string.
   */
  generateText(env: Env, options: AIGenerateOptions, model: string): Promise<string>;
}
