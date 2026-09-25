import { Module } from '@nestjs/common';
import { RateLimiter } from '../../infra/redis/rate-limiter';
import { AccountService } from './account.service';
import { AdminAuthController } from './admin-auth.controller';
import { AuthController } from './auth.controller';
import { DealerAuthController } from './dealer-auth.controller';
import { JoseIdTokenVerifier } from './id-token.verifier';
import { OtpService } from './otp.service';
import { ID_TOKEN_VERIFIER } from './ports';
import { CloudflareTurnstile, TURNSTILE } from './turnstile';
import { UsersService } from './users.service';

@Module({
  controllers: [AuthController, DealerAuthController, AdminAuthController],
  providers: [
    OtpService,
    UsersService,
    AccountService,
    RateLimiter,
    { provide: TURNSTILE, useClass: CloudflareTurnstile },
    { provide: ID_TOKEN_VERIFIER, useClass: JoseIdTokenVerifier },
  ],
  exports: [UsersService, OtpService, AccountService],
})
export class IdentityModule {}
