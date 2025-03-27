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
    }
  }
}