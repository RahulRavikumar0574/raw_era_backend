import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class ChatRateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly maxRequests = 20;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.ip ||
      request.connection?.remoteAddress ||
      'unknown';

    const now = Date.now();
    const entry = this.store.get(ip);

    if (!entry || now > entry.resetAt) {
      this.store.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      throw new HttpException(
        'Too many chat requests. Please wait a moment and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
    return true;
  }
}
