
import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";

const stripePromise = loadStripe(process.env.STRIPE_PUBLIC_KEY || '');

interface PaymentStepProps {
  contractId: number;
  progressId: number;
  downPayment: number;
  onComplete: () => void;
  onBack: () => void;
}

export default function PaymentStep({
  contractId,
  progressId,
  downPayment,
  onComplete,
  onBack
}: PaymentStepProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    try {
      setIsLoading(true);
      
      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contractId,
          amount: downPayment
        })
      });
      
      const { clientSecret } = await response.json();
      
      // Load Stripe
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to load');

      // Confirm the payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement('card'),
          billing_details: {
            name: 'Customer Name' // You can get this from the contract
          }
        }
      });

      if (error) {
        throw error;
      }

      // Mark the payment step as complete
      await fetch(`/api/application-progress/${progressId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed: true,
          data: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            amount: downPayment,
            status: paymentIntent.status,
            completedAt: new Date().toISOString()
          })
        })
      });

      toast({
        title: "Payment successful",
        description: "Your down payment has been processed successfully."
      });

      onComplete();
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Down Payment</h2>
      <p className="mb-4">Please complete your down payment of ${downPayment.toFixed(2)} to proceed.</p>
      
      {/* Stripe Elements will be mounted here */}
      <div id="card-element" className="mb-4" />
      
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          Back
        </Button>
        <Button onClick={handlePayment} disabled={isLoading}>
          {isLoading ? "Processing..." : "Pay Now"}
        </Button>
      </div>
    </Card>
  );
}
