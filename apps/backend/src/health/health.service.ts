import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "ok";
    } catch (e) {
      return "error";
    }
  }

  async simple() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  async full() {
    const db = await this.checkDatabase();

    return {
      status: db === "ok" ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: db,
      },
    };
  }
}
