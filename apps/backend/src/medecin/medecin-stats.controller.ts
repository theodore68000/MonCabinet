import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { MedecinStatsService } from './medecin-stats.service';

@Controller('medecin')
export class MedecinStatsController {
  constructor(private readonly statsService: MedecinStatsService) {}

  // -----------------------------------------------------
  //  ROUTE : GET /medecin/:id/stats
  //  → retourne toutes les stats du médecin
  // -----------------------------------------------------
  @Get(':id/stats')
  async getStats(@Param('id', ParseIntPipe) id: number) {
    return this.statsService.getStats(id);
  }
}
