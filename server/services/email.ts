import sgMail from '@sendgrid/mail';
import { randomUUID } from 'crypto';
import { logger } from './logger';

// Initialize SendGrid with the API key from environment variables
sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

// Email templates types
export enum EmailTemplateType {
  MERCHANT_WELCOME = 'merchant_welcome',
  MERCHANT_PASSWORD_RESET = 'merchant_password_reset',
  CUSTOMER_APPLICATION_RECEIVED = 'customer_application_received',
  CUSTOMER_APPLICATION_APPROVED = 'customer_application_approved',
  CUSTOMER_APPLICATION_REJECTED = 'customer_application_rejected',
  PAYMENT_REMINDER = 'payment_reminder',
  PAYMENT_RECEIVED = 'payment_received',
  CONTRACT_SIGNED = 'contract_signed',
}

// Basic email interface
interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
  text?: string;
}

// Default sender email from environment variables
const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL as string;

/**
 * EmailService - Handles all email communications
 */
export class EmailService {
  /**
   * Send an email using SendGrid
   */
  async sendEmail(emailData: EmailData): Promise<boolean> {
    const requestId = randomUUID().substring(0, 8);
    
    try {
      // Ensure we have a from email address
      const email = {
        ...emailData,
        from: emailData.from || DEFAULT_FROM_EMAIL,
      };

      // Send the email through SendGrid
      await sgMail.send(email);
      
      // Log the successful email send
      await logger.info({
        message: `Email sent successfully to ${email.to}`,
        category: 'system',
        source: 'internal',
        requestId,
        metadata: { 
          emailType: email.subject,
          to: email.to,
          template: email.subject,
          service: 'sendgrid'
        }
      });
      
      return true;
    } catch (error) {
      // Log the error
      await logger.error({
        message: `Failed to send email to ${emailData.to}`,
        category: 'system',
        source: 'internal',
        requestId,
        metadata: { 
          emailType: emailData.subject,
          to: emailData.to,
          errorDetails: error instanceof Error ? error.message : String(error),
          service: 'sendgrid'
        }
      });
      
      return false;
    }
  }

