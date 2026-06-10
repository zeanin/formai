export type CodexConfigValue = string | number | boolean | CodexConfigValue[] | CodexConfigObject;

export type CodexConfigObject = { [key: string]: CodexConfigValue };

export type LlmProviderConfig = {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'vllm' | 'azure-openai' | 'custom' | 'aliyun';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  customHeaders?: Record<string, string>;
};

export type CodexOptions = {
  /**
   * Optional custom URL to connect to a resident Codex app-server daemon.
   * For example, 'ws://127.0.0.1:3005/rpc'. If provided, the SDK will communicate
   * with the daemon via WebSockets JSON-RPC instead of spawning a new child process.
   */
  daemonUrl?: string;
  /**
   * Optional Unix Domain Socket path to connect to a resident Codex daemon.
   * If provided, the SDK will connect via UDS.
   */
  socketPath?: string;
  codexPathOverride?: string;
  baseUrl?: string;
  apiKey?: string;
  /**
   * Additional `--config key=value` overrides to pass to the Codex CLI.
   *
   * Provide a JSON object and the SDK will flatten it into dotted paths and
   * serialize values as TOML literals so they are compatible with the CLI's
   * `--config` parsing.
   */
  config?: CodexConfigObject;
  /**
   * Environment variables passed to the Codex CLI process. When provided, the SDK
   * will not inherit variables from `process.env`.
   */
  env?: Record<string, string>;
  /**
   * Unified dynamic LLM provider parameters config.
   */
  llmProvider?: LlmProviderConfig;
  /**
   * Enable fast mode globally for faster inference.
   */
  fastMode?: boolean;
};

