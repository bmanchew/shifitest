import { Express } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        firstName: string | null;
        lastName: string | null;
        role: "admin" | "merchant" | "customer" | "sales_rep";
        phone: string | null;
        emailVerified?: boolean;
      };
      
      // Merchant record when the authenticated user is a merchant
      merchant?: {
        id: number;
        name: string;
        contactName: string;
        email: string;
        phone: string;
        address?: string;
        active?: boolean;
        archived?: boolean;
        createdAt?: Date | string;
        userId?: number;
      };
    }
  }
}