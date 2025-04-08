import { Merchant } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
        iat?: number;
        exp?: number;
      };
      merchant?: Merchant;
      merchantId?: number;
    }
  }
}

export {};