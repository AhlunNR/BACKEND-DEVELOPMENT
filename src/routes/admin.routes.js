import { Router } from 'express';
import {
  adminLogin,
  requireAdminAuth,
  listUsers,
  sendEmailToUser,
  broadcastEmail,
  getGlobalNotifications,
  createGlobalNotification,
  updateGlobalNotification,
  deleteGlobalNotification
} from '../controllers/admin.controller.js';

const router = Router();

router.post('/login', adminLogin);
router.use(requireAdminAuth);
router.get('/users',         listUsers);
router.post('/send-email',   sendEmailToUser);
router.post('/broadcast',    broadcastEmail);

router.get('/notifications', getGlobalNotifications);
router.post('/notifications', createGlobalNotification);
router.put('/notifications/:id', updateGlobalNotification);
router.delete('/notifications/:id', deleteGlobalNotification);

export default router;
