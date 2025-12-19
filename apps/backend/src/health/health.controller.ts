import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  basic() {
    return this.healthService.simple();
  }

  @Get('full')
  full() {
    return this.healthService.full();
  }
}
