import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, Check, Camera, Upload, FileText, ShieldCheck } from "lucide-react";

interface KycVerificationProps {
  contractId: number;
  progressId: number;
  onComplete: () => void;
  onBack: () => void;
}

export default function KycVerification({
  contractId,
  progressId,
  onComplete,
  onBack,
}: KycVerificationProps) {
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [step, setStep] = useState<"instructions" | "document" | "selfie" | "verifying" | "complete">("instructions");
  const [documentImage, setDocumentImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);

  // Handle document upload
  const handleDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real app, you'd upload the file to a server
      // For demo purposes, we'll just create a local URL
      const imageUrl = URL.createObjectURL(file);
      setDocumentImage(imageUrl);
    }
  };

  // Handle selfie upload
  const handleSelfieUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real app, you'd upload the file to a server
      // For demo purposes, we'll just create a local URL
      const imageUrl = URL.createObjectURL(file);
      setSelfieImage(imageUrl);
    }
  };

  // Move to the document upload step
  const handleStartVerification = () => {
    setStep("document");
  };

  // After document upload, move to selfie step
  const handleDocumentContinue = () => {
    if (!documentImage) {
      toast({
        title: "Document Required",
        description: "Please upload a photo of your ID document.",
        variant: "destructive",
      });
      return;
    }
    setStep("selfie");
  };

  // After selfie upload, submit for verification
  const handleSelfieContinue = () => {
    if (!selfieImage) {
      toast({
        title: "Selfie Required",
        description: "Please upload a selfie photo.",
        variant: "destructive",
      });
      return;
    }
    submitVerification();
  };

  // Submit verification data to API
  const submitVerification = async () => {
    try {
      setIsVerifying(true);
      setStep("verifying");
      
      // Simulate API integration with DiDit KYC service
      const verificationResponse = await apiRequest<{ success: boolean; verificationId: string }>("POST", "/api/mock/didit-kyc", {
        contractId,
        documentImage: "base64_document_data", // In a real app, would encode image
        selfieImage: "base64_selfie_data", // In a real app, would encode image
      });
      
      if (!verificationResponse.success) {
        throw new Error("Verification failed");
      }
      
      // Update application progress
      await apiRequest("PATCH", `/api/application-progress/${progressId}`, {
        completed: true,
        data: JSON.stringify({
          verifiedAt: new Date().toISOString(),
          verificationId: verificationResponse.verificationId || "ver-123456",
        }),
      });
      
      // Move to complete state
      setStep("complete");
      
      // After a short delay, move to the next step in the parent
      setTimeout(() => {
        onComplete();
      }, 2000);
      
    } catch (error) {
      console.error("KYC verification failed:", error);
      toast({
        title: "Verification Failed",
        description: "We couldn't verify your identity. Please try again.",
        variant: "destructive",
      });
      setStep("document");
    } finally {
      setIsVerifying(false);
    }
  };

  // Reset the verification process
  const handleReset = () => {
    setDocumentImage(null);
    setSelfieImage(null);
    setStep("instructions");
  };

  // Instructions step
  if (step === "instructions") {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Identity Verification</h3>
        <p className="text-sm text-gray-600 mb-4">
          To proceed with your financing application, we need to verify your identity.
        </p>

        <div className="rounded-lg bg-blue-50 p-4 mb-6 flex">
          <ShieldCheck className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800 mb-1">Secure Verification</p>
            <p className="text-sm text-blue-700">
              Your information is securely transmitted and processed through DiDit, our trusted identity verification partner.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-4">You'll need to:</h4>
          <ul className="space-y-3">
            <li className="flex items-start">
              <div className="bg-primary-50 p-1 rounded-full mr-3 mt-0.5">
                <FileText className="h-4 w-4 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Upload an ID document</p>
                <p className="text-xs text-gray-500">Driver's license, passport, or state ID</p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="bg-primary-50 p-1 rounded-full mr-3 mt-0.5">
                <Camera className="h-4 w-4 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Take a selfie photo</p>
                <p className="text-xs text-gray-500">To match with your ID document</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Tips for a Successful Verification</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span>Use a valid, unexpired government-issued ID</span>
            </li>
            <li className="flex items-start">
              <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span>Ensure your ID is fully visible in the photo</span>
            </li>
            <li className="flex items-start">
              <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span>Make sure lighting is good with no glare on your ID</span>
            </li>
            <li className="flex items-start">
              <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span>Take a clear selfie with neutral expression</span>
            </li>
          </ul>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleStartVerification}>
            Start Verification
          </Button>
        </div>
      </div>
    );
  }

  // Document upload step
  if (step === "document") {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload ID Document</h3>
        <p className="text-sm text-gray-600 mb-4">
          Please upload a clear photo of your government-issued ID.
        </p>

        <div className="mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            {documentImage ? (
              <div>
                <div className="max-w-md mx-auto mb-4">
                  <img 
                    src={documentImage} 
                    alt="ID Document" 
                    className="rounded-lg w-full h-auto"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setDocumentImage(null)}
                >
                  Remove Image
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Upload a photo of your ID
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  JPG, PNG or PDF format, under 10MB
                </p>
                <div>
                  <label className="inline-block">
                    <span className="sr-only">Choose file</span>
                    <input 
                      type="file" 
                      className="hidden"
                      accept="image/*"
                      onChange={handleDocumentUpload}
                    />
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                    >
                      Select File
                    </Button>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-yellow-50 p-4 mb-6 flex">
          <AlertCircle className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm text-yellow-800">
              Make sure all text on your ID is clearly visible and not cut off. The photo should be bright and in focus.
            </p>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleReset}>
            Back
          </Button>
          <Button 
            onClick={handleDocumentContinue}
            disabled={!documentImage}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // Selfie upload step
  if (step === "selfie") {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Take a Selfie</h3>
        <p className="text-sm text-gray-600 mb-4">
          Please take a clear selfie photo for identity verification.
        </p>

        <div className="mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            {selfieImage ? (
              <div>
                <div className="max-w-md mx-auto mb-4">
                  <img 
                    src={selfieImage} 
                    alt="Selfie" 
                    className="rounded-lg w-full h-auto"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelfieImage(null)}
                >
                  Remove Image
                </Button>
              </div>
            ) : (
              <div>
                <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Upload a selfie photo
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  JPG or PNG format, under 10MB
                </p>
                <div>
                  <label className="inline-block">
                    <span className="sr-only">Choose file</span>
                    <input 
                      type="file" 
                      className="hidden"
                      accept="image/*"
                      onChange={handleSelfieUpload}
                    />
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => document.querySelectorAll<HTMLInputElement>('input[type="file"]')[1]?.click()}
                    >
                      Select File
                    </Button>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-yellow-50 p-4 mb-6 flex">
          <AlertCircle className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm text-yellow-800">
              Take a clear photo with a neutral expression, good lighting, and no sunglasses or hats.
            </p>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep("document")}>
            Back
          </Button>
          <Button 
            onClick={handleSelfieContinue}
            disabled={!selfieImage}
          >
            Submit Verification
          </Button>
        </div>
      </div>
    );
  }

  // Verifying step (loading)
  if (step === "verifying") {
    return (
      <div className="p-6 text-center">
        <div className="py-12">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Verifying Your Identity</h3>
          <p className="text-sm text-gray-600">
            Please wait while we verify your information. This may take a moment.
          </p>
        </div>
      </div>
    );
  }

  // Verification complete step
  if (step === "complete") {
    return (
      <div className="p-6 text-center">
        <div className="py-12">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-4">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Identity Verified!</h3>
          <p className="text-sm text-gray-600">
            Your identity has been successfully verified.
          </p>
        </div>
      </div>
    );
  }

  return null;
}