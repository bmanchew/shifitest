import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface FinancingCalculatorProps {
  amount: number;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function FinancingCalculator({
  amount,
  open,
  onClose,
  onConfirm,
}: FinancingCalculatorProps) {
  // Default values
  const [downPaymentPercent] = useState(15); // 15% down payment
  const [termMonths] = useState(24); // 24 month term
  const [interestRate] = useState(0); // 0% interest rate
  
  const [downPayment, setDownPayment] = useState(0);
  const [financedAmount, setFinancedAmount] = useState(0);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  
  // Calculate loan details whenever amount changes
  useEffect(() => {
    if (amount > 0) {
      const calculatedDownPayment = amount * (downPaymentPercent / 100);
      const calculatedFinancedAmount = amount - calculatedDownPayment;
      
      // For 0% interest, just divide by term
      const calculatedMonthlyPayment = calculatedFinancedAmount / termMonths;
      
      setDownPayment(calculatedDownPayment);
      setFinancedAmount(calculatedFinancedAmount);
      setMonthlyPayment(calculatedMonthlyPayment);
    }
  }, [amount, downPaymentPercent, termMonths, interestRate]);
  
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Financing Calculator</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 my-4">
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Purchase Amount</span>
              <span className="font-medium">{formatCurrency(amount)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Down Payment ({downPaymentPercent}%)</span>
              <span className="font-medium">{formatCurrency(downPayment)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Financed Amount</span>
              <span className="font-medium">{formatCurrency(financedAmount)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Term</span>
              <span className="font-medium">{termMonths} months</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Interest Rate</span>
              <span className="font-medium">{interestRate}%</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
              <span className="font-medium">Monthly Payment</span>
              <span className="font-medium">{formatCurrency(monthlyPayment)}</span>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>
              Your customer will be offered a {termMonths}-month financing option 
              with {interestRate}% interest and a {downPaymentPercent}% down payment.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Send Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}