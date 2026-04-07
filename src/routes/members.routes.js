import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { inviteMember, acceptInvite, getMembers, removeMember } from '../controllers/members.controller.js';
import authenticate from '../middleware/auth.js';
import requireBusinessProfile, { requireEditor } from '../middleware/requireBusiness.js';

const router = Router();
router.use(authenticate);

router.post(
  '/invite',
  requireBusinessProfile,
  requireEditor,
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
  ]),
  inviteMember
);

router.post(
  '/:id/accept',
  validate([param('id').isUUID().withMessage('Invalid invite id')]),
  acceptInvite
);

router.get(
  '/',
  requireBusinessProfile,
  getMembers
);

router.delete(
  '/:id',
  requireBusinessProfile,
  requireEditor,
  validate([param('id').isUUID().withMessage('Invalid member id')]),
  removeMember
);

export default router;
