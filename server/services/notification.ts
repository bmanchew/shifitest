import { logger } from './logger';
import { DatabaseStorage } from '../storage';
import { twilioService, TwilioMessage } from './twilio';

/**
 * Notification types that can be sent in the system
 */
export enum NotificationType {
  ACCOUNT_ACTIVITY = 'account_activity',
  CONTRACT_UPDATE = 'contract_update',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_DUE = 'payment_due',
  DOCUMENT_READY = 'document_ready',
  SYSTEM_ALERT = 'system_alert',
  APPLICATION_STATUS = 'application_status',
  REPORT_READY = 'report_ready'
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Notification channel for delivery
 */
export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push'
}

/**
 * Interface for creating a notification
 */
export interface CreateNotificationParams {
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  metadata?: Record<string, any>;
  actionUrl?: string;
  expireAt?: Date;
}

/**
 * Interface for the core notification service functions
 */
export interface INotificationService {
  /**
   * Send a notification to a user through specified channels
   * @param params Notification parameters
   * @returns The created notification ID
   */
  sendNotification(params: CreateNotificationParams): Promise<number>;
  
  /**
   * Mark a notification as read
   * @param notificationId Notification ID
   * @param userId User ID
   * @returns True if marked as read, false otherwise
   */
  markAsRead(notificationId: number, userId: number): Promise<boolean>;
  
  /**
   * Get notifications for a user
   * @param userId User ID
   * @param limit Limit number of notifications
   * @param offset Offset for pagination
   * @returns Array of notifications
   */
  getNotificationsForUser(userId: number, limit?: number, offset?: number): Promise<any[]>;
}

/**
 * Service for handling system notifications
 */
export class NotificationService implements INotificationService {
  private storage: DatabaseStorage;
  
  /**
   * Constructor
   * @param storage Storage instance for database operations
   */
  constructor(storage: DatabaseStorage) {
    this.storage = storage;
  }
  
