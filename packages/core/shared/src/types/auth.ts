export interface User {
  id: number | string;
  username: string;
  email?: string;
  phone?: string;
  nickname?: string;
  role?: string;
  roles?: Role[];
  [key: string]: any;
}

export interface Role {
  name: string;
  title?: string;
  strategy?: RoleStrategy;
  snippets?: string[];
}

export type RoleStrategy = 'allowAll' | 'denyAll' | 'ownOnly';

export interface TokenPayload {
  userId: number | string;
  roleName?: string;
  iat?: number;
  exp?: number;
}

export interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn?: string;
  };
}
