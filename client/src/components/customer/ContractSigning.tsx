import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FilePenLine, FileText, Info, Check } from "lucide-react";

interface ContractSigningProps {
  contractId: number;
  progressId: number;
  contractNumber: string;
  customerName: string;
  onComplete: () => void;
  onBack: () => void;
}

export default function ContractSigning({
  contractId,
  progressId,
  contractNumber,
  customerName,
  onComplete,
  onBack,
}: ContractSigningProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"review" | "sign" | "complete">("review");
  const [signatureData, setSignatureData] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle contract review moving to signing step
  const handleReviewComplete = () => {
    setStep("sign");
  };

  // Clear the signature canvas
  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData("");
      }
    }
  };

  // Initialize the signature canvas
  const initializeCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = 150;
    }

    // Drawing state
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // Event listeners
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("touchmove", handleTouchMove);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("touchend", stopDrawing);
    canvas.addEventListener("mouseout", stopDrawing);

    function startDrawing(e: MouseEvent) {
      isDrawing = true;
      [lastX, lastY] = [e.offsetX, e.offsetY];
    }

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        lastX = touch.clientX - rect.left;
        lastY = touch.clientY - rect.top;
        isDrawing = true;
      }
    }

    function draw(e: MouseEvent) {
      if (!isDrawing) return;
      
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#000";
      
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
      
      [lastX, lastY] = [e.offsetX, e.offsetY];
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (!isDrawing || e.touches.length !== 1) return;
      
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;
      
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#000";
      
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
      
      [lastX, lastY] = [offsetX, offsetY];
    }

    function stopDrawing() {
      if (isDrawing) {
        isDrawing = false;
        setSignatureData(canvas.toDataURL("image/png"));
      }
    }
  };

  // Submit the signed contract
  const handleSubmitSignature = async () => {
    if (!signatureData) {
      toast({
        title: "Signature Required",
        description: "Please sign the contract to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Simulate API integration with Thanks Roger signing service
      const signingResponse = await apiRequest("POST", "/api/mock/thanks-roger-signing", {
        contractId,
        signatureData,
        customerName,
      });
      
      if (!signingResponse.success) {
        throw new Error("Signing service error");
      }
      
      // Update application progress
      await apiRequest("PATCH", `/api/application-progress/${progressId}`, {
        completed: true,
        data: JSON.stringify({
          signedAt: new Date().toISOString(),
          signatureId: signingResponse.signatureId || "sig-123456",
        }),
      });
      
      // Update contract step to "completed"
      await apiRequest("PATCH", `/api/contracts/${contractId}/step`, {
        step: "completed",
      });
      
      // Update contract status to "active"
      await apiRequest("PATCH", `/api/contracts/${contractId}/status`, {
        status: "active",
      });
      
      setStep("complete");
      
      // After a short delay, move to the completed state in the parent
      setTimeout(() => {
        onComplete();
      }, 2000);
      
    } catch (error) {
      console.error("Contract signing failed:", error);
      toast({
        title: "Signing Failed",
        description: "We couldn't process your signature. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // When canvas ref is available, initialize it
  const handleCanvasRef = (canvas: HTMLCanvasElement | null) => {
    if (canvas) {
      canvasRef.current = canvas;
      initializeCanvas(canvas);
    }
  };

  // Render the review contract step
  if (step === "review") {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Review Your Contract</h3>
        <p className="text-sm text-gray-600 mb-4">
          Please review your contract details before signing.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 flex">
          <Info className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800 mb-1">Important Information</p>
            <p className="text-sm text-blue-700">
              This is a legally binding contract. Please review all terms carefully before signing.
            </p>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg mb-6 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center">
            <FileText className="h-5 w-5 text-gray-500 mr-2" />
            <h4 className="font-medium text-gray-900">Retail Installment Contract #{contractNumber}</h4>
          </div>
          
          <div className="p-4 max-h-96 overflow-y-auto text-sm text-gray-700 space-y-4">
            <p>
              <strong>THIS RETAIL INSTALLMENT CONTRACT</strong> (this "Contract") is made as of {new Date().toLocaleDateString()}, by and between the Merchant and the Customer identified below.
            </p>
            
            <h5 className="font-semibold mb-1">TERMS AND CONDITIONS</h5>
            
            <p>
              <strong>1. Purchases.</strong> Customer agrees to purchase the goods or services described in this Contract from Merchant.
            </p>
            
            <p>
              <strong>2. Payment.</strong> Customer agrees to pay the Total Amount in accordance with the Payment Schedule set forth in this Contract. The Down Payment is due upon signing of this Contract. The balance of the purchase price shall be paid in equal monthly installments as set forth in the Payment Schedule.
            </p>
            
            <p>
              <strong>3. Interest Rate.</strong> This is a 0% interest financing contract. No interest will be charged on the financed amount provided all payments are made on time according to the Payment Schedule.
            </p>
            
            <p>
              <strong>4. Late Payments.</strong> If any payment is more than 10 days late, Customer may be charged a late fee of up to $25 per late payment, subject to applicable law.
            </p>
            
            <p>
              <strong>5. Early Payoff.</strong> Customer may pay off the entire outstanding balance at any time without penalty.
            </p>
            
            <p>
              <strong>6. Default.</strong> If Customer fails to make any payment when due, or otherwise breaches any term of this Contract, Merchant may declare the entire unpaid balance immediately due and payable.
            </p>
            
            <p>
              <strong>7. Governing Law.</strong> This Contract shall be governed by the laws of the state of Delaware, without giving effect to any choice of law or conflict of law provisions.
            </p>
            
            <p>
              <strong>8. Electronic Signatures.</strong> Customer and Merchant agree that electronic signatures shall have the same force and effect as handwritten signatures.
            </p>
            
            <p>
              <strong>9. Entire Agreement.</strong> This Contract constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements and understandings, whether oral or written.
            </p>
            
            <p className="italic">
              By signing below, Customer acknowledges that they have read, understand, and agree to be bound by all the terms and conditions of this Contract.
            </p>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleReviewComplete}>
            Continue to Sign
          </Button>
        </div>
      </div>
    );
  }

  // Render the signature step
  if (step === "sign") {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign Your Contract</h3>
        <p className="text-sm text-gray-600 mb-4">
          Please sign your contract using the signature pad below.
        </p>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">Signature</label>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 text-xs"
              onClick={clearSignature}
            >
              Clear
            </Button>
          </div>
          <div className="border border-gray-300 rounded-lg bg-white p-1">
            <canvas 
              ref={handleCanvasRef}
              className="w-full touch-none cursor-crosshair"
              style={{ height: "150px" }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Sign with your mouse or finger in the area above
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            By signing, you confirm that you have read and agree to the terms of the contract.
            This signature will be used to create a legally binding electronic document.
          </p>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep("review")}>
            Back to Review
          </Button>
          <Button 
            onClick={handleSubmitSignature} 
            disabled={isSubmitting || !signatureData}
          >
            {isSubmitting ? "Processing..." : "Submit Signature"}
          </Button>
        </div>
      </div>
    );
  }

  // Render the completion step
  if (step === "complete") {
    return (
      <div className="p-6 text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-4">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Contract Successfully Signed!</h3>
        <p className="text-sm text-gray-600 mb-4">
          Your contract has been signed and is now being processed.
        </p>
      </div>
    );
  }

  return null;
}