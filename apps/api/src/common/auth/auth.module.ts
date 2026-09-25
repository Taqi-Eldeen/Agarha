import { Global, Module } from '@nestjs/common';
import { AdminIpGuard } from './admin-ip.guard';
import { AuthGuard } from './guards';
import { TokenService } from './token.service';

@Global()
@Module({
  providers: [TokenService, AuthGuard, AdminIpGuard],
  exports: [TokenService, AuthGuard, AdminIpGuard],
})
export class AuthCoreModule {}
