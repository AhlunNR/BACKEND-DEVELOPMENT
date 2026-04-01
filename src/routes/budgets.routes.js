import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { getBudgets, createBudget, updateBudget, deleteBudget } from '../controllers/budgets.controller.js';

const router = Router();

router.get(
  '/',
  validate([
    query('profile_id').isUUID().withMessage('Invalid profile_id'),
    query('month').isInt({ min: 1, max: 12 }),
    query('year').isInt(),
  ]),
  getBudgets
);

router.post(
  '/',
  validate([
    query('profile_id').isUUID().withMessage('Invalid profile_id'),
    body('category_id').isUUID().withMessage('Invalid category_id'),
    body('amount').isNumeric().withMessage('Amount must be positive number'),
    body('month').isInt({ min: 1, max: 12 }),
    body('year').isInt(),
  ]),
  createBudget
);

router.put(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid id'),
    body('amount').isNumeric(),
  ]),
  updateBudget
);

router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid id')]),
  deleteBudget
);

export default router;
