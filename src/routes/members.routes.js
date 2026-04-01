import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { inviteMember, acceptInvite, getMembers, removeMember } from '../controllers/members.controller.js';

const router = Router();

router.post(
  '/invite',
  validate([
    query('profile_id').isUUID().withMessage('Invalid profile_id'),
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
  validate([query('profile_id').isUUID().withMessage('Invalid profile_id')]),
  getMembers
);

router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid member id')]),
  removeMember
);

export default router;
