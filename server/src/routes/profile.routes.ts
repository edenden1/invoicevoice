import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getProfile,
  updateProfile,
  setupPayme,
  paymeCallback,
  getSubscription,
  manageSubscription,
} from '../controllers/profile.controller';

const router = Router();

router.get('/', authenticate, getProfile);
router.put('/', authenticate, updateProfile);
router.post('/payme/setup', authenticate, setupPayme);
router.get('/payme/callback', authenticate, paymeCallback);
router.get('/subscription', authenticate, getSubscription);
router.post('/subscription/portal', authenticate, manageSubscription);

export default router;
