import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { generateToken } from '../utils/helpers';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { createBillingCustomer, createBillingSubscription } from '../services/payme.service';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  businessName: z.string().min(1, 'Business name is required'),
  ownerName: z.string().min(1, 'Owner name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  tradeType: z.enum([
    'PLUMBING',
    'ELECTRICAL',
    'HVAC',
    'GENERAL_HANDYMAN',
    'LOCKSMITH',
    'PAINTING',
    'LANDSCAPING',
    'CLEANING',
    'APPLIANCE_REPAIR',
    'OTHER',
  ]),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Unable to complete registration. Please try again or login.', 400);
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        profile: {
          create: {
            businessName: data.businessName,
            ownerName: data.ownerName,
            phone: data.phone,
            tradeType: data.tradeType,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const token = generateToken(user.id);

    // Fire-and-forget — billing failure must never block registration
    createBillingCustomer(user.id, user.email, data.businessName)
      .then((customerId) => createBillingSubscription(customerId, user.id))
      .catch((err) =>
        console.error('[Billing] Failed to create subscription for user', user.id, err)
      );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { profile: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile,
      },
    });
  } catch (error) {
    next(error);
  }
}
