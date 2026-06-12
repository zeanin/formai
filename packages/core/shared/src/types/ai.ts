export type AIRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  role: AIRole;
  content: string;
  name?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface AIMessageChunk {
  role?: AIRole;
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

export interface ChatOptions {
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  tools?: ToolDefinition[];
  responseFormat?: 'text' | 'json';
  stream?: boolean;
}

export interface AIAgent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  provider: string;
  tools: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface AgentResult {
  success: boolean;
  output: any;
  messages: AIMessage[];
  toolResults?: Array<{ toolCallId: string; result: any }>;
  usage?: TokenUsage;
  pendingConfirmation?: any;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface EmbeddingResult {
  embeddings: number[][];
  usage?: { totalTokens: number };
}

export type ToolPermissionLevel = 'read' | 'write' | 'dangerous' | 'forbidden';

export interface AIDataScope {
  readableCollections: string[];
  readableFields: Record<string, string[]>;
  maxRowsPerQuery: number;
  allowAggregation: boolean;
  allowRawSQL: boolean;
}
