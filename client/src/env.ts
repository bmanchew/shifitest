/**
 * Environment configuration for the application
 * This module handles parsing and providing environment variables with proper defaults
 */

// Get the Replit ID from env vars or fall back to extracting it from hostname if running in the browser
const getReplitId = (): string => {
  if (import.meta.env.VITE_REPLIT_ID) {
    return import.meta.env.VITE_REPLIT_ID;
  }
  
  // When running in the browser, extract Replit ID from hostname if possible
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Extract Replit ID from hostname (first part of the subdomain)
    const match = hostname.match(/^([^.]+)/);
    if (match) {
      return match[1];
    }
  }
  
  return '';
};

// Check if we're in a Replit development environment
// Janeway domains contain "janeway.replit.dev" so we should detect them
const useReplitDev = import.meta.env.VITE_USE_REPLIT_DEV === 'true' || 
  (typeof window !== 'undefined' && window.location.hostname.includes('janeway.replit.dev'));

// Build the base domain
const getReplitDomain = (): string => {
  // Always prefer the current origin when in browser
  if (typeof window !== 'undefined') {
    // Check if we're in a Janeway environment
    if (window.location.hostname.includes('janeway.replit.dev')) {
      return window.location.origin;
    }
  }
  
  const replitId = getReplitId();
  if (!replitId) {
    // Fall back to current hostname if we can't determine the domain
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }
  
  // Force .replit.dev domain if specified and not in Janeway
  if (useReplitDev) {
    return `https://${replitId}.replit.dev`;
  }
  
  // Fall back to current hostname
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  return '';
};

// Explicitly provided domain from env vars or built from Replit ID
export const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || getReplitDomain();

// API URL from env vars or built from APP_DOMAIN
export const API_URL = import.meta.env.VITE_API_URL || `${APP_DOMAIN}/api`;

// Log the configuration in development
if (import.meta.env.DEV) {
  console.log('Environment configuration:', {
    REPLIT_ID: getReplitId(),
    APP_DOMAIN,
    API_URL,
    useReplitDev
  });
}