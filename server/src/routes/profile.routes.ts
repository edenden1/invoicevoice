import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getProfile,
  updateProfile,
  setupStripe,
  stripeCallback,
  getSubscription,
  manageSubscription,
} from '../controllers/profile.controller';

const router = Router();

router.get('/', authenticate, getProfile);
router.put('/', authenticate, updateProfile);
router.post('/stripe/setup', authenticate, setupStripe);
router.get('/stripe/callback', authenticate, stripeCallback);
router.get('/subscription', authenticate, getSubscription);
router.post('/subscription/portal', authenticate, manageSubscription);

export default router;
