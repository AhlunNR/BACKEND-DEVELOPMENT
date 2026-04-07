import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import authenticate from '../middleware/auth.js';
import resolveProfile from '../middleware/resolveProfile.js';
import { getRecurring, createRecurring, updateRecurring, deleteRecurring } from '../controllers/recurring.controller.js';

const router = Router();
router.use(authenticate);
router.use(resolveProfile);


router.get('/', getRecurring);

router.post(
  '/',
  validate([
    body('category_id').optional().isUUID().withMessage('Invalid category_id'),
    body('type').isIn(['income', 'expense']).withMessage('Invalid type'),
    body('amount').isNumeric().withMessage('amount required'),
    body('description').notEmpty().withMessage('Description required'),
    body('frequency').isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('Invalid frequency'),
    body('next_date').isISO8601().withMessage('next_date is required'),
  ]),
  createRecurring
);

router.put(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid id')]),
  updateRecurring
);

router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid id')]),
  deleteRecurring
);

export default router;
