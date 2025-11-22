import { Test, TestingModule } from '@nestjs/testing';
import { RdvController } from './rdv.controller';

describe('RdvController', () => {
  let controller: RdvController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RdvController],
    }).compile();

    controller = module.get<RdvController>(RdvController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
