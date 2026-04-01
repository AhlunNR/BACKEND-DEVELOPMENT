import { Router } from 'express';
import { body, param, query } from 'express-validator';
import authenticate from '../middleware/auth.js';
import requireBusinessProfile, { requireEditor } from '../middleware/requireBusiness.js';
import { validate } from '../middleware/validate.js';
import {
  getPaymentMethods, createPaymentMethod, deletePaymentMethod,
  getVouchers, createVoucher, updateVoucher, deleteVoucher, validateVoucher,
  getOrders, getOrder, createOrder, cancelOrder, printReceipt, getSalesReport,
} from '../controllers/pos.controller.js';

const router = Router();
router.use(authenticate);
router.use(requireBusinessProfile);

router.get('/payment-methods', getPaymentMethods);
router.post('/payment-methods', requireEditor, validate([body('name').notEmpty()]), createPaymentMethod);
router.delete('/payment-methods/:id', requireEditor, validate([param('id').isUUID()]), deletePaymentMethod);

router.get('/vouchers', getVouchers);
router.post(
  '/vouchers',
  requireEditor,
  validate([
    body('code').notEmpty(),
    body('discount_type').isIn(['percent', 'fixed']),
    body('discount_value').isNumeric(),
  ]),
  createVoucher
);
router.put('/vouchers/:id', requireEditor, validate([param('id').isUUID()]), updateVoucher);
router.delete('/vouchers/:id', requireEditor, validate([param('id').isUUID()]), deleteVoucher);
router.post('/vouchers/validate', validate([body('code').notEmpty()]), validateVoucher);

router.get(
  '/orders',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]),
  getOrders
);
router.get('/orders/:id', validate([param('id').isUUID()]), getOrder);
router.post(
  '/orders',
  requireEditor,
  validate([body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array')]),
  createOrder
);
router.post('/orders/:id/cancel', requireEditor, validate([param('id').isUUID()]), cancelOrder);
router.get('/orders/:id/receipt', validate([param('id').isUUID()]), printReceipt);

router.get('/sales-report', getSalesReport);

export default router;
