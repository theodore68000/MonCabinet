import { Module } from "@nestjs/common";
import { SearchMedecinService } from "./search-medecin.service";
import { SearchMedecinController } from "./search-medecin.controller";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [SearchMedecinController],
  providers: [SearchMedecinService, PrismaService],
})
export class SearchMedecinModule {}
