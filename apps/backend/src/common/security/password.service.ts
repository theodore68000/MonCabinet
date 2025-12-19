import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async compare(
    plain: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
