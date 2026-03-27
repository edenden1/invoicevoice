import jwt from 'jsonwebtoken';
import { config } from '../config';

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as string,
    algorithm: 'HS256',
  } as jwt.SignOptions);
}

export function verifyToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],
  }) as { userId: string };
  return decoded;
}
