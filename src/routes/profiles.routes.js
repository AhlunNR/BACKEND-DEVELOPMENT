import { Router } from 'express';
import { body, param } from 'express-validator';
import authenticate from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import {
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  setDefaultProfile,
} from '../controllers/profiles.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', getProfiles);

router.post('/', validate([
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('type').isIn(['personal', 'business']).withMessage('Type must be personal or business'),
  body('icon').optional().isString(),
  body('color').optional().isString(),
]), createProfile);

router.put('/:id', validate([
  param('id').isUUID().withMessage('Invalid profile ID'),
]), updateProfile);

router.delete('/:id', validate([
  param('id').isUUID().withMessage('Invalid profile ID'),
]), deleteProfile);

router.patch('/:id/default', validate([
  param('id').isUUID().withMessage('Invalid profile ID'),
]), setDefaultProfile);

export default router;
