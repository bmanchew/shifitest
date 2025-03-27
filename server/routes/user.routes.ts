import express from 'express';
import { userController } from '../controllers/user.controller';
import { isAuthenticated, isAdmin } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/profile/:userId', userController.getPublicProfile);

// User routes (require authentication)
router.get('/me', isAuthenticated, userController.getProfile);
router.put('/me', isAuthenticated, userController.updateProfile);
router.post('/me/change-password', isAuthenticated, userController.changePassword);
router.put('/me/preferences', isAuthenticated, userController.updatePreferences);
router.get('/me/notifications', isAuthenticated, userController.getNotifications);
router.put('/me/notifications/:notificationId/read', isAuthenticated, userController.markNotificationRead);

// Admin routes (require admin role)
router.get('/', isAdmin, userController.getAllUsers);
router.get('/:userId', isAdmin, userController.getUserById);
router.put('/:userId', isAdmin, userController.updateUser);
router.delete('/:userId', isAdmin, userController.deleteUser);
router.post('/', isAdmin, userController.createUser);

export default router;