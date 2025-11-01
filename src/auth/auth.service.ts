import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(data: { email: string; password?: string; firstName: string; lastName: string }): Promise<any> {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new BadRequestException('Email already in use');

    const hash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: hash,
        emailVerifiedAt: null,
      },
    });
    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.publicUser(user), ...tokens };
  }

  async login(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.publicUser(user), ...tokens };
  }

  async refresh(refreshToken?: string): Promise<any> {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_TOKEN_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');
    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.publicUser(user), ...tokens };
  }

  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      path: '/',
      maxAge: 1000 * 60 * 60, // 1h
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7d
    });
  }

  clearAuthCookies(res: Response): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('access_token', { path: '/', sameSite: isProd ? 'none' : 'lax', secure: isProd });
    res.clearCookie('refresh_token', { path: '/', sameSite: isProd ? 'none' : 'lax', secure: isProd });
  }

  private async issueTokens(userId: string, email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: process.env.JWT_ACCESS_TOKEN_SECRET,
        expiresIn: this.parseExpires(process.env.JWT_ACCESS_TOKEN_EXPIRES, 15 * 60),
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: process.env.JWT_REFRESH_TOKEN_SECRET,
        expiresIn: this.parseExpires(process.env.JWT_REFRESH_TOKEN_EXPIRES, 7 * 24 * 60 * 60),
      },
    );
    return { accessToken, refreshToken };
  }

  private publicUser(user: any) {
    const { password, ...safe } = user;
    return safe;
  }

  private parseExpires(value: string | undefined, fallbackSeconds: number): number {
    if (!value) return fallbackSeconds;
    // Accept numeric seconds
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) return numeric;
    // Accept tokens like 15m, 1h, 7d, 30s
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) return fallbackSeconds;
    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return amount * (multipliers[unit] ?? 1);
  }
}
