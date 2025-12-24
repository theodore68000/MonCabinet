// apps/backend/src/schedule-reference/schedule-reference.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ScheduleReferenceController } from './schedule-reference.controller';
import { ScheduleReferenceService } from './schedule-reference.service';

@Module({
  controllers: [ScheduleReferenceController],
  providers: [ScheduleReferenceService, PrismaService],
  exports: [ScheduleReferenceService],
})
export class ScheduleReferenceModule {}
