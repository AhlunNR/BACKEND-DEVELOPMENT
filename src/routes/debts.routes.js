import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { getDebts, createDebt, updateDebt, payDebt, deleteDebt } from '../controllers/debts.controller.js';

const router = Router();

router.get(
  '/',
  validate([query('profile_id').isUUID().withMessage('Invalid profile_id')]),
  getDebts
);

router.post(
  '/',
  validate([
    query('profile_id').isUUID().withMessage('Invalid profile_id'),
    body('name').notEmpty().withMessage('Name is required'),
    body('type').isIn(['payable', 'receivable']).withMessage('Invalid type'),
    body('amount').isNumeric().withMessage('amount required'),
    body('due_date').optional().isISO8601(),
  ]),
  createDebt
);

router.put(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid id')]),
  updateDebt
);

router.post(
  '/:id/pay',
  validate([
    param('id').isUUID().withMessage('Invalid id'),
    body('amount').isNumeric().withMessage('Amount is required'),
  ]),
  payDebt
);

router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid id')]),
  deleteDebt
);

export default router;
