/**
 * Simple test script for directly calling the email service
 * without going through the regular API
 */

// Import the @sendgrid/mail module
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Function to send an investor welcome email
async function sendInvestorWelcome(investorEmail, investorName, temporaryPassword) {
  const subject = 'Welcome to ShiFi - Your Investor Account is Ready';
  const baseUrl = getAppBaseUrl();
  const loginLink = `${baseUrl}/investor/login`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Welcome to ShiFi Investor Portal!</h1>

      <p>Hello ${investorName},</p>

      <p>Your investor account application has been approved! You can now log in to the ShiFi Investor Portal to view investment opportunities and manage your portfolio.</p>

      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Your login credentials:</strong></p>
        <p>Email: ${investorEmail}</p>
        <p>Temporary Password: ${temporaryPassword}</p>
      </div>

      <p><strong>Important:</strong> For security reasons, you'll be asked to change your password on your first login.</p>

      <a href="${loginLink}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Log In Now</a>

      <p style="margin-top: 30px;">If you have any questions, please contact our investor relations team at investors@shifi.ai.</p>

      <p>Best regards,<br>The ShiFi Investment Team</p>
    </div>
  `;

  const text = `
    Welcome to ShiFi Investor Portal!

    Hello ${investorName},

    Your investor account application has been approved! You can now log in to the ShiFi Investor Portal to view investment opportunities and manage your portfolio.

    Your login credentials:
    Email: ${investorEmail}
    Temporary Password: ${temporaryPassword}

    Important: For security reasons, you'll be asked to change your password on your first login.

    Log in at: ${loginLink}

    If you have any questions, please contact our investor relations team at investors@shifi.ai.

    Best regards,
    The ShiFi Investment Team
  `;

  // Use the SendGrid verified sender from environment variables or a default
  const senderEmail = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@shifi.ai';
  console.log(`Using sender email: ${senderEmail}`);
  
  const email = {
    to: investorEmail,
    from: senderEmail,
    subject,
    html,
    text
  };

  try {
    await sgMail.send(email);
    console.log(`Email sent to ${investorEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error(error.response.body);
    }
    return false;
  }
}

function getAppBaseUrl() {
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

// Run the test with a sample investor
const investorEmail = 'test.investor@example.com'; // Replace with an actual email to test
const investorName = 'Test Investor';
const temporaryPassword = 'testpass123'; // In a real app, this would be generated securely

console.log(`Sending welcome email to ${investorName} <${investorEmail}> with password: ${temporaryPassword}`);
console.log(`Using base URL: ${getAppBaseUrl()}`);

sendInvestorWelcome(investorEmail, investorName, temporaryPassword)
  .then(result => {
    console.log(`Email sending ${result ? 'succeeded' : 'failed'}`);
  })
  .catch(err => {
    console.error('Error in test:', err);
  });