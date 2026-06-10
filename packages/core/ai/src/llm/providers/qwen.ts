import { OpenAIProvider } from './openai';
import type { OpenAIConfig } from './openai';

export class QwenProvider extends OpenAIProvider {
  name = 'qwen';

  constructor(config: OpenAIConfig) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: config.model || 'qwen-plus',
    });
    this.defaultModel = config.model || 'qwen-plus';
  }
}
