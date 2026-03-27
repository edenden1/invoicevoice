import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../config/database';

// Allows trialing and active subscriptions.
// past_due gets a grace period (Stripe will retry payment automatically).
// canceled and unpaid are blocked with a 402.
export async function requireActiveSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: { subscriptionStatus: true },
    });

    const status = profile?.subscriptionStatus ?? 'trialing';

    if (status === 'trialing' || status === 'active' || status === 'past_due') {
      next();
      return;
    }

    res.status(402).json({
      error: 'Your subscription has ended. Please renew to continue.',
      code: 'SUBSCRIPTION_REQUIRED',
      subscriptionStatus: status,
    });
  } catch (error) {
    next(error);
  }
}