  /**
   * Send a notification to a user through specified channels
   * @param params Notification parameters
   * @returns The created notification ID
   */
  async sendNotification(params: CreateNotificationParams): Promise<number> {
    try {
      const {
        userId,
        title,
        message,
        type,
        priority = NotificationPriority.MEDIUM,
        channels = [NotificationChannel.IN_APP],
        metadata = {},
        actionUrl,
        expireAt
      } = params;
      
      // Log notification creation
      logger.info({
        message: `Creating notification for user ID ${userId}: ${title}`,
        category: "notification",
        userId,
        source: "internal",
        metadata: {
          type,
          priority,
          channels
        }
      });
      
      // Create notification in database
      const notification = await this.storage.createNotification({
        userId,
        title,
        message,
        type,
        priority,
        isRead: false,
        metadata,
        actionUrl,
        expireAt,
        createdAt: new Date()
      });
      
      // Process delivery through each channel
      for (const channel of channels) {
        await this.deliverThroughChannel(notification.id, userId, channel, {
          title,
          message,
          type,
          priority,
          metadata,
          actionUrl
        });
      }
      
      return notification.id;
    } catch (error) {
      logger.error({
        message: `Error sending notification: ${error instanceof Error ? error.message : String(error)}`,
        category: "notification",
        userId: params.userId,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          notificationParams: {
            ...params,
            message: params.message.substring(0, 100) + (params.message.length > 100 ? '...' : '')
          }
        }
      });
      
      throw error;
    }
  }
  
  /**
   * Mark a notification as read
   * @param notificationId Notification ID
   * @param userId User ID
   * @returns True if marked as read, false otherwise
   */
  async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    try {
      // Get notification to verify ownership
      const notification = await this.storage.getNotification(notificationId);
      
      if (!notification) {
        logger.warn({
          message: `Attempt to mark non-existent notification as read: ${notificationId}`,
          category: "notification",
          userId,
          source: "internal"
        });
        
        return false;
      }
      
      // Verify the notification belongs to the user
      if (notification.userId !== userId) {
        logger.warn({
          message: `User ${userId} attempted to mark notification ${notificationId} as read, but it belongs to ${notification.userId}`,
          category: "security",
          userId,
          source: "internal"
        });
        
        return false;
      }
      
      // Mark as read
      await this.storage.updateNotification(notificationId, {
        isRead: true,
        readAt: new Date()
      });
      
      logger.info({
        message: `Notification ${notificationId} marked as read by user ${userId}`,
        category: "notification",
        userId,
        source: "internal"
      });
      
      return true;
    } catch (error) {
      logger.error({
        message: `Error marking notification as read: ${error instanceof Error ? error.message : String(error)}`,
        category: "notification",
        userId,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          notificationId
        }
      });
      
      return false;
    }
  }
  
  /**
   * Get notifications for a user
   * @param userId User ID
   * @param limit Limit number of notifications
   * @param offset Offset for pagination
   * @returns Array of notifications
   */
  async getNotificationsForUser(userId: number, limit = 20, offset = 0): Promise<any[]> {
    try {
      // Get notifications from database
      const notifications = await this.storage.getUserNotifications(userId, limit, offset);
      
      return notifications;
    } catch (error) {
      logger.error({
        message: `Error getting notifications for user: ${error instanceof Error ? error.message : String(error)}`,
        category: "notification",
        userId,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          limit,
          offset
        }
      });
      
      return [];
    }
  }
  
  /**
   * Deliver a notification through a specific channel
   * @param notificationId Notification ID
   * @param userId User ID
   * @param channel Channel to deliver through
   * @param data Notification data
   */
  private async deliverThroughChannel(
    notificationId: number,
    userId: number,
    channel: NotificationChannel,
    data: {
      title: string;
      message: string;
      type: NotificationType;
      priority: NotificationPriority;
      metadata?: Record<string, any>;
      actionUrl?: string;
    }
  ): Promise<void> {
    try {
      // Log notification delivery
      logger.info({
        message: `Delivering notification ${notificationId} to user ${userId} via ${channel}`,
        category: "notification",
        userId,
        source: "internal",
        metadata: {
          notificationId,
          channel,
          title: data.title,
          type: data.type
        }
      });
      
      // Handle different channels
      switch (channel) {
        case NotificationChannel.IN_APP:
          // In-app notifications are stored in the database, so no additional action needed
          break;
          
        case NotificationChannel.EMAIL:
          // Here we would integrate with an email service like SendGrid
          // For now, we'll just log it
          logger.info({
            message: `[EMAIL] Would send email to user ${userId}: ${data.title}`,
            category: "notification",
            userId,
            source: "internal"
          });
          break;
          
        case NotificationChannel.SMS:
          // Integrate with Twilio for SMS notifications
          try {
            // Retrieve user info to get phone number
            const user = await this.storage.getUser(userId);
            if (!user || !user.phone) {
              logger.warn({
                message: `Cannot send SMS to user ${userId}: Missing phone number`,
                category: "notification",
                userId,
                source: "twilio",
                metadata: {
                  hasUser: !!user,
                  hasPhone: !!(user && user.phone)
                }
              });
              break;
            }
            
            // Prepare message with title and content
            const smsMessage = `${data.title}: ${data.message}`;
            
            // Send SMS via Twilio service
            const result = await twilioService.sendSMS({
              to: user.phone,
              body: smsMessage
            });
            
            if (result.success) {
              logger.info({
                message: `SMS sent successfully to user ${userId} (${user.phone})`,
                category: "notification",
                userId,
                source: "twilio",
                metadata: {
                  messageId: result.messageId,
                  isSimulated: result.isSimulated
                }
              });
            } else {
              logger.error({
                message: `Failed to send SMS to user ${userId}: ${result.error}`,
                category: "notification",
                userId,
                source: "twilio",
                metadata: {
                  error: result.error,
                  phone: user.phone
                }
              });
            }
          } catch (error) {
            logger.error({
              message: `Error sending SMS notification: ${error instanceof Error ? error.message : String(error)}`,
              category: "notification",
              userId,
              source: "twilio",
              metadata: {
                error: error instanceof Error ? error.stack : String(error)
              }
            });
          }
          break;
          
        case NotificationChannel.PUSH:
          // Here we would integrate with a push notification service
          // For now, we'll just log it
          logger.info({
            message: `[PUSH] Would send push notification to user ${userId}: ${data.title}`,
            category: "notification",
            userId,
            source: "internal"
          });
          break;
          
        default:
          logger.warn({
            message: `Unknown notification channel: ${channel}`,
            category: "notification",
            userId,
            source: "internal"
          });
      }
    } catch (error) {
      logger.error({
        message: `Error delivering notification through ${channel}: ${error instanceof Error ? error.message : String(error)}`,
        category: "notification",
        userId,
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          channel,
          notificationId
        }
      });
    }
  }
}