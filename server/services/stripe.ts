
import Stripe from 'stripe';
import { logger } from './logger';

export class StripeService {
  private stripe: Stripe;
  private isInitialized = false;

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16'
      });
      this.isInitialized = true;
      logger.info({
        message: 'Stripe service initialized',
        category: 'payment',
        source: 'stripe'
      });
    }
  }

  public createPaymentIntent = async (amount: number, metadata: any) => {
    if (!this.isInitialized) {
      throw new Error('Stripe service not initialized');
    }

    return await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata
    });
  }

  public isStripeInitialized = () => this.isInitialized;
}

export const stripeService = new StripeService();
