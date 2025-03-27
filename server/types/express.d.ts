// Type augmentation for Express Request
import express from 'express';

declare global {
  namespace Express {
    interface Request {
      csrfToken(): string;
      user?: {
        id: number;
        role: string;
        email: string;
      };
    }
  }
}