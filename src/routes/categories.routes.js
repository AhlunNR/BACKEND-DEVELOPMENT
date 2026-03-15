import { Router } from 'express';
import { body, param } from 'express-validator';
import authenticate from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categories.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', getCategories);

router.post('/', validate([
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
]), createCategory);

router.put('/:id', validate([
  param('id').isUUID().withMessage('Invalid category ID'),
]), updateCategory);

router.delete('/:id', validate([
  param('id').isUUID().withMessage('Invalid category ID'),
]), deleteCategory);

export default router;
