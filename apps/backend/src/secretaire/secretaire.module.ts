import { Module } from '@nestjs/common';
import { SecretaireController } from './secretaire.controller';
import { SecretaireService } from './secretaire.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../common/security/security.module';

@Module({
  imports: [PrismaModule, SecurityModule],
  controllers: [SecretaireController],
  providers: [SecretaireService],
  exports: [SecretaireService],
})
export class SecretaireModule {}
