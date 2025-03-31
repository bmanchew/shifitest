import { Router } from "express";
import { IStorage } from "../../storage";
import { setupAccreditationRoutes } from "./accreditation";

export function setupInvestorRoutes(router: Router, storage: IStorage) {
  // Set up accreditation routes
  setupAccreditationRoutes(router, storage);

  return router;
}