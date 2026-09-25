import { Module } from '@nestjs/common';
import { AdminDocumentsController, DealerDocumentsController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  controllers: [DealerDocumentsController, AdminDocumentsController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
