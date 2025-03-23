import { NotificationService } from './notification';
import { NLPearlService } from './nlpearl';
import { storage } from '../storage';

// Create service instances
export const notificationService = new NotificationService(storage);
export const nlpearlService = new NLPearlService();
// Export all services
export { aiAnalyticsService } from './aiAnalytics';
export { merchantAnalyticsService } from './merchantAnalytics';
