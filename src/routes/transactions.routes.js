import { Router } from 'express';
import { body, param, query } from 'express-validator';
import authenticate from '../middleware/auth.js';
import resolveProfile from '../middleware/resolveProfile.js';
import validate from '../middleware/validate.js';
import { getTransactions, getTransaction, createTransaction, updateTransaction, deleteTransaction, scanReceipt } from '../controllers/transactions.controller.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();
router.use(authenticate);

router.post('/ocr', upload.single('receipt'), scanReceipt);

router.use(resolveProfile);

router.get('/', validate([
  query('profile_id').optional().isUUID().withMessage('Invalid profile_id'),
]), getTransactions);

router.get('/:id', validate([
  param('id').isUUID().withMessage('Invalid transaction ID'),
]), getTransaction);

router.post('/', validate([
  body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
  body('description').notEmpty().withMessage('Description is required').trim(),
  body('date').optional().isDate().withMessage('Date must be YYYY-MM-DD'),
  body('receipt_url').optional({ checkFalsy: true }).isURL().withMessage('Invalid receipt URL'),
]), createTransaction);

router.put('/:id', validate([
  param('id').isUUID().withMessage('Invalid transaction ID'),
  body('receipt_url').optional({ checkFalsy: true }).isURL().withMessage('Invalid receipt URL'),
]), updateTransaction);

router.delete('/:id', validate([
  param('id').isUUID().withMessage('Invalid transaction ID'),
]), deleteTransaction);

export default router;
