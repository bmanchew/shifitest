import { NotificationService } from './notification';
import { storage } from '../storage';

// Create service instances
export const notificationService = new NotificationService(storage);