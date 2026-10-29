import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Admin guard that checks for a known admin token in the
 * `x-admin-token` request header or `authorization` header.
 * Matches the token stored in localStorage by the admin login page (`admin_token`).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly ADMIN_TOKEN = 'demo_admin_token';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token =
      request.headers['x-admin-token'] ||
      request.headers['authorization']?.replace('Bearer ', '');

    const expected = process.env.ADMIN_TOKEN || this.ADMIN_TOKEN;

    if (!token || (token !== this.ADMIN_TOKEN && token !== expected)) {
      throw new UnauthorizedException('Admin access required');
    }
    return true;
  }
}
