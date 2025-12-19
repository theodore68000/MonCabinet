import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  use(req: Request, _: Response, next: NextFunction) {
    req['ipAddress'] = req.headers['x-forwarded-for'] || req.ip;
    next();
  }
}
