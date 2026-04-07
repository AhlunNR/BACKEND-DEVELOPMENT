import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import authenticate from '../middleware/auth.js';
import resolveProfile from '../middleware/resolveProfile.js';
import { getGoals, createGoal, updateGoal, deleteGoal } from '../controllers/goals.controller.js';

const router = Router();
router.use(authenticate);
router.use(resolveProfile);


router.get('/', getGoals);

router.post(
  '/',
  validate([
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
