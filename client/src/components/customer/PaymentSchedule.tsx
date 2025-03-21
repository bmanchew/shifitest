import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, addMonths } from "date-fns";
import { CalendarDays, Check } from "lucide-react";

interface PaymentScheduleProps {
  contractId: number;
  progressId: number;
  amount: number;
  downPayment: number;
  financedAmount: number;
  termMonths: number;
  monthlyPayment: number;
  onComplete: () => void;
  onBack: () => void;
}

export default function PaymentSchedule({
  contractId,
  progressId,
  amount,
  downPayment,
  financedAmount,
  termMonths,
  monthlyPayment,
  onComplete,
  onBack,
}: PaymentScheduleProps) {
  const { toast } = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const [actualProgressId, setActualProgressId] = useState<number | null>(
    progressId > 0 ? progressId : null,
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load the correct progress ID when component mounts
  useEffect(() => {
    const fetchPaymentProgress = async () => {
      if (actualProgressId) {
        setIsLoading(false);
        return; // Already have a valid ID
      }

      try {
        setIsLoading(true);

        // Get all application progress items for this contract
        const progressItems = await apiRequest<any[]>(
          "GET",
          `/api/application-progress?contractId=${contractId}`,
        );

        // Find the payment step
        const paymentStep = progressItems?.find(
          (item) => item.step === "payment",
        );

        if (paymentStep) {
          console.log("Found existing payment step:", paymentStep.id);
          setActualProgressId(paymentStep.id);
        } else {
          console.log("No payment step found, will create one on confirm");
        }
      } catch (error) {
        console.error("Error fetching payment progress:", error);
        toast({
          title: "Error",
          description: "Could not load payment information. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentProgress();
  }, [contractId, actualProgressId, toast]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  // Generate payment schedule
  const startDate = new Date();
  const paymentSchedule = Array.from({ length: termMonths }, (_, i) => ({
    paymentNumber: i + 1,
    dueDate: addMonths(startDate, i + 1),
    amount: monthlyPayment,
  }));

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);

      const scheduleData = {
        schedule: paymentSchedule,
        confirmedAt: new Date().toISOString(),
      };

      if (actualProgressId) {
        // Update existing progress item
        console.log("Updating payment progress:", actualProgressId);
        await apiRequest(
          "PATCH",
          `/api/application-progress/${actualProgressId}`,
          {
            completed: true,
            data: JSON.stringify(scheduleData),
          },
        );
      } else {
        // Create new payment progress item
        console.log("Creating new payment progress for contract:", contractId);
        // Fixed: Don't call .json() on the response since apiRequest already returns the parsed JSON
        const newProgress = await apiRequest<{ id: number }>(
          "POST",
          "/api/application-progress",
          {
            contractId: contractId,
            step: "payment",
            completed: true,
            data: JSON.stringify(scheduleData),
          },
        );
        setActualProgressId(newProgress.id);
      }

      toast({
        title: "Schedule Confirmed",
        description: "Your payment schedule has been confirmed.",
      });

      onComplete();
    } catch (error) {
      console.error("Payment schedule confirmation failed:", error);
      toast({
        title: "Confirmation Failed",
        description:
          "Unable to confirm the payment schedule. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="py-12">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-sm text-gray-600">Loading payment schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Payment Schedule
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Review and confirm your payment schedule for the financing contract.
      </p>

      <div className="rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex justify-between mb-3">
          <span className="text-sm text-gray-500">Purchase Amount</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(amount)}
          </span>
        </div>
        <div className="flex justify-between mb-3">
          <span className="text-sm text-gray-500">Down Payment (15%)</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(downPayment)}
          </span>
        </div>
        <div className="flex justify-between pt-3 border-t border-gray-200">
          <span className="text-sm font-medium text-gray-900">
            Financed Amount
          </span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(financedAmount)}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">
          Payment Details
        </h4>
        <div className="bg-gray-50 rounded-lg p-4 flex flex-col sm:flex-row sm:justify-between">
          <div className="mb-3 sm:mb-0">
            <p className="text-xs text-gray-500">Monthly Payment</p>
            <p className="text-lg font-medium text-gray-900">
              {formatCurrency(monthlyPayment)}
            </p>
          </div>
          <div className="mb-3 sm:mb-0">
            <p className="text-xs text-gray-500">Total Payments</p>
            <p className="text-lg font-medium text-gray-900">{termMonths}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">First Payment Due</p>
            <p className="text-lg font-medium text-gray-900">
              {format(addMonths(startDate, 1), "MMM d, yyyy")}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Schedule</h4>
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2">
            <div className="grid grid-cols-3 text-xs font-medium text-gray-500">
              <div>Payment</div>
              <div>Due Date</div>
              <div className="text-right">Amount</div>
            </div>
          </div>
          <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
            {paymentSchedule.slice(0, 6).map((payment) => (
              <div key={payment.paymentNumber} className="px-4 py-2">
                <div className="grid grid-cols-3 text-sm">
                  <div>{payment.paymentNumber}</div>
                  <div>{format(payment.dueDate, "MMM d, yyyy")}</div>
                  <div className="text-right">
                    {formatCurrency(payment.amount)}
                  </div>
                </div>
              </div>
            ))}
            {paymentSchedule.length > 6 && (
              <div className="px-4 py-2 text-center text-sm text-gray-500">
                + {paymentSchedule.length - 6} more payments
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 mb-6 flex">
        <CalendarDays className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800 mb-1">
            Automatic Payments
          </p>
          <p className="text-sm text-blue-700">
            Payments will be automatically debited from your connected bank
            account on the due dates.
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleConfirm} disabled={isConfirming}>
          {isConfirming ? "Confirming..." : "Confirm Schedule"}
        </Button>
      </div>
    </div>
  );
}
