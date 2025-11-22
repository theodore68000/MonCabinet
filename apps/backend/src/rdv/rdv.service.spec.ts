import { Test, TestingModule } from '@nestjs/testing';
import { RdvService } from './rdv.service';

describe('RdvService', () => {
  let service: RdvService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RdvService],
    }).compile();

    service = module.get<RdvService>(RdvService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
