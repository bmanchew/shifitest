import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface FinancingCalculatorProps {
  amount: number;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export default function FinancingCalculator({
  amount,
  onConfirm,
  isSubmitting = false
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
  
  if (amount <= 0) {
    return null;
  }
  
  return (
    <Card className="shadow h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Financing Calculator</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
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
        
        <Button 
          onClick={onConfirm} 
          className="w-full mt-4"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending..." : "Send Application"}
        </Button>
      </CardContent>
    </Card>
  );
}