declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      DATABASE_URL: string;
      JWT_SECRET?: string;
      
      // Plaid API settings
      PLAID_CLIENT_ID?: string;
      PLAID_SECRET?: string;
      PLAID_ENVIRONMENT?: 'sandbox' | 'development' | 'production';
      PLAID_WEBHOOK_URL?: string;
      
      // Stripe API settings
      STRIPE_SECRET_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
      STRIPE_PUBLISHABLE_KEY?: string;
      
      // Twilio API settings
      TWILIO_ACCOUNT_SID?: string;
      TWILIO_AUTH_TOKEN?: string;
      TWILIO_PHONE_NUMBER?: string;
      
      // SendGrid API settings
      SENDGRID_API_KEY?: string;
      SENDGRID_FROM_EMAIL?: string;
      
      // OpenAI API settings
      OPENAI_API_KEY?: string;
      
      // Replit specific environment variables
      REPL_ID?: string;
      REPL_SLUG?: string;
      REPL_OWNER?: string;
      REPLIT_DEV_DOMAIN?: string;
      PUBLIC_URL?: string;
    }
  }
}

// Export as module
export {};