import { LlmProviderConfig, CodexConfigObject } from "./codexOptions";

export type ApprovalMode = "never" | "on-request" | "on-failure" | "untrusted";

export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

export type ModelReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export type WebSearchMode = "disabled" | "cached" | "live";

export type ThreadOptions = {
  model?: string;
  sandboxMode?: SandboxMode;
  workingDirectory?: string;
  skipGitRepoCheck?: boolean;
  modelReasoningEffort?: ModelReasoningEffort;
  networkAccessEnabled?: boolean;
  webSearchMode?: WebSearchMode;
  webSearchEnabled?: boolean;
  approvalPolicy?: ApprovalMode;
  additionalDirectories?: string[];
  /** Unified dynamic LLM provider parameters override */
  llmProvider?: LlmProviderConfig;
  /** Custom config overrides for this specific thread */
  config?: CodexConfigObject;
  /** Enable fast mode for faster inference */
  fastMode?: boolean;
};
