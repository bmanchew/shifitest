
export * from './logger';
export * from './twilio';
export * from './didit';
export * from './thanksroger';
export * from './plaid';
export * from './prefi';
export * from './nlpearl';
export * from './notification';
export * from './merchantAnalytics';
export * from './salesRepAnalytics';
export * from './sesameai';
export * from './middesk';
export * from './email';

import { NotificationService } from './notification';
import { NLPearlService } from './nlpearl';
import { storage } from '../storage';

// Create service instances
export const notificationService = new NotificationService(storage);
export const nlpearlService = new NLPearlService();
// Export all services
export { aiAnalyticsService } from './aiAnalytics';
export { merchantAnalyticsService } from './merchantAnalytics';
export { openaiService } from './openai';
export { salesRepAnalyticsService } from './salesRepAnalytics';
export { blockchainService } from './blockchain';
export { sesameAIService } from './sesameai';
export { middeskService } from './middesk';
export { default as emailService } from './email';
