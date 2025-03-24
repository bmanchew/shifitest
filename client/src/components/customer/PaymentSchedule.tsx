
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, Plus } from "lucide-react";

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
  
  // Split payment state
  const [enableSplitPayment, setEnableSplitPayment] = useState(false);
  const [firstCardAmount, setFirstCardAmount] = useState<number>(downPayment);
  const [secondCardAmount, setSecondCardAmount] = useState<number>(0);
  const [activeCardTab, setActiveCardTab] = useState<'first' | 'second'>('first');
  const [firstCardPaid, setFirstCardPaid] = useState(false);
  
  const stripe = useStripe();
  const elements = useElements();
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  // Update second card amount when split payment is toggled
  useEffect(() => {
    if (enableSplitPayment) {
      setSecondCardAmount(downPayment - firstCardAmount);
    } else {
      setFirstCardAmount(downPayment);
      setSecondCardAmount(0);
    }
  }, [enableSplitPayment, firstCardAmount, downPayment]);

  // Validate split payment amounts
  useEffect(() => {
    if (enableSplitPayment) {
      // If first card amount changes, adjust second card amount
      const calculatedSecondAmount = downPayment - firstCardAmount;
      if (calculatedSecondAmount !== secondCardAmount) {
        setSecondCardAmount(calculatedSecondAmount);
      }
    }
  }, [firstCardAmount, downPayment, enableSplitPayment, secondCardAmount]);

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
      
      // Calculate the amount to charge on the current card
      let amountToCharge = enableSplitPayment
        ? (activeCardTab === 'first' ? firstCardAmount : secondCardAmount)
        : downPayment;
      
      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contractId,
          amount: amountToCharge
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
        // Payment successful
        
        // Store the payment data
        let paymentData: any = {
          paymentIntentId: result.paymentIntent.id,
          amount: amountToCharge,
          status: result.paymentIntent.status,
          completedAt: new Date().toISOString()
        };
        
        // If using split payment and this is the first card
        if (enableSplitPayment && activeCardTab === 'first') {
          // Mark first card as paid and switch to second card
          setFirstCardPaid(true);
          setActiveCardTab('second');
          
          toast({
            title: "First payment successful",
            description: `${formatCurrency(firstCardAmount)} has been processed. Please enter your second card details.`
          });
          
          // Store payment data temporarily but don't complete the process yet
          paymentData.splitPayment = true;
          paymentData.firstCardPaymentId = result.paymentIntent.id;
          paymentData.firstCardAmount = firstCardAmount;
          
          // Don't complete the process yet, waiting for second card
          setPaymentProcessing(false);
          return;
        }
        
        // If using split payment and this is the second card
        if (enableSplitPayment && activeCardTab === 'second') {
          // Include both payments in the data
          paymentData.splitPayment = true;
          paymentData.firstCardPaymentId = paymentData.firstCardPaymentId || "unknown";
          paymentData.firstCardAmount = firstCardAmount;
          paymentData.secondCardPaymentId = result.paymentIntent.id; 
          paymentData.secondCardAmount = secondCardAmount;
          paymentData.totalAmount = firstCardAmount + secondCardAmount;
        }
        
        // Update progress and move to next step
        if (actualProgressId) {
          await apiRequest("PATCH", `/api/application-progress/${actualProgressId}`, {
            completed: true,
            data: JSON.stringify(paymentData)
          });
        }

        toast({
          title: "Payment successful",
          description: enableSplitPayment && activeCardTab === 'second' 
            ? "Both payments have been processed successfully."
            : "Your down payment has been processed successfully."
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
          
          <div className="flex items-center gap-3 mb-6 p-3 border rounded-lg bg-gray-50 touch-manipulation">
            <Switch
              id="split-payment"
              checked={enableSplitPayment}
              onCheckedChange={setEnableSplitPayment}
              className="scale-110"
            />
            <Label htmlFor="split-payment" className="cursor-pointer text-base font-medium">
              Split payment across two cards
            </Label>
          </div>
          
          {!enableSplitPayment ? (
            /* Single card payment */
            <div className="mb-6">
              <label className="block text-base font-medium mb-3">Card Information</label>
              <div className="p-4 border rounded-lg shadow-sm bg-white min-h-[56px] touch-manipulation">
                <CardElement 
                  options={{
                    style: {
                      base: {
                        fontSize: '18px',
                        lineHeight: '42px',
                        color: '#424770',
                        '::placeholder': {
                          color: '#aab7c4',
                        },
                        ":-webkit-autofill": {
                          color: "#424770"
                        },
                        // Increase touch target size for mobile
                        "::selection": {
                          backgroundColor: "rgba(66, 71, 112, 0.1)"
                        },
                        // Increase spacing for mobile touch
                        iconColor: '#5469d4',
                        padding: '10px 0',
                      },
                      invalid: {
                        color: '#9e2146',
                        iconColor: '#fa004f'
                      },
                    },
                    hidePostalCode: true
                  }}
                />
              </div>
              {cardError && <p className="text-red-600 text-sm mt-2">{cardError}</p>}
              
              <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowPaymentForm(false)} disabled={paymentProcessing} className="w-full sm:w-auto">
                  Back
                </Button>
                <Button onClick={handlePayment} disabled={paymentProcessing || !stripe || !elements} className="w-full sm:w-auto">
                  {paymentProcessing ? "Processing..." : `Pay ${formatCurrency(downPayment)}`}
                </Button>
              </div>
            </div>
          ) : (
            /* Split payment across two cards */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg border mb-2">
                <div>
                  <Label htmlFor="firstCardAmount" className="text-base font-medium mb-2 block">
                    Amount for first card
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="firstCardAmount"
                      type="number"
                      inputMode="decimal"
                      value={firstCardAmount}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!isNaN(value) && value >= 0 && value <= downPayment) {
                          setFirstCardAmount(value);
                        }
                      }}
                      className="w-full text-base py-6 px-4 bg-white"
                      min={1}
                      max={downPayment - 1}
                      step={0.01}
                      disabled={paymentProcessing || firstCardPaid}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="secondCardAmount" className="text-base font-medium mb-2 block">
                    Amount for second card
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="secondCardAmount"
                      type="number"
                      inputMode="decimal"
                      value={secondCardAmount}
                      disabled={true}
                      className="w-full bg-gray-100 text-base py-6 px-4"
                    />
                  </div>
                </div>
              </div>
              
              {firstCardAmount <= 0 || secondCardAmount <= 0 ? (
                <p className="text-yellow-600 text-sm">
                  Both cards must have a positive amount. Please adjust the values.
                </p>
              ) : null}
              
              <Tabs value={activeCardTab} onValueChange={(val) => setActiveCardTab(val as 'first' | 'second')} className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="first" disabled={firstCardPaid} className="flex items-center">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Card 1 {firstCardPaid ? '(Paid)' : ''}
                  </TabsTrigger>
                  <TabsTrigger value="second" disabled={!firstCardPaid} className="flex items-center">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Card 2
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="first" className="mt-4">
                  <div className={`p-4 border rounded-lg shadow-sm bg-white min-h-[56px] touch-manipulation ${firstCardPaid ? 'bg-gray-100 opacity-50' : ''}`}>
                    {!firstCardPaid ? (
                      <CardElement 
                        options={{
                          style: {
                            base: {
                              fontSize: '18px',
                              lineHeight: '42px',
                              color: '#424770',
                              '::placeholder': {
                                color: '#aab7c4',
                              },
                              ":-webkit-autofill": {
                                color: "#424770"
                              },
                              // Increase spacing for mobile touch
                              iconColor: '#5469d4',
                              padding: '10px 0',
                              "::selection": {
                                backgroundColor: "rgba(66, 71, 112, 0.1)"
                              }
                            },
                            invalid: {
                              color: '#9e2146',
                              iconColor: '#fa004f'
                            },
                          },
                          hidePostalCode: true
                        }}
                      />
                    ) : (
                      <div className="text-center py-3 text-gray-500 flex items-center justify-center">
                        <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Card information processed successfully
                      </div>
                    )}
                  </div>
                  {cardError && <p className="text-red-600 text-sm mt-2 p-2 bg-red-50 rounded-md border border-red-100">{cardError}</p>}
                  
                  <div className="flex flex-col sm:flex-row justify-between gap-4 mt-6">
                    <Button variant="outline" onClick={() => setEnableSplitPayment(false)} disabled={paymentProcessing} className="w-full sm:w-auto py-6 text-base">
                      Use Single Card
                    </Button>
                    <Button onClick={handlePayment} disabled={paymentProcessing || !stripe || !elements || firstCardAmount <= 0 || firstCardPaid} className="w-full sm:w-auto py-6 text-base bg-primary-600 hover:bg-primary-700">
                      {paymentProcessing ? "Processing..." : `Pay ${formatCurrency(firstCardAmount)}`}
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="second" className="mt-4">
                  <div className="p-4 border rounded-lg shadow-sm bg-white min-h-[56px] touch-manipulation">
                    <CardElement 
                      options={{
                        style: {
                          base: {
                            fontSize: '18px',
                            lineHeight: '42px',
                            color: '#424770',
                            '::placeholder': {
                              color: '#aab7c4',
                            },
                            ":-webkit-autofill": {
                              color: "#424770"
                            },
                            // Increase spacing for mobile touch
                            iconColor: '#5469d4',
                            padding: '10px 0',
                            "::selection": {
                              backgroundColor: "rgba(66, 71, 112, 0.1)"
                            }
                          },
                          invalid: {
                            color: '#9e2146',
                            iconColor: '#fa004f'
                          },
                        },
                        hidePostalCode: true
                      }}
                    />
                  </div>
                  {cardError && <p className="text-red-600 text-sm mt-2 p-2 bg-red-50 rounded-md border border-red-100">{cardError}</p>}
                  
                  <div className="flex flex-col sm:flex-row justify-between gap-4 mt-6">
                    <Button variant="outline" onClick={() => {
                      setFirstCardPaid(false);
                      setActiveCardTab('first');
                    }} disabled={paymentProcessing} className="w-full sm:w-auto py-6 text-base">
                      Back to First Card
                    </Button>
                    <Button onClick={handlePayment} disabled={paymentProcessing || !stripe || !elements || secondCardAmount <= 0} className="w-full sm:w-auto py-6 text-base bg-primary-600 hover:bg-primary-700">
                      {paymentProcessing ? "Processing..." : `Pay ${formatCurrency(secondCardAmount)}`}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
