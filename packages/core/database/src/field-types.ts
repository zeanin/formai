import bcrypt from 'bcrypt';

export interface FieldTypeHandler {
  type: string;
  toSequelize(options: any): any;
  beforeSave?(value: any): Promise<any>;
  afterFind?(value: any): any;
}

export class PasswordFieldHandler implements FieldTypeHandler {
  type = 'password';
  private readonly saltRounds: number;

  constructor(saltRounds = 10) {
    this.saltRounds = saltRounds;
  }

  toSequelize(_options: any): any {
    return { type: 'STRING' };
  }

  async beforeSave(value: any): Promise<any> {
    if (value == null) return value;
    // If already hashed (starts with $2b$ or $2a$), skip re-hashing
    if (typeof value === 'string' && /^\$2[ab]\$/.test(value)) {
      return value;
    }
    return bcrypt.hash(String(value), this.saltRounds);
  }

  afterFind(_value: any): any {
    // Never return raw hash to application layer
    return undefined;
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

export class FieldTypeRegistry {
  private handlers: Map<string, FieldTypeHandler> = new Map();

  constructor() {
    // Register built-in handlers
    this.register(new PasswordFieldHandler());
  }

  register(handler: FieldTypeHandler): void {
    this.handlers.set(handler.type, handler);
  }

  get(type: string): FieldTypeHandler | undefined {
    return this.handlers.get(type);
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  getAll(): FieldTypeHandler[] {
    return Array.from(this.handlers.values());
  }
}

// Global default registry instance
export const fieldTypeRegistry = new FieldTypeRegistry();
