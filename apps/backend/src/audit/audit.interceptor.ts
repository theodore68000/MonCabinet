import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        if (req.auditAction) {
          this.auditService.log({
            ...req.auditAction,
            success: true,
            ip: req.ipAddress,
          });
        }
      }),
      catchError((err) => {
        if (req.auditAction) {
          this.auditService.log({
            ...req.auditAction,
            success: false,
            ip: req.ipAddress,
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
