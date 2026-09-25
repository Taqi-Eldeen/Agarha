import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Audit is global: every module records through AuditService. */
@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AdminModule {}
