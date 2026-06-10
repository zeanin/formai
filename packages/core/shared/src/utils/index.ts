export const FORMAI_VERSION: string = '0.1.0';
export const FORMAI_NAME: string = 'Formai';

export type DeepPartial<T> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] };

export function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isNil(value: any): value is null | undefined {
  return value === null || value === undefined;
}

export function isEmpty(value: any): boolean {
  if (isNil(value)) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (isObject(value)) return Object.keys(value).length === 0;
  return false;
}

export function omit<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

export function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) result[key] = obj[key];
  });
  return result;
}

export function uid(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (isNil(value)) return [];
  return Array.isArray(value) ? value : [value];
}

export function merge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      const targetVal = (target as any)[key];
      const sourceVal = (source as any)[key];
      if (isObject(targetVal) && isObject(sourceVal)) {
        (target as any)[key] = merge({ ...targetVal }, sourceVal);
      } else if (sourceVal !== undefined) {
        (target as any)[key] = sourceVal;
      }
    }
  }
  return target;
}
