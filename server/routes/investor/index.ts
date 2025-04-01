import { Router } from 'express';
import { IStorage } from '../../storage';
import { setupAccreditationRoutes } from './accreditation';

export function setupInvestorRoutes(router: Router, storage: IStorage) {
  // Setup accreditation routes
  setupAccreditationRoutes(router, storage);
  
  // Other investor related routes can be added here
}