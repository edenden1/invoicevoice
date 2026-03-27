import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';

export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors,
    });
    return;
  }

  // App errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Multer errors (file upload)
  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: 'File is too large. Maximum size is 25MB.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
    };
    res.status(400).json({ error: messages[err.code] || 'File upload error.' });
    return;
  }

  // Multer file filter errors (thrown as plain Error)
  if (err.message && err.message.startsWith('Invalid file type')) {
    res.status(400).json({ error: err.message });
    return;
  }

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json({
          error: 'A record with that value already exists.',
        });
        return;
      case 'P2025':
        res.status(404).json({ error: 'Record not found.' });
        return;
      case 'P2003':
        res.status(400).json({ error: 'Related record not found.' });
        return;
      default:
        res.status(400).json({ error: 'Database error.' });
        return;
    }
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: 'Invalid data provided.' });
    return;
  }

  // Generic errors — never leak internal details
  res.status(500).json({ error: 'Internal server error' });
}
