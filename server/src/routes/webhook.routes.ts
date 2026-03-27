import { Router, Request, Response, NextFunction } from 'express';
import { handleWebhook } from '../services/payme.service';

const router = Router();

router.post(
  '/payme',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers['x-payme-signature'] as string;

      if (!signature) {
        res.status(400).json({ error: 'Missing x-payme-signature header' });
        return;
      }

      const payload =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      await handleWebhook(payload, signature);

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
