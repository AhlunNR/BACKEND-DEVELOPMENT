import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import authenticate from '../middleware/auth.js';
import resolveProfile from '../middleware/resolveProfile.js';
import { getBudgets, createBudget, updateBudget, deleteBudget } from '../controllers/budgets.controller.js';

const router = Router();
router.use(authenticate);
router.use(resolveProfile);


router.get(
  '/',
  validate([
    query('month').isInt({ min: 1, max: 12 }),
    query('year').isInt(),
  ]),
  getBudgets
);

router.post(
  '/',
  validate([
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
