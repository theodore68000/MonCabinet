import {
  Controller,
  Post,
  Get,
  Delete,
  UploadedFile,
  UseInterceptors,
  Body,
  Param,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DocumentService } from "./document.service";
import { diskStorage } from "multer";
import { extname } from "path";

@Controller("document")
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads",
        filename: (_, file, callback) => {
          const random = Date.now();
          callback(null, random + extname(file.originalname));
        },
      }),
    })
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      patientId?: string; // optionnel
      procheId?: string;  // optionnel
      medecinId: string;
      type: string;
    }
  ) {
    if (!file) {
      throw new BadRequestException("Aucun fichier reçu");
    }

    if (!body?.medecinId) {
      throw new BadRequestException("medecinId est requis");
    }

    if (!body?.type) {
      throw new BadRequestException("type est requis");
    }

    const medecinId = Number(body.medecinId);
    if (isNaN(medecinId)) {
      throw new BadRequestException("medecinId invalide");
    }

    const procheId = body.procheId ? Number(body.procheId) : null;
    if (body.procheId && isNaN(procheId!)) {
      throw new BadRequestException("procheId invalide");
    }

    // 🔥 RÈGLE MÉTIER CENTRALE
    // si procheId → PAS de patientId
    const patientId =
      procheId ? null : body.patientId ? Number(body.patientId) : null;

    if (!procheId && !patientId) {
      throw new BadRequestException(
        "Un document doit être rattaché soit à un patient soit à un proche."
      );
    }

    if (patientId && isNaN(patientId)) {
      throw new BadRequestException("patientId invalide");
    }

    // URL complète pour accès front
    const url = `http://localhost:3001/uploads/${file.filename}`;

    const doc = await this.documentService.uploadForPatientOrProche({
      medecinId,
      patientId,
      procheId,
      type: body.type,
      url,
      filename: file.filename,
    });

    return {
      success: true,
      document: doc,
    };
  }

  @Get("patient/:id")
  async getByPatient(@Param("id") id: string) {
    const patientId = Number(id);
    if (isNaN(patientId)) {
      throw new BadRequestException("patientId invalide");
    }

    return this.documentService.findByPatient(patientId);
  }

  // ✅ delete document (DB + fichier)
  @Delete(":id")
  async remove(@Param("id") id: string) {
    const documentId = Number(id);
    if (isNaN(documentId)) {
      throw new BadRequestException("documentId invalide");
    }

    return this.documentService.remove(documentId);
  }
}
