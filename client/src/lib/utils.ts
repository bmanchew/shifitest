import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function calculateMonthlyPayment(principal: number, termMonths: number, interestRate: number): number {
  // For 0% interest, it's just principal divided by term
  if (interestRate === 0) {
    return principal / termMonths;
  }
  
  // Convert annual interest rate to monthly and decimal
  const monthlyRate = interestRate / 100 / 12;
  
  // Use the loan payment formula: P * (r(1+r)^n) / ((1+r)^n - 1)
  const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
                  (Math.pow(1 + monthlyRate, termMonths) - 1);
  
  return payment;
}

export function calculateDownPayment(amount: number, downPaymentPercent: number): number {
  return amount * (downPaymentPercent / 100);
}

export function calculateFinancedAmount(amount: number, downPayment: number): number {
  return amount - downPayment;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

// This would be replaced with a real unique ID generator in production
export function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Function to truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}
