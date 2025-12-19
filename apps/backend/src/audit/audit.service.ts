import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(entry: {
    userId?: number;
    role: string;
    action: string;
    targetType?: string;
    targetId?: number;
    ip?: string;
    success: boolean;
  }) {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch (err) {
      console.error('Erreur audit log:', err);
    }
  }
}
