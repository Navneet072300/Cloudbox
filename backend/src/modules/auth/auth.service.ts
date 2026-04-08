import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../infrastructure/database/prisma';
import { AppError } from '../../shared/errors';

const ACCESS_TOKEN_EXPIRY      = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const BCRYPT_ROUNDS            = 12;

export interface TokenPair {
  accessToken:  string;
  refreshToken: string;
  user: {
    id:           string;
    email:        string;
    name:         string;
    storageQuota: number;
    storageUsed:  number;
  };
}

export class AuthService {
  async register(email: string, password: string, name: string) {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) throw new AppError('Email already registered', 409);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return user;
  }

  async login(
    email: string,
    password: string,
    deviceId?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<TokenPair> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Constant-time — prevent user enumeration via timing
    const dummy = '$2b$12$invalidhashpaddinginvalidhashpaddin';
    const valid  = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, dummy);

    if (!user || !valid) throw new AppError('Invalid email or password', 401);

    return this.issueTokenPair(user.id, user.email, user.name,
      Number(user.storageQuota), Number(user.storageUsed),
      { deviceId, userAgent, ipAddress });
  }

  async refreshTokens(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // Detect reuse: if token was previously valid but now revoked, security breach
      if (stored && !stored.revokedAt) {
        await prisma.refreshToken.updateMany({
          where: { userId: stored.userId },
          data:  { revokedAt: new Date() },
        });
      }
      throw new AppError('Invalid or expired refresh token', 401);
    }

    // Rotate: revoke current, issue new
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data:  { revokedAt: new Date() },
    });

    const u = stored.user;
    return this.issueTokenPair(u.id, u.email, u.name,
      Number(u.storageQuota), Number(u.storageUsed));
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true,
        storageUsed: true, storageQuota: true,
        avatarUrl: true, createdAt: true,
      },
    });
    if (!user) throw new AppError('User not found', 404);
    return {
      ...user,
      storageUsed:  Number(user.storageUsed),
      storageQuota: Number(user.storageQuota),
    };
  }

  verifyAccessToken(token: string): { sub: string; email: string } {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!, {
        algorithms: ['HS256'],
      }) as any;
    } catch {
      throw new AppError('Invalid or expired access token', 401);
    }
  }

  private async issueTokenPair(
    userId: string, email: string, name: string,
    storageQuota: number, storageUsed: number,
    meta: { deviceId?: string; userAgent?: string; ipAddress?: string } = {}
  ): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { sub: userId, email },
      process.env.JWT_SECRET!,
      { expiresIn: ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' }
    );

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash       = this.hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        deviceId:  meta.deviceId,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: { id: userId, email, name, storageQuota, storageUsed },
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
