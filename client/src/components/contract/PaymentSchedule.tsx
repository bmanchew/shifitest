import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, addMonths } from "date-fns";

interface PaymentScheduleProps {
  amount?: number;
  downPayment?: number;
  termMonths?: number;
  interestRate?: number;
  contractId?: number;
}

export default function PaymentSchedule({
  amount = 0,
  downPayment = 0,
  termMonths = 12,
  interestRate = 0,
  contractId
}: PaymentScheduleProps) {
  const [payments, setPayments] = useState<any[]>([]);
  
  // Format currency for display
  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  useEffect(() => {
    // Calculate the payment schedule
    const financedAmount = amount - downPayment;
    const monthlyInterestRate = interestRate / 100 / 12;
    const monthlyPayment = financedAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, termMonths)) / 
                           (Math.pow(1 + monthlyInterestRate, termMonths) - 1);
    
    // If no interest rate, simply divide the financed amount by the term
    const calculatedMonthlyPayment = interestRate ? monthlyPayment : financedAmount / termMonths;
    
    // Generate payment schedule
    const payments = [];
    let remainingPrincipal = financedAmount;
    const startDate = new Date();
    
    // Add down payment as payment 0
    payments.push({
      date: new Date(),
      paymentNumber: 0,
      description: "Down Payment",
      amount: downPayment,
      principal: 0,
      interest: 0,
      remainingBalance: financedAmount
    });
    
    // Generate monthly payments
    for (let i = 1; i <= termMonths; i++) {
      const paymentDate = addMonths(startDate, i);
      const interestPayment = interestRate ? remainingPrincipal * monthlyInterestRate : 0;
      const principalPayment = calculatedMonthlyPayment - interestPayment;
      remainingPrincipal -= principalPayment;
      
      payments.push({
        date: paymentDate,
        paymentNumber: i,
        description: `Payment ${i}`,
        amount: calculatedMonthlyPayment,
        principal: principalPayment,
        interest: interestPayment,
        remainingBalance: remainingPrincipal > 0 ? remainingPrincipal : 0
      });
    }
    
    setPayments(payments);
  }, [amount, downPayment, termMonths, interestRate]);

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-md">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Purchase Amount</p>
            <p className="font-medium">{formatCurrency(amount)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Down Payment</p>
            <p className="font-medium">{formatCurrency(downPayment)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Financed Amount</p>
            <p className="font-medium">{formatCurrency(amount - downPayment)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Monthly Payment</p>
            <p className="font-medium">{formatCurrency(payments[1]?.amount)}</p>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Payment</TableHead>
              <TableHead className="text-right">Principal</TableHead>
              <TableHead className="text-right">Interest</TableHead>
              <TableHead className="text-right">Remaining Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment, index) => (
              <TableRow key={index}>
                <TableCell>{payment.paymentNumber}</TableCell>
                <TableCell>{format(payment.date, "MMM d, yyyy")}</TableCell>
                <TableCell>{payment.description}</TableCell>
                <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(payment.principal)}</TableCell>
                <TableCell className="text-right">{formatCurrency(payment.interest)}</TableCell>
                <TableCell className="text-right">{formatCurrency(payment.remainingBalance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}