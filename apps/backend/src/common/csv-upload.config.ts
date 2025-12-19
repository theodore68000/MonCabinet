import { BadRequestException } from "@nestjs/common";
import { diskStorage } from "multer";

export const csvUploadConfig = {
  fileFilter: (req: any, file: Express.Multer.File, cb: Function) => {
    if (!file.originalname.toLowerCase().endsWith(".csv")) {
      return cb(
        new BadRequestException("Le fichier doit être un CSV."),
        false,
      );
    }
    cb(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 Mo
  },
};
