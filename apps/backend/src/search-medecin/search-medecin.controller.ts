import { Controller, Get, Query } from "@nestjs/common";
import { SearchMedecinService } from "./search-medecin.service";

@Controller("search-medecin")
export class SearchMedecinController {
  constructor(private readonly searchMedService: SearchMedecinService) {}

  /**
   * 🔎 Recherche avancée (filtres)
   * GET /search-medecin
   */
  @Get()
  async search(@Query() query: any) {
    return this.searchMedService.search({
      specialites: query.specialites
        ? String(query.specialites).split(",")
        : undefined,

      rayon: query.rayon ? Number(query.rayon) : undefined,

      patientLat: query.patientLat ? Number(query.patientLat) : undefined,
      patientLng: query.patientLng ? Number(query.patientLng) : undefined,

      noteMin: query.noteMin ? Number(query.noteMin) : undefined,
      delai: query.delai ? Number(query.delai) : undefined,
    });
  }

  /**
   * 🔎 Recherche rapide : autocomplete noms/prénoms
   * GET /search-medecin/search-names?q=...
   */
  @Get("search-names")
  async searchNames(@Query("q") q: string) {
    return this.searchMedService.searchNames(q);
  }
}
