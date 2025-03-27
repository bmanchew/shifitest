import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { notificationService } from '../services';
import { twilioService } from '../services/twilio';
import { NotificationType, NotificationChannel, NotificationPriority } from '../services/notification';
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
    
    // Map to the expected interface
    const notificationParams = {
      userId: validatedData.recipientId,
      title: validatedData.subject || 'New Notification',
      message: validatedData.message || '',
      type: validatedData.type as unknown as NotificationType,
      channels: validatedData.channels?.map(channel => 
        channel === 'in_app' ? NotificationChannel.IN_APP : 
        channel === 'email' ? NotificationChannel.EMAIL : 
        channel === 'sms' ? NotificationChannel.SMS : 
        NotificationChannel.PUSH
      ),
      metadata: validatedData.data || {},
      priority: NotificationPriority.MEDIUM
    };
    
    // Send the notification
    const notificationId = await notificationService.sendNotification(notificationParams);
    
    if (notificationId > 0) {
      return res.status(200).json({
        success: true,
        message: 'Notification sent successfully',
        notificationId
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to send notification'
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

// Schema for direct SMS sending
const sendSmsSchema = z.object({
  phoneNumber: z.string().min(10), // Minimum 10 digits for phone numbers
  message: z.string().min(1).optional(), // Optional custom message
  merchantId: z.number().optional(),
  amount: z.number().optional(), // Optional amount for financing applications
  email: z.string().email().optional(), // Optional email
});

// Direct SMS sending endpoint
router.post('/send-sms', async (req, res) => {
  try {
    const validatedData = sendSmsSchema.parse(req.body);
    
    // Generate application URL or use default site URL
    const applicationUrl = req.body.applicationUrl || `${req.protocol}://${req.get('host')}/apply`;
    
    // Generate message if not provided
    const message = validatedData.message || 
      `You've been invited to apply for ShiFi financing${validatedData.amount ? ` for $${validatedData.amount.toFixed(2)}` : ''}. Apply here: ${applicationUrl}`;
    
    // Send the SMS via Twilio
    const result = await twilioService.sendSMS({
      to: validatedData.phoneNumber,
      body: message
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to send SMS'
      });
    }
    
    // Also create a notification record if we have a merchant ID
    if (validatedData.merchantId) {
      try {
        // Find a user with this phone number or create a placeholder
        let customerId = 0;
        const normalizedPhone = validatedData.phoneNumber.replace(/\D/g, '');
        const existingUser = await storage.getUserByPhone(normalizedPhone);
        
        if (existingUser) {
          customerId = existingUser.id;
        }
        
        // Create notification through the notification service for tracking
        const notificationParams = {
          userId: customerId || 0,
          title: 'Welcome to ShiFi',
          message: message,
          type: NotificationType.ACCOUNT_ACTIVITY, // Use appropriate type from enum
          channels: [NotificationChannel.SMS],
          metadata: {
            merchantId: validatedData.merchantId,
            applicationUrl,
            amount: validatedData.amount,
            recipientPhone: validatedData.phoneNumber
          }
        };
        
        await notificationService.sendNotification(notificationParams);
      } catch (notificationError) {
        // Log but don't fail the request if notification record creation fails
        logger.error({
          message: `Failed to create notification record: ${notificationError instanceof Error ? notificationError.message : String(notificationError)}`,
          category: 'api',
          source: 'internal'
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'SMS sent successfully',
      messageId: result.messageId,
      isSimulated: result.isSimulated
    });
  } catch (error) {
    logger.error({
      message: `Error sending SMS: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'twilio',
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

// Schema for testing SMS functionality
const testSmsSchema = z.object({
  phoneNumber: z.string().min(10), // Minimum 10 digits for phone numbers
  message: z.string().optional() // Optional test message
});

// Test SMS functionality endpoint
router.post('/test-sms', async (req, res) => {
  try {
    const validatedData = testSmsSchema.parse(req.body);
    
    // Generate test message if not provided
    const message = validatedData.message || 
      `This is a test SMS from ShiFi platform. Timestamp: ${new Date().toISOString()}`;
    
    // Send the SMS via Twilio
    const result = await twilioService.sendSMS({
      to: validatedData.phoneNumber,
      body: message
    });
    
    // Log the test attempt
    logger.info({
      message: `Test SMS to ${validatedData.phoneNumber}`,
      category: 'api',
      source: 'twilio',
      metadata: {
        success: result.success,
        messageId: result.messageId,
        isSimulated: result.isSimulated,
        error: result.error
      }
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to send test SMS'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: result.isSimulated ? 
        `Test SMS would be sent to ${validatedData.phoneNumber} (simulation mode)` : 
        `Test SMS sent to ${validatedData.phoneNumber}`,
      messageId: result.messageId,
      isSimulated: result.isSimulated
    });
  } catch (error) {
    logger.error({
      message: `Error sending test SMS: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'twilio',
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

export default router;