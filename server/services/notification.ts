// Import existing logger or create a simple one if it doesn't exist
const logger = {
  info: (data: any) => console.info(JSON.stringify(data)),
  error: (data: any) => console.error(JSON.stringify(data)),
  warn: (data: any) => console.warn(JSON.stringify(data)),
  debug: (data: any) => console.debug(JSON.stringify(data))
};

import emailService from './email';
import { twilioService } from './twilio';
import { IStorage } from '../storage';

export type NotificationType = 
  // Merchant notifications
  | 'merchant_welcome'
  | 'merchant_approval'
  | 'merchant_rejection'
  | 'merchant_document_request'
  | 'merchant_revenue_verification_complete'
  
  // Customer notifications
  | 'customer_welcome'
  | 'customer_application_submitted'
  | 'customer_application_approved'
  | 'customer_application_rejected'
  | 'customer_payment_reminder'
  | 'customer_payment_confirmation'
  | 'customer_contract_signed'
  | 'customer_satisfaction_survey' // New notification type for satisfaction surveys
  
  // Admin notifications
  | 'admin_new_merchant'
  | 'admin_document_review'
  | 'admin_contract_review'
  | 'admin_payment_failed'
  | 'admin_high_risk_alert';

export type NotificationChannel = 'email' | 'sms' | 'in_app' | 'webhook';

export interface NotificationOptions {
  recipientId: number;
  recipientType: 'merchant' | 'customer' | 'admin';
  recipientEmail?: string;
  recipientPhone?: string;
  subject?: string;
  message?: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
  metadata?: Record<string, any>;
}

