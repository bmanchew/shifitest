import express from 'express';
import { userController } from '../controllers/user.controller';
import { isAuthenticated, isAdmin } from '../middleware/auth';
import { asyncHandler } from '../services/errorHandler';

const router = express.Router();

// Public routes
router.get('/profile/:userId', asyncHandler(userController.getPublicProfile));

// User routes (require authentication)
router.get('/me', isAuthenticated, asyncHandler(userController.getProfile));
router.put('/me', isAuthenticated, asyncHandler(userController.updateProfile));
router.post('/me/change-password', isAuthenticated, asyncHandler(userController.changePassword));
router.put('/me/preferences', isAuthenticated, asyncHandler(userController.updatePreferences));
router.get('/me/notifications', isAuthenticated, asyncHandler(userController.getNotifications));
router.put('/me/notifications/:notificationId/read', isAuthenticated, asyncHandler(userController.markNotificationRead));

// Admin routes (require admin role)
router.get('/', isAdmin, asyncHandler(userController.getAllUsers));
router.get('/:userId', isAdmin, asyncHandler(userController.getUserById));
router.put('/:userId', isAdmin, asyncHandler(userController.updateUser));
router.delete('/:userId', isAdmin, asyncHandler(userController.deleteUser));
router.post('/', isAdmin, asyncHandler(userController.createUser));

export default router;