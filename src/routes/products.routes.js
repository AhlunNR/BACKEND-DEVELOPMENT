import { Router } from 'express';
import { body, param, query } from 'express-validator';
import authenticate from '../middleware/auth.js';
import requireBusinessProfile, { requireEditor } from '../middleware/requireBusiness.js';
import { validate } from '../middleware/validate.js';
import {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct, adjustStock
} from '../controllers/products.controller.js';

const router = Router();
router.use(authenticate);
router.use(requireBusinessProfile);

router.get('/', getProducts);

router.get(
  '/:id',
  validate([param('id').isUUID()]),
  getProduct
);

router.post(
  '/',
  requireEditor,
  validate([
    body('name').notEmpty().withMessage('Name is required'),
    body('price').isNumeric().withMessage('Price is required'),
    body('cost_price').optional().isNumeric(),
    body('stock').optional().isInt({ min: 0 }),
    body('low_stock_threshold').optional().isInt({ min: 0 }),
    body('category_id').optional().isUUID(),
  ]),
  createProduct
);

router.put(
  '/:id',
  requireEditor,
  validate([param('id').isUUID()]),
  updateProduct
);

router.delete(
  '/:id',
  requireEditor,
  validate([param('id').isUUID()]),
  deleteProduct
);

router.patch(
  '/:id/stock',
  requireEditor,
  validate([
    param('id').isUUID(),
    body('adjustment').isInt().withMessage('adjustment must be an integer'),
  ]),
  adjustStock
);

export default router;
