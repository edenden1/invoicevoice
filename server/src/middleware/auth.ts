import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/helpers';
import { prisma } from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Provide a Bearer token.' });
      return;
    }

    const token = authHeader.substring(7);

    let decoded: { userId: string };
    try {
      decoded = verifyToken(token);
    } catch {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found.' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
