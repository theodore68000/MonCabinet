import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class SecretaireAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new UnauthorizedException('Non authentifié');
    }

    if (user.role !== 'secretaire') {
      throw new UnauthorizedException('Accès réservé aux secrétaires');
    }

    return true;
  }
}
