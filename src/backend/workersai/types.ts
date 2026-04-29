/**
 * @fileoverview Shared types for the Workers AI orchestration module.
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
}

export interface ToolCall {
  name: string;
  arguments: any;
}

export interface ToolResponse {
  response: string;
  tool_calls?: ToolCall[];
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

  /**
   * Tools available for the model to call.
   */
  tools?: any[];

  /**
   * Forces the model to use a specific tool, or automatically decide.
   */
  tool_choice?: any;
}

export interface ModelProvider {
  /**
   * Formats a universal payload into the specific model's required format.
   * Then executes the fetch via the AI binding and normalizes the response to a string.
   */
  generateText(env: Env, options: AIGenerateOptions, model: string): Promise<string>;

  /**
   * Generates a structured JSON response. Ensures response_format is used and parses the output.
   */
  generateStructuredResponse<T>(env: Env, options: AIGenerateOptions, model: string): Promise<T>;

  /**
   * Generates text while potentially calling functions/tools.
   */
  generateWithTools(env: Env, options: AIGenerateOptions, model: string): Promise<ToolResponse>;
}
