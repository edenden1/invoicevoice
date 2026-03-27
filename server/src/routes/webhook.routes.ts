import { Router, Request, Response, NextFunction } from 'express';
import { handleWebhook } from '../services/stripe.service';

const router = Router();

router.post(
  '/stripe',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }

      await handleWebhook(req.body as Buffer, signature);

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
