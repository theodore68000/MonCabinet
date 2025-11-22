import { Test, TestingModule } from '@nestjs/testing';
import { MedecinService } from './medecin.service';

describe('MedecinService', () => {
  let service: MedecinService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MedecinService],
    }).compile();

    service = module.get<MedecinService>(MedecinService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
