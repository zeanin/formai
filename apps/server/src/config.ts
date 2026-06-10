export function getConfig() {
  return {
    database: {
      dialect: 'postgres' as const,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'formai',
      password: process.env.DB_PASSWORD || 'formai',
      database: process.env.DB_NAME || 'formai',
      logging: process.env.DB_LOGGING === 'true',
    },
    server: {
      port: parseInt(process.env.PORT || '3000'),
      cors: true,
    },
    auth: {
      jwt: {
        secret: process.env.JWT_SECRET || 'formai-dev-secret-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      },
    },
    ai: {
      defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'openai',
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL || 'gpt-4o',
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      },
    },
    storage: {
      type: process.env.STORAGE_TYPE || 'local',
      localPath: process.env.STORAGE_LOCAL_PATH || './storage/uploads',
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
