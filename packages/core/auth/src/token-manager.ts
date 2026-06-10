import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { TokenPayload } from '@formai/shared';

export interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn?: string;
}

export class TokenManager {
  private blacklistedTokens: Set<string> = new Set(); // In production, use Redis

  constructor(private config: JWTConfig) {}

  /**
   * Generate an access token.
   */
  sign(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.expiresIn,
      jwtid: randomUUID(),
    } as jwt.SignOptions);
  }

  /**
   * Generate a refresh token.
   */
  signRefresh(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.refreshExpiresIn || '30d',
      jwtid: randomUUID(),
    } as jwt.SignOptions);
  }

  /**
   * Verify a token and return its payload.
   * Throws if the token is invalid, expired, or blacklisted.
   */
  verify(token: string): TokenPayload {
    if (this.blacklistedTokens.has(token)) {
      throw new Error('Token has been revoked');
    }
    return jwt.verify(token, this.config.secret) as TokenPayload;
  }

  /**
   * Blacklist a token so it can no longer be used.
   */
  async blacklist(token: string): Promise<void> {
    this.blacklistedTokens.add(token);
  }

  /**
   * Check whether a token has been blacklisted.
   */
  isBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  /**
   * Refresh tokens: verify the refresh token, issue a new access + refresh pair,
   * and blacklist the old refresh token.
   */
  refresh(refreshToken: string): { token: string; refreshToken: string } {
    const payload = this.verify(refreshToken);
    const newToken = this.sign({ userId: payload.userId, roleName: payload.roleName });
    const newRefresh = this.signRefresh({ userId: payload.userId, roleName: payload.roleName });
    this.blacklistedTokens.add(refreshToken);
    return { token: newToken, refreshToken: newRefresh };
  }
}
