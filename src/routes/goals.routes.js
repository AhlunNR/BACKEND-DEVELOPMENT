import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { getGoals, createGoal, updateGoal, deleteGoal } from '../controllers/goals.controller.js';

const router = Router();

router.get(
  '/',
  validate([query('profile_id').isUUID().withMessage('Invalid profile_id')]),
  getGoals
);

router.post(
  '/',
  validate([
    query('profile_id').isUUID().withMessage('Invalid profile_id'),
    body('name').notEmpty().withMessage('Name is required'),
    body('target_amount').isNumeric().withMessage('target_amount required'),
    body('current_amount').optional().isNumeric(),
    body('deadline').optional().isISO8601(),
  ]),
  createGoal
);

router.put(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid id')]),
  updateGoal
);

router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid id')]),
  deleteGoal
);

export default router;
