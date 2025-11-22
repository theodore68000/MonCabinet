import { Test, TestingModule } from '@nestjs/testing';
import { MedecinController } from './medecin.controller';
import { MedecinService } from './medecin.service';

describe('MedecinController', () => {
  let controller: MedecinController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedecinController],
      providers: [MedecinService],
    }).compile();

    controller = module.get<MedecinController>(MedecinController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
