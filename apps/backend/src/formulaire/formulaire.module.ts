import { Module } from '@nestjs/common';
import { FormulaireService } from './formulaire.service';
import { FormulaireController } from './formulaire.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [FormulaireController],
  providers: [FormulaireService, PrismaService],
  exports: [FormulaireService],
})
export class FormulaireModule {}
