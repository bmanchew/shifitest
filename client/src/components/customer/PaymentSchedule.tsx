
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

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

// Wrapper component to provide Stripe context
export default function PaymentSchedule(props: PaymentScheduleProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentScheduleContent {...props} />
    </Elements>
  );
}

function PaymentScheduleContent({
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
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  
  const stripe = useStripe();
  const elements = useElements();
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

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
          setActualProgressId(paymentStep.id);
        } else {
          // Create a new payment progress record if it doesn't exist
          const newProgress = await apiRequest("POST", "/api/application-progress", {
            contractId,
            step: "payment",
            completed: false,
          });
          setActualProgressId(newProgress.id);
        }
      } catch (error) {
        console.error("Error fetching payment progress:", error);
        toast({
          title: "Error",
          description: "Failed to load payment information. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentProgress();
  }, [contractId, actualProgressId, toast]);

  const confirmSchedule = async () => {
    setShowPaymentForm(true);
  };

  const handlePayment = async () => {
    if (!stripe || !elements) {
      // Stripe.js has not loaded yet
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      return;
    }

    try {
      setPaymentProcessing(true);
      setCardError(null);
      
      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contractId,
          amount: downPayment
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }
      
      const { clientSecret } = await response.json();
      
      // Confirm the payment
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: 'Customer' // Ideally this would be the customer's actual name
          }
        }
      });

      if (result.error) {
        throw result.error;
      }

      if (result.paymentIntent?.status === 'succeeded') {
        // Payment successful, update progress and move to next step
        if (actualProgressId) {
          await apiRequest("PATCH", `/api/application-progress/${actualProgressId}`, {
            completed: true,
            data: JSON.stringify({
              paymentIntentId: result.paymentIntent.id,
              amount: downPayment,
              status: result.paymentIntent.status,
              completedAt: new Date().toISOString()
            })
          });
        }

        toast({
          title: "Payment successful",
          description: "Your down payment has been processed successfully."
        });

        onComplete();
      }
    } catch (error) {
      console.error('Payment error:', error);
      setCardError(error instanceof Error ? error.message : 'An unknown error occurred');
      toast({
        title: "Payment failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading payment schedule...</div>;
  }

  return (
    <div className="space-y-6">
      {!showPaymentForm ? (
        <>
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Payment Schedule</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="font-semibold">Total Purchase Amount:</div>
                <div>{formatCurrency(amount)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="font-semibold">Down Payment:</div>
                <div>{formatCurrency(downPayment)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="font-semibold">Amount Financed:</div>
                <div>{formatCurrency(financedAmount)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="font-semibold">Payment Term:</div>
                <div>{termMonths} months</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="font-semibold">Monthly Payment:</div>
                <div>{formatCurrency(monthlyPayment)}</div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Payment Schedule Overview</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your first payment of {formatCurrency(downPayment)} is due today as a down payment.
                This will be charged to your card after confirmation.
              </p>
              <p className="text-sm text-gray-600 mb-4">
                The remaining balance of {formatCurrency(financedAmount)} will be paid in {termMonths} monthly
                installments of {formatCurrency(monthlyPayment)} each.
              </p>
              <p className="text-sm text-gray-600">
                Your first monthly payment will be due 30 days from today, with
                subsequent payments due on the same day each month thereafter.
              </p>
            </div>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack} disabled={isConfirming}>
              Back
            </Button>
            <Button
              onClick={confirmSchedule}
              disabled={isConfirming}
            >
              {isConfirming ? "Confirming..." : "Confirm & Proceed to Payment"}
            </Button>
          </div>
        </>
      ) : (
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Down Payment</h2>
          <p className="mb-4">Please complete your down payment of {formatCurrency(downPayment)} to proceed.</p>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Card Information</label>
            <div className="p-3 border rounded-md">
              <CardElement 
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                    invalid: {
                      color: '#9e2146',
                    },
                  },
                }}
              />
            </div>
            {cardError && <p className="text-red-600 text-sm mt-2">{cardError}</p>}
          </div>
          
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setShowPaymentForm(false)} disabled={paymentProcessing}>
              Back
            </Button>
            <Button onClick={handlePayment} disabled={paymentProcessing || !stripe || !elements}>
              {paymentProcessing ? "Processing..." : `Pay ${formatCurrency(downPayment)}`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