export class NotificationService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Send a notification through one or more channels
   */
  async sendNotification(
    type: NotificationType,
    options: NotificationOptions
  ): Promise<{ success: boolean; error?: string; channels?: string[] }> {
    try {
      // Default to email channel if none specified
      const channels = options.channels || ['email'];
      
      // Log the notification
      await logger.info({
        message: `Sending ${type} notification to ${options.recipientType} (ID: ${options.recipientId})`,
        category: 'notification',
        source: 'internal',
        metadata: {
          notificationType: type,
          recipientId: options.recipientId,
          recipientType: options.recipientType,
          channels
        }
      });

      // Track success across all channels
      let success = true;

      // Store notification record in database
      const notificationId = await this.storage.createNotification({
        recipientId: options.recipientId,
        recipientType: options.recipientType,
        type,
        status: 'pending',
        channels,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null
      });

      // Send through each channel
      for (const channel of channels) {
        try {
          let channelSuccess = false;
          
          switch (channel) {
            case 'email':
              channelSuccess = await this.sendEmailNotification(type, options);
              break;
            case 'sms':
              channelSuccess = await this.sendSmsNotification(type, options);
              break;
            case 'in_app':
              channelSuccess = await this.createInAppNotification(type, options);
              break;
            case 'webhook':
              channelSuccess = await this.sendWebhookNotification(type, options);
              break;
          }
          
          // Update notification status for this channel
          await this.storage.updateNotificationChannel({
            notificationId,
            channel,
            status: channelSuccess ? 'delivered' : 'failed',
            updatedAt: new Date()
          });
          
          // If any channel fails, mark overall success as false
          if (!channelSuccess) {
            success = false;
          }
        } catch (error) {
          // Log channel-specific error
          await logger.error({
            message: `Failed to send ${type} notification via ${channel}: ${error instanceof Error ? error.message : String(error)}`,
            category: 'notification',
            source: 'internal',
            metadata: {
              notificationType: type,
              recipientId: options.recipientId,
              recipientType: options.recipientType,
              channel,
              errorDetails: error instanceof Error ? error.stack : String(error)
            }
          });
          
          // Update notification status for this channel
          await this.storage.updateNotificationChannel({
            notificationId,
            channel,
            status: 'failed',
            updatedAt: new Date()
          });
          
          success = false;
        }
      }

      // Update the overall notification status
      await this.storage.updateNotification({
        id: notificationId,
        status: success ? 'delivered' : 'partial_failure',
        updatedAt: new Date()
      });

      // Get successful channels
      const channelStatus = await this.storage.getNotificationChannels(notificationId);
      const successfulChannels = channels.filter(channel => 
        channelStatus.some(cs => cs.channel === channel && cs.status === 'delivered')
      );

      return {
        success,
        channels: successfulChannels
      };
    } catch (error) {
      // Log the overall notification error
      await logger.error({
        message: `Error sending notification: ${error instanceof Error ? error.message : String(error)}`,
        category: 'notification',
        source: 'internal',
        metadata: {
          notificationType: type,
          recipientId: options.recipientId,
          recipientType: options.recipientType,
          errorDetails: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Send notification via email
   */
  private async sendEmailNotification(
    type: NotificationType,
    options: NotificationOptions
  ): Promise<boolean> {
    // Ensure we have recipient email
    if (!options.recipientEmail) {
      const recipient = await this.getRecipientDetails(options.recipientId, options.recipientType);
      if (!recipient || !recipient.email) {
        throw new Error(`No email address found for ${options.recipientType} ${options.recipientId}`);
      }
      options.recipientEmail = recipient.email;
    }

    const emailData = this.getEmailTemplateData(type, options);
    
    // Build HTML content based on template data
    const html = this.getEmailHtmlContent(type, emailData.templateData);
    
    // Send email
    return await emailService.sendEmail({
      to: options.recipientEmail,
      subject: emailData.subject,
      html
    });
  }
  
  /**
   * Generate HTML content for emails based on notification type and template data
   */
  private getEmailHtmlContent(type: NotificationType, data: Record<string, any>): string {
    // Basic template with consistent styling
    const baseTemplate = (content: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #333;">ShiFi</h1>
        </div>
        <div style="padding: 20px;">
          ${content}
        </div>
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${new Date().getFullYear()} ShiFi. All rights reserved.</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    `;
    
    // Default recipient name
    const recipientName = data.businessName || data.name || 'Valued Customer';
    
    // Generate content based on notification type
    let content = '';
    
    switch (type) {
      case 'merchant_welcome':
        content = `
          <h2>Welcome to ShiFi!</h2>
          <p>Hello ${recipientName},</p>
          <p>Your merchant account has been successfully created. You can now log in to the ShiFi platform to offer installment payment options to your customers.</p>
          <p>Please complete your profile and submit the required documentation to get started.</p>
          <div style="margin: 20px 0; text-align: center;">
            <a href="${data.loginUrl || '#'}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Go to Dashboard</a>
          </div>
        `;
        break;
        
      case 'merchant_document_request':
        content = `
          <h2>Additional Documents Required</h2>
          <p>Hello ${recipientName},</p>
          <p>To complete your application, we need the following documents:</p>
          <ul>
            ${data.documentsList ? data.documentsList.map((doc: string) => `<li>${doc}</li>`).join('') : '<li>Business verification documents</li>'}
          </ul>
          <p>Please upload these documents from your merchant dashboard as soon as possible.</p>
          <div style="margin: 20px 0; text-align: center;">
            <a href="${data.dashboardUrl || '#'}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Upload Documents</a>
          </div>
        `;
        break;
        
      // Additional case statements for other notification types would go here
      // For brevity, only implementing a few examples
        
      default:
        // Default generic template for other notification types
        content = `
          <h2>${data.title || 'Important Notification'}</h2>
          <p>Hello ${recipientName},</p>
          <p>${data.message || 'You have a new notification from ShiFi.'}</p>
          ${data.actionUrl ? `
            <div style="margin: 20px 0; text-align: center;">
              <a href="${data.actionUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">${data.actionText || 'View Details'}</a>
            </div>
          ` : ''}
        `;
    }
    
    return baseTemplate(content);
  }

  /**
   * Send notification via SMS using Twilio
   */
  private async sendSmsNotification(
    type: NotificationType,
    options: NotificationOptions
  ): Promise<boolean> {
    // Ensure we have recipient phone
    if (!options.recipientPhone) {
      const recipient = await this.getRecipientDetails(options.recipientId, options.recipientType);
      if (!recipient || !recipient.phone) {
        throw new Error(`No phone number found for ${options.recipientType} ${options.recipientId}`);
      }
      options.recipientPhone = recipient.phone;
    }

    try {
      // Generate SMS content based on notification type
      const messageBody = options.message || this.getSmsTemplateForType(type, options);
      
      // Send the SMS via Twilio
      const result = await twilioService.sendSMS({
        to: options.recipientPhone,
        body: messageBody
      });
      
      // Log the result
      logger.info({
        message: result.isSimulated 
          ? `SMS simulated to ${options.recipientPhone} for ${type}` 
          : `SMS sent to ${options.recipientPhone} for ${type}`,
        category: 'notification',
        source: 'twilio',
        metadata: {
          notificationType: type,
          recipientId: options.recipientId,
          recipientType: options.recipientType,
          messageId: result.messageId,
          isSimulated: result.isSimulated
        }
      });
      
      return result.success;
    } catch (error) {
      logger.error({
        message: `Failed to send SMS to ${options.recipientPhone}: ${error instanceof Error ? error.message : String(error)}`,
        category: 'notification',
        source: 'twilio',
        metadata: {
          notificationType: type,
          recipientId: options.recipientId,
          recipientType: options.recipientType,
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return false;
    }
  }
  
  /**
   * Generate SMS text based on notification type
   */
  private getSmsTemplateForType(type: NotificationType, options: NotificationOptions): string {
    // Common variables
    const recipientName = options.data?.name || options.data?.businessName || "Customer";
    
    // Generate message based on notification type
    switch (type) {
      case 'merchant_welcome':
        return `Welcome to ShiFi, ${recipientName}! Your merchant account has been created. Please complete your profile to start offering financing to your customers.`;
        
      case 'merchant_approval':
        return `Congratulations ${recipientName}! Your ShiFi merchant account has been approved. You can now start offering financing to your customers.`;
        
      case 'merchant_document_request':
        return `ShiFi needs additional documents to complete your merchant account setup. Please log in to your dashboard to upload them.`;
        
      case 'customer_welcome':
        return `Welcome to ShiFi! Your application for financing has been started. Click the link to complete your application: ${options.data?.applicationUrl || ""}`;
        
      case 'customer_application_submitted':
        return `Thank you! Your ShiFi financing application has been submitted and is being reviewed. We'll notify you of the decision soon.`;
        
      case 'customer_application_approved':
        return `Good news! Your ShiFi financing application has been approved. Log in to view your payment schedule and complete the process.`;
        
      case 'customer_application_rejected':
        return `We've reviewed your ShiFi financing application. Unfortunately, we're unable to approve it at this time. Please contact us for more information.`;
        
      case 'customer_payment_reminder':
        return `Payment reminder: Your ShiFi payment of ${options.data?.paymentAmount || "$0.00"} is due on ${options.data?.dueDate || "the due date"}. Please log in to make your payment.`;
        
      case 'customer_payment_confirmation':
        return `Thank you! Your payment of ${options.data?.paymentAmount || "$0.00"} has been received.`;
        
      case 'customer_contract_signed':
        return `Your financing agreement has been signed and approved. Funds will be disbursed within 1-2 business days.`;
        
      case 'customer_satisfaction_survey':
        const contractNumber = options.data?.contractNumber || "your contract";
        const surveyUrl = options.data?.surveyUrl || "";
        return `ShiFi values your feedback! Please rate your satisfaction with ${contractNumber} on a scale of 1-10 by clicking this link: ${surveyUrl}`;
        
      default:
        // Generic message for other notification types
        return options.data?.message || `You have a new notification from ShiFi.`;
    }
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    type: NotificationType,
    options: NotificationOptions
  ): Promise<boolean> {
    try {
      await this.storage.createInAppNotification({
        userId: options.recipientId,
        userType: options.recipientType,
        type,
        title: options.subject || this.getDefaultTitle(type),
        message: options.message || this.getDefaultMessage(type, options),
        isRead: false,
        metadata: options.data ? JSON.stringify(options.data) : null
      });
      
      return true;
    } catch (error) {
      logger.error({
        message: `Failed to create in-app notification: ${error instanceof Error ? error.message : String(error)}`,
        category: 'notification',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return false;
    }
  }

  /**
   * Send webhook notification (for merchant integrations)
   */
  private async sendWebhookNotification(
    type: NotificationType,
    options: NotificationOptions
  ): Promise<boolean> {
    try {
      // Only merchants can receive webhooks for now
      if (options.recipientType !== 'merchant') {
        logger.info({
          message: `Webhooks are only supported for merchants, not ${options.recipientType}`,
          category: 'notification',
          source: 'internal'
        });
        return false;
      }
      
      // Get merchant information
      const merchant = await this.storage.getMerchant(options.recipientId);
      if (!merchant) {
        logger.info({
          message: `Merchant not found for webhook: ${options.recipientId}`,
          category: 'notification',
          source: 'internal'
        });
        return false;
      }
      
      // Get merchant business details
      const businessDetails = await this.storage.getMerchantBusinessDetailsByMerchantId(merchant.id);
      if (!businessDetails) {
        logger.info({
          message: `Business details not found for merchant: ${merchant.id}`,
          category: 'notification',
          source: 'internal'
        });
        return false;
      }
      
      // Use website URL as webhook endpoint since we don't have a dedicated webhookUrl field yet
      const webhookUrl = businessDetails.websiteUrl;
      
      if (!webhookUrl) {
        logger.info({
          message: `No webhook URL available for merchant: ${merchant.id}`,
          category: 'notification',
          source: 'internal'
        });
        return false;
      }
      
      // TODO: Implement webhook sending logic
      // This is a placeholder for future implementation
      logger.info({
        message: `Webhook would be sent to ${webhookUrl} for ${type}`,
        category: 'notification',
        source: 'internal'
      });
      
      return true; // Placeholder success
    } catch (error) {
      logger.error({
        message: `Webhook notification error: ${error instanceof Error ? error.message : String(error)}`,
        category: 'notification',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return false;
    }
  }

  /**
   * Get recipient details from database
   */
  private async getRecipientDetails(id: number, type: 'merchant' | 'customer' | 'admin'): Promise<{
    email?: string;
    phone?: string;
    name?: string;
  } | null> {
    try {
      switch (type) {
        case 'merchant':
          const merchant = await this.storage.getMerchant(id);
          return merchant ? {
            email: merchant.email,
            phone: merchant.phone || undefined,
            name: merchant.name || merchant.contactName
          } : null;
        
        case 'customer':
          // For now, handle customer as User since we don't have a dedicated customers table
          const customer = await this.storage.getUser(id);
          return customer ? {
            email: customer.email,
            phone: customer.phone || undefined,
            name: customer.firstName && customer.lastName ? 
              `${customer.firstName} ${customer.lastName}` : customer.email
          } : null;
        
        case 'admin':
          const admin = await this.storage.getUser(id);
          return admin ? {
            email: admin.email,
            phone: admin.phone || undefined,
            name: admin.firstName && admin.lastName ? 
              `${admin.firstName} ${admin.lastName}` : admin.email
          } : null;
        
        default:
          return null;
      }
    } catch (error) {
      logger.error({
        message: `Error getting recipient details: ${error instanceof Error ? error.message : String(error)}`,
        category: 'notification',
        source: 'internal'
      });
      
      return null;
    }
  }

  /**
   * Get email template data based on notification type
   */
  private getEmailTemplateData(type: NotificationType, options: NotificationOptions): {
    subject: string;
    templateData: Record<string, any>;
  } {
    // Default template data
    const templateData: Record<string, any> = {
      ...options.data,
    };
    
    // Add recipient name if available
    if (options.recipientType === 'merchant') {
      templateData.businessName = options.data?.businessName || 'Valued Merchant';
    } else {
      templateData.name = options.data?.name || 'Valued Customer';
    }
    
    let subject = '';
    
    // Set subject and template-specific data based on notification type
    switch (type) {
      case 'merchant_welcome':
        subject = 'Welcome to ShiFi Merchant Services!';
        break;
        
      case 'merchant_approval':
        subject = 'Your ShiFi Merchant Account Has Been Approved';
        break;
        
      case 'merchant_rejection':
        subject = 'ShiFi Merchant Application Status';
        break;
        
      case 'merchant_document_request':
        subject = 'Additional Documents Required for Your ShiFi Application';
        break;
        
      case 'merchant_revenue_verification_complete':
        subject = 'Revenue Verification Complete - ShiFi';
        break;
        
      case 'customer_welcome':
        subject = 'Welcome to ShiFi!';
        break;
        
      case 'customer_application_submitted':
        subject = 'Your ShiFi Financing Application Has Been Received';
        break;
        
      case 'customer_application_approved':
        subject = 'Good News! Your ShiFi Financing Has Been Approved';
        break;
        
      case 'customer_application_rejected':
        subject = 'ShiFi Financing Application Status';
        break;
        
      case 'customer_payment_reminder':
        subject = 'Payment Reminder: Your ShiFi Payment is Due Soon';
        break;
        
      case 'customer_payment_confirmation':
        subject = 'Payment Confirmation - ShiFi';
        break;
        
      case 'customer_contract_signed':
        subject = 'Your ShiFi Contract Has Been Signed';
        break;
        
      case 'customer_satisfaction_survey':
        subject = 'Your ShiFi Feedback Is Important to Us';
        break;
        
      // Admin notifications
      case 'admin_new_merchant':
        subject = 'New Merchant Registration on ShiFi';
        break;
        
      case 'admin_document_review':
        subject = 'Merchant Documents Ready for Review';
        break;
        
      case 'admin_contract_review':
        subject = 'New Contract Needs Review';
        break;
        
      case 'admin_payment_failed':
        subject = 'Payment Failure Alert - ShiFi';
        break;
        
      case 'admin_high_risk_alert':
        subject = 'High Risk Alert - ShiFi';
        break;
        
      default:
        subject = 'ShiFi Notification';
    }
    
    // Override with custom subject if provided
    if (options.subject) {
      subject = options.subject;
    }
    
    return {
      subject,
      templateData
    };
  }

  /**
   * Get default title for in-app notifications
   */
  private getDefaultTitle(type: NotificationType): string {
    switch (type) {
      case 'merchant_welcome':
        return 'Welcome to ShiFi!';
      case 'merchant_approval':
        return 'Account Approved';
      case 'merchant_rejection':
        return 'Application Update';
      case 'merchant_document_request':
        return 'Documents Needed';
      case 'merchant_revenue_verification_complete':
        return 'Revenue Verified';
      case 'customer_welcome':
        return 'Welcome to ShiFi!';
      case 'customer_application_submitted':
        return 'Application Received';
      case 'customer_application_approved':
        return 'Application Approved';
      case 'customer_application_rejected':
        return 'Application Update';
      case 'customer_payment_reminder':
        return 'Payment Due Soon';
      case 'customer_payment_confirmation':
        return 'Payment Confirmed';
      case 'customer_contract_signed':
        return 'Contract Signed';
      case 'customer_satisfaction_survey':
        return 'Your Feedback Matters';
      case 'admin_new_merchant':
        return 'New Merchant';
      case 'admin_document_review':
        return 'Documents Need Review';
      case 'admin_contract_review':
        return 'Contract Needs Review';
      case 'admin_payment_failed':
        return 'Payment Failure';
      case 'admin_high_risk_alert':
        return 'High Risk Alert';
      default:
        return 'ShiFi Notification';
    }
  }

  /**
   * Get default message for in-app notifications
   */
  private getDefaultMessage(type: NotificationType, options: NotificationOptions): string {
    // If custom message is provided, use that
    if (options.message) {
      return options.message;
    }
    
    // Otherwise generate default message based on notification type
    switch (type) {
      case 'merchant_welcome':
        return 'Welcome to ShiFi! Your merchant account has been created.';
      case 'merchant_approval':
        return 'Congratulations! Your merchant account has been approved.';
      case 'merchant_rejection':
        return 'We have an update regarding your application.';
      case 'merchant_document_request':
        return 'Please upload the requested documents to continue your application.';
      case 'merchant_revenue_verification_complete':
        return 'Your revenue verification process is complete.';
      case 'customer_welcome':
        return 'Welcome to ShiFi! Your account has been created.';
      case 'customer_application_submitted':
        return 'Your financing application has been submitted successfully.';
      case 'customer_application_approved':
        return 'Great news! Your financing application has been approved.';
      case 'customer_application_rejected':
        return 'We have an update regarding your application.';
      case 'customer_payment_reminder':
        return 'Your payment is due soon. Please ensure your account has sufficient funds.';
      case 'customer_payment_confirmation':
        return 'Your payment has been successfully processed.';
      case 'customer_contract_signed':
        return 'Your contract has been signed and is now active.';
      case 'customer_satisfaction_survey':
        return 'Please take a moment to rate your satisfaction with our services (1-10). Your feedback helps us improve.';
      case 'admin_new_merchant':
        return 'A new merchant has registered and requires review.';
      case 'admin_document_review':
        return 'New merchant documents are available for review.';
      case 'admin_contract_review':
        return 'A new contract requires your review.';
      case 'admin_payment_failed':
        return 'A payment has failed and requires attention.';
      case 'admin_high_risk_alert':
        return 'A high risk alert has been triggered and requires your attention.';
      default:
        return 'You have a new notification.';
    }
  }
}