export const FORMAI_VERSION = '0.1.0';
export const FORMAI_NAME = 'Formai';
export { type DeepPartial, isObject, delay } from '@formai/shared';

export interface SDKConfig {
  apiUrl: string;
  apiKey?: string;
}

export class FormaiSDK {
  private config: SDKConfig;

  constructor(config: SDKConfig) {
    this.config = config;
  }

  getConfig(): Readonly<SDKConfig> {
    return this.config;
  }
}

export default FormaiSDK;
