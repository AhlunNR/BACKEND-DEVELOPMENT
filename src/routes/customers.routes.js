import { Router } from 'express';
import { body, param } from 'express-validator';
import authenticate from '../middleware/auth.js';
import requireBusinessProfile, { requireEditor } from '../middleware/requireBusiness.js';
import { validate } from '../middleware/validate.js';
import { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer } from '../controllers/customers.controller.js';

const router = Router();
router.use(authenticate);
router.use(requireBusinessProfile);

router.get('/', getCustomers);
router.get('/:id', validate([param('id').isUUID()]), getCustomer);

router.post(
  '/',
  requireEditor,
  validate([body('name').notEmpty().withMessage('Name is required')]),
  createCustomer
);

router.put(
  '/:id',
  requireEditor,
  validate([param('id').isUUID()]),
  updateCustomer
);

router.delete(
  '/:id',
  requireEditor,
  validate([param('id').isUUID()]),
  deleteCustomer
);

export default router;
