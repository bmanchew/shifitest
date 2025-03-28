import sgMail from '@sendgrid/mail';
import { randomUUID } from 'crypto';
import { logger } from './logger';

// Initialize SendGrid with the API key from environment variables
try {
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.startsWith('SG.')) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('SendGrid API initialized successfully');
  } else {
    console.log('SendGrid API key not set or invalid (should start with "SG."). Email sending will be disabled.');
  }
} catch (error) {
  console.error('Error initializing SendGrid:', error);
}

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
  CUSTOMER_MAGIC_LINK = 'customer_magic_link',
}

// Basic email interface
interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
  text?: string;
}

const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL as string || 'noreply@example.com';

/**
 * EmailService - Handles all email communications
 */
export class EmailService {
  /**
   * Send an email using SendGrid
   */
  async sendEmail(emailData: EmailData): Promise<boolean> {
    const requestId = randomUUID().substring(0, 8);

    // Skip sending if SendGrid is not properly initialized
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_API_KEY.startsWith('SG.')) {
      console.log(`Email sending skipped (SendGrid not configured) - would have sent to: ${emailData.to}, subject: ${emailData.subject}`);
      return false;
    }

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
   * Get the application base URL
   * This method uses environment variables to determine the correct app URL
   */
  private getAppBaseUrl(): string {
    // Check for PUBLIC_URL, but verify it doesn't look like an API webhook URL
    if (process.env.PUBLIC_URL && !process.env.PUBLIC_URL.includes('/api/')) {
      return process.env.PUBLIC_URL;
    }
    
    // If we have a REPLIT_DOMAINS variable (preferred in newer Replit instances), use the first one
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',');
      return `https://${domains[0].trim()}`;
    }
    
    // If we have a REPLIT_DEV_DOMAIN, use that
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    
    // If we have a REPL_ID, construct the URL
    if (process.env.REPL_ID) {
      return `https://${process.env.REPL_ID}.replit.dev`;
    }
    
    // Fallback to our default domain
    return 'https://shifi.ai';
  }

  /**
   * Send merchant welcome email with credentials
   */
  async sendMerchantWelcome(merchantEmail: string, merchantName: string, temporaryPassword: string): Promise<boolean> {
    const subject = 'Welcome to ShiFi - Your Merchant Account is Ready';
    const baseUrl = this.getAppBaseUrl();
    const loginLink = `${baseUrl}/login`;

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

        <a href="${loginLink}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Log In Now</a>

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

      Log in at: ${loginLink}

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
  async sendMerchantPasswordReset(merchantEmail: string, merchantName: string, resetToken: string): Promise<boolean> {
    const subject = 'ShiFi - Password Reset Instructions';
    const baseUrl = this.getAppBaseUrl();
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Password Reset Instructions</h1>

        <p>Hello ${merchantName},</p>

        <p>An administrator has requested a password reset for your ShiFi merchant account. Click the button below to set a new password:</p>

        <a href="${resetLink}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>

        <p>If you didn't expect this password reset, please contact our support team at support@shifi.ai.</p>

        <p>This password reset link will expire in 24 hours.</p>

        <p>Best regards,<br>The ShiFi Team</p>
      </div>
    `;

    const text = `
      Password Reset Instructions

      Hello ${merchantName},

      An administrator has requested a password reset for your ShiFi merchant account.
      To set a new password, please visit: ${resetLink}

      If you didn't expect this password reset, please contact our support team at support@shifi.ai.

      This password reset link will expire in 24 hours.

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
    const baseUrl = this.getAppBaseUrl();
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

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
    const baseUrl = this.getAppBaseUrl();
    const paymentLink = `${baseUrl}/customer/payments`;

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

        <a href="${paymentLink}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Make Payment</a>

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

      To make a payment, visit: ${paymentLink}

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

  /**
   * Send magic link for passwordless login
   */
  async sendMagicLink(userEmail: string, userName: string, token: string): Promise<boolean> {
    const subject = 'ShiFi - Magic Link to Sign In';
    const baseUrl = this.getAppBaseUrl();
    const loginLink = `${baseUrl}/login/magic?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Sign in to ShiFi</h1>

        <p>Hello ${userName},</p>

        <p>You requested a magic link to sign in to your ShiFi account. Click the button below to securely sign in:</p>

        <a href="${loginLink}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Sign In to ShiFi</a>

        <p>This link will expire in 15 minutes and can only be used once.</p>

        <p>If you didn't request this login link, please ignore this email. No action is needed.</p>

        <p>Best regards,<br>The ShiFi Team</p>
      </div>
    `;

    const text = `
      Sign in to ShiFi

      Hello ${userName},

      You requested a magic link to sign in to your ShiFi account. Use the link below to securely sign in:

      ${loginLink}

      This link will expire in 15 minutes and can only be used once.

      If you didn't request this login link, please ignore this email. No action is needed.

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
}

// Create singleton instance
const emailService = new EmailService();
export default emailService;