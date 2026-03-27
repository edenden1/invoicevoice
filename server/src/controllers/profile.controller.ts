import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../config/database';
import { config } from '../config';
import {
  createMerchantAccount,
  createOnboardingLink,
  retrieveAccount,
  createSubscriptionPortalUrl,
} from '../services/payme.service';

const updateProfileSchema = z.object({
  businessName: z.string().min(1).optional(),
  ownerName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  tradeType: z
    .enum([
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
    ])
    .optional(),
  licenseNumber: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
});

export async function getProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: {
        id: true,
        businessName: true,
        ownerName: true,
        phone: true,
        tradeType: true,
        licenseNumber: true,
        logoUrl: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        zip: true,
        paymeAccountId: true,
        paymentOnboarded: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      throw new AppError('Profile not found', 404);
    }

    res.json({ profile });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = updateProfileSchema.parse(req.body);

    const profile = await prisma.profile.update({
      where: { userId: req.user!.id },
      data,
    });

    res.json({ profile });
  } catch (error) {
    next(error);
  }
}

export async function setupPayme(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;

    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new AppError('Profile not found', 404);
    }

    let accountId = profile.paymeAccountId;

    if (!accountId) {
      accountId = await createMerchantAccount(userId, req.user!.email);
    }

    // Deep links bring the user back into the mobile app after PayMe onboarding
    const returnUrl = `${config.app.scheme}://payme-callback`;
    const refreshUrl = `${config.app.scheme}://payme-refresh`;

    const onboardingUrl = await createOnboardingLink(
      accountId,
      returnUrl,
      refreshUrl
    );

    res.json({ url: onboardingUrl });
  } catch (error) {
    next(error);
  }
}

export async function paymeCallback(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile || !profile.paymeAccountId) {
      throw new AppError('PayMe account not found', 404);
    }

    // The seller-status-update webhook will handle setting paymentOnboarded,
    // but we can check immediately too
    const account = await retrieveAccount(profile.paymeAccountId);

    if (account.active && account.verified) {
      await prisma.profile.update({
        where: { userId: req.user!.id },
        data: { paymentOnboarded: true },
      });
    }

    const updatedProfile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });

    res.json({ profile: updatedProfile });
  } catch (error) {
    next(error);
  }
}

export async function getSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: {
        subscriptionId: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        paymeCustomerId: true,
      },
    });

    if (!profile) {
      throw new AppError('Profile not found', 404);
    }

    res.json({ subscription: profile });
  } catch (error) {
    next(error);
  }
}

export async function manageSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: { paymeCustomerId: true },
    });

    if (!profile?.paymeCustomerId) {
      throw new AppError('No billing account found. Please contact support.', 404);
    }

    const returnUrl = `${config.app.scheme}://settings`;
    const url = await createSubscriptionPortalUrl(profile.paymeCustomerId, returnUrl);

    res.json({ url });
  } catch (error) {
    next(error);
  }
}
