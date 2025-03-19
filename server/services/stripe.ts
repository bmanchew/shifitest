
import Stripe from 'stripe';
import { logger } from './logger';

export class StripeService {
  private stripe: Stripe;
  private isInitialized = false;

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      logger.warn({
        message: 'Stripe service not initialized - missing secret key',
        category: 'payment',
        source: 'stripe'
      });
      return;
    }

    try {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16'
      });
      this.isInitialized = true;
      logger.info({
        message: 'Stripe service initialized',
        category: 'payment',
        source: 'stripe'
      });
    } catch (error) {
      logger.error({
        message: `Failed to initialize Stripe: ${error instanceof Error ? error.message : String(error)}`,
        category: 'payment',
        source: 'stripe',
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
    }
  }

  public createPaymentIntent = async (amount: number, metadata: any) => {
    if (!this.isInitialized) {
      throw new Error('Stripe service not initialized');
    }

    try {
      return await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata
      });
    } catch (error) {
      logger.error({
        message: `Failed to create payment intent: ${error instanceof Error ? error.message : String(error)}`,
        category: 'payment',
        source: 'stripe',
        metadata: {
          amount,
          error: error instanceof Error ? error.stack : null
        }
      });
      throw error;
    }
  }

  public isStripeInitialized = () => this.isInitialized;
}

export const stripeService = new StripeService();
