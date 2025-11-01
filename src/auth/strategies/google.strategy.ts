import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly prisma: PrismaService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
      scope: ['email', 'profile'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    const email = profile.emails?.[0]?.value;
    const googleId = profile.id;
    const firstName = profile.name?.givenName || 'User';
    const lastName = profile.name?.familyName || '';
    const avatarUrl = profile.photos?.[0]?.value || undefined;

    if (!email) {
      return null;
    }

    let user = await this.prisma.user.findFirst({ where: { googleId } });

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId,
            avatarUrl: avatarUrl || existingByEmail.avatarUrl,
            emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date(),
          },
        });
      }
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          googleId,
          avatarUrl,
          emailVerifiedAt: new Date(),
        },
      });
    }

    return { id: user.id, email: user.email };
  }
}
