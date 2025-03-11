
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Simple in-memory rate limiter
class RateLimiter {
  private requests: Map<string, { count: number, timestamp: number }> = new Map();
  private readonly windowMs: number = 60 * 1000; // 1 minute window
  private readonly maxRequests: number = 100; // 100 requests per minute

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Get client IP or use a fallback
      const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const now = Date.now();
      
      // Get or create record for this IP
      const record = this.requests.get(clientIp) || { count: 0, timestamp: now };
      
      // Reset if window has expired
      if (now - record.timestamp > this.windowMs) {
        record.count = 0;
        record.timestamp = now;
      }
      
      // Increment request count
      record.count++;
      this.requests.set(clientIp, record);
      
      // Check if over limit
      if (record.count > this.maxRequests) {
        logger.warn({
          message: `Rate limit exceeded for ${clientIp}`,
          category: 'security',
          metadata: { 
            ip: clientIp, 
            count: record.count,
            path: req.path
          }
        });
        
        return res.status(429).json({
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil((record.timestamp + this.windowMs - now) / 1000)
        });
      }
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (this.maxRequests - record.count).toString());
      
      next();
    };
  }
  
  // Clean up old entries periodically
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      
      for (const [ip, record] of this.requests.entries()) {
        if (now - record.timestamp > this.windowMs) {
          this.requests.delete(ip);
        }
      }
    }, this.windowMs);
  }
}

export const rateLimiter = new RateLimiter();