  /**
   * Send merchant welcome email with credentials
   */
  async sendMerchantWelcome(merchantEmail: string, merchantName: string, temporaryPassword: string): Promise<boolean> {
    const subject = 'Welcome to ShiFi - Your Merchant Account is Ready';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome to ShiFi!</h1>
        
        <p>Hello ${merchantName},</p>
        
        <p>Your merchant account has been successfully created. You can now log in to the ShiFi platform to offer installment payment options to your customers.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Your login credentials:</strong></p>
          <p>Email: ${merchantEmail}</p>
          <p>Temporary Password: ${temporaryPassword}</p>
        </div>
        
        <p><strong>Important:</strong> For security reasons, you'll be asked to change your password on your first login.</p>
        
        <a href="https://shifi.ai/login" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Log In Now</a>
        
        <p style="margin-top: 30px;">If you have any questions, please contact our support team at support@shifi.ai.</p>
        
        <p>Best regards,<br>The ShiFi Team</p>
      </div>
    `;
    
    const text = `
      Welcome to ShiFi!
      
      Hello ${merchantName},
      
      Your merchant account has been successfully created. You can now log in to the ShiFi platform to offer installment payment options to your customers.
      
      Your login credentials:
      Email: ${merchantEmail}
      Temporary Password: ${temporaryPassword}
      
      Important: For security reasons, you'll be asked to change your password on your first login.
      
      Log in at: https://shifi.ai/login
      
      If you have any questions, please contact our support team at support@shifi.ai.
      
      Best regards,
      The ShiFi Team
    `;
    
    return this.sendEmail({
      to: merchantEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Send password reset email to merchant
   */
  async sendPasswordReset(userEmail: string, userName: string, resetToken: string): Promise<boolean> {
    const subject = 'ShiFi - Password Reset Request';
    const resetLink = `https://shifi.ai/reset-password?token=${resetToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Password Reset Request</h1>
        
        <p>Hello ${userName},</p>
        
        <p>We received a request to reset your ShiFi account password. Click the button below to reset your password:</p>
        
        <a href="${resetLink}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
        
        <p>If you didn't request a password reset, please ignore this email or contact our support team at support@shifi.ai.</p>
        
        <p>This password reset link is valid for 24 hours.</p>
        
        <p>Best regards,<br>The ShiFi Team</p>
      </div>
    `;
    
    const text = `
      Password Reset Request
      
      Hello ${userName},
      
      We received a request to reset your ShiFi account password. 
      
      To reset your password, please visit:
      ${resetLink}
      
      If you didn't request a password reset, please ignore this email or contact our support team at support@shifi.ai.
      
      This password reset link is valid for 24 hours.
      
      Best regards,
      The ShiFi Team
    `;
    
    return this.sendEmail({
      to: userEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Send payment reminder to customer
   */
  async sendPaymentReminder(customerEmail: string, customerName: string, amount: number, dueDate: string, contractNumber: string): Promise<boolean> {
    const subject = 'ShiFi - Payment Reminder';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Payment Reminder</h1>
        
        <p>Hello ${customerName},</p>
        
        <p>This is a friendly reminder that your payment of $${amount.toFixed(2)} for contract #${contractNumber} is due on ${dueDate}.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Payment details:</strong></p>
          <p>Amount: $${amount.toFixed(2)}</p>
          <p>Due Date: ${dueDate}</p>
          <p>Contract #: ${contractNumber}</p>
        </div>
        
        <a href="https://shifi.ai/customer/payments" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Make Payment</a>
        
        <p style="margin-top: 30px;">If you have already made this payment, please disregard this message.</p>
        
        <p>If you have any questions, please contact our support team at support@shifi.ai.</p>
        
        <p>Best regards,<br>The ShiFi Team</p>
      </div>
    `;
    
    const text = `
      Payment Reminder
      
      Hello ${customerName},
      
      This is a friendly reminder that your payment of $${amount.toFixed(2)} for contract #${contractNumber} is due on ${dueDate}.
      
      Payment details:
      Amount: $${amount.toFixed(2)}
      Due Date: ${dueDate}
      Contract #: ${contractNumber}
      
      To make a payment, visit: https://shifi.ai/customer/payments
      
      If you have already made this payment, please disregard this message.
      
      If you have any questions, please contact our support team at support@shifi.ai.
      
      Best regards,
      The ShiFi Team
    `;
    
    return this.sendEmail({
      to: customerEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Send application received confirmation to customer
   */
  async sendApplicationReceived(customerEmail: string, customerName: string, merchantName: string): Promise<boolean> {
    const subject = 'Your Financing Application Received';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Application Received</h1>
        
        <p>Hello ${customerName},</p>
        
        <p>Thank you for applying for financing through ${merchantName}. We have received your application and it is currently being reviewed.</p>
        
        <p>Our team will process your application as quickly as possible. You can expect to hear back from us within 1-2 business days.</p>
        
        <p>You will receive an email notification once a decision has been made.</p>
        
        <p style="margin-top: 30px;">If you have any questions, please contact our support team at support@shifi.ai.</p>
        
        <p>Best regards,<br>The ShiFi Team</p>
      </div>
    `;
    
    const text = `
      Application Received
      
      Hello ${customerName},
      
      Thank you for applying for financing through ${merchantName}. We have received your application and it is currently being reviewed.
      
      Our team will process your application as quickly as possible. You can expect to hear back from us within 1-2 business days.
      
      You will receive an email notification once a decision has been made.
      
      If you have any questions, please contact our support team at support@shifi.ai.
      
      Best regards,
      The ShiFi Team
    `;
    
    return this.sendEmail({
      to: customerEmail,
      subject,
      html,
      text
    });
  }
}

// Create singleton instance
const emailService = new EmailService();
export default emailService;