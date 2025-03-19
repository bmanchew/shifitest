import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { notificationService } from '../services';
import { NotificationType } from '../services/notification';
import { logger } from '../services/logger';

const router = Router();

// Schema for notification requests
const sendNotificationSchema = z.object({
  type: z.enum([
    // Merchant notifications
    'merchant_welcome',
    'merchant_approval',
    'merchant_rejection',
    'merchant_document_request',
    'merchant_revenue_verification_complete',
    
    // Customer notifications
    'customer_welcome',
    'customer_application_submitted',
    'customer_application_approved',
    'customer_application_rejected',
    'customer_payment_reminder',
    'customer_payment_confirmation',
    'customer_contract_signed',
    
    // Admin notifications
    'admin_new_merchant',
    'admin_document_review',
    'admin_contract_review',
    'admin_payment_failed',
    'admin_high_risk_alert',
  ] as const),
  recipientId: z.number(),
  recipientType: z.enum(['merchant', 'customer', 'admin']),
  channels: z.array(z.enum(['email', 'sms', 'in_app', 'webhook'])).optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  data: z.record(z.any()).optional(),
});

// Send a notification
router.post('/send', async (req, res) => {
  try {
    const validatedData = sendNotificationSchema.parse(req.body);
    
    const result = await notificationService.sendNotification(
      validatedData.type as NotificationType,
      {
        recipientId: validatedData.recipientId,
        recipientType: validatedData.recipientType,
        channels: validatedData.channels,
        subject: validatedData.subject,
        message: validatedData.message,
        data: validatedData.data,
      }
    );
    
    // The notification service may return a boolean (legacy) or an object with success/error properties
    if (typeof result === 'boolean') {
      if (!result) {
        return res.status(400).json({ 
          success: false, 
          error: 'Failed to send notification'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Notification sent successfully'
      });
    } else {
      // Handle object response
      if (!result.success) {
        return res.status(400).json({ 
          success: false, 
          error: result.error || 'Failed to send notification'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Notification sent successfully',
        deliveredTo: result.channels
      });
    }
  } catch (error) {
    logger.error({
      message: `Error sending notification: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request'
    });
  }
});

// Get notifications for a user (customer, merchant or admin)
router.get('/:type/:id', async (req, res) => {
  try {
    const recipientType = req.params.type;
    if (!['merchant', 'customer', 'admin'].includes(recipientType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient type'
      });
    }
    
    const recipientId = parseInt(req.params.id);
    if (isNaN(recipientId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient ID'
      });
    }
    
    // Default pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Get notifications
    const notifications = await storage.getInAppNotifications(
      recipientId,
      recipientType as 'merchant' | 'customer' | 'admin',
      {
        limit,
        offset: (page - 1) * limit, // Calculate offset from page and limit
        unreadOnly: req.query.unreadOnly === 'true',
      }
    );
    
    // Get total count for pagination
    // Use the notifications we already retrieved to calculate the total count
    // This is a temporary solution until we implement a dedicated count method
    const totalCount = notifications.length;
    
    return res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving notifications: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications'
    });
  }
});

// Mark a notification as read
router.post('/:id/read', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification ID'
      });
    }
    
    const result = await storage.markInAppNotificationAsRead(id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error({
      message: `Error marking notification as read: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read for a recipient
router.post('/:type/:id/read-all', async (req, res) => {
  try {
    const recipientType = req.params.type;
    if (!['merchant', 'customer', 'admin'].includes(recipientType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient type'
      });
    }
    
    const recipientId = parseInt(req.params.id);
    if (isNaN(recipientId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient ID'
      });
    }
    
    await storage.markAllInAppNotificationsAsRead(
      recipientId,
      recipientType as 'merchant' | 'customer' | 'admin'
    );
    
    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error({
      message: `Error marking all notifications as read: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read'
    });
  }
});

export default router;