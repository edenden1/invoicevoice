import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireActiveSubscription } from '../middleware/subscription';
import { audioUpload } from '../middleware/upload';
import {
  createFromVoice,
  create,
  getAll,
  getById,
  update,
  remove,
  send,
  getPublicInvoice,
  getStats,
  markAsPaid,
} from '../controllers/invoice.controller';

const router = Router();

// Public route (no auth)
router.get('/public/:id', getPublicInvoice);

// Auth-required routes
router.post('/voice', authenticate, requireActiveSubscription, audioUpload.single('audio'), createFromVoice);
router.post('/', authenticate, requireActiveSubscription, create);
router.get('/', authenticate, getAll);
router.get('/stats', authenticate, getStats);
router.get('/:id', authenticate, getById);
router.put('/:id', authenticate, update);
router.delete('/:id', authenticate, remove);
router.post('/:id/send', authenticate, requireActiveSubscription, send);
router.post('/:id/mark-paid', authenticate, markAsPaid);

export default router;
