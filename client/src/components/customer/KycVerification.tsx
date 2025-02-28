import { useState, useEffect, useRef } from "react";
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
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"instructions" | "document" | "selfie" | "verifying" | "verifying_external" | "complete">("instructions");
  const [documentImage, setDocumentImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const verificationWindowRef = useRef<Window | null>(null);
  
  // Listen for message events from the DiDit verification window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Check if the message is the verification complete signal
      if (event.data === 'verification_complete') {
        console.log('Received verification complete signal');
        
        // If we have a verification window reference, close it
        if (verificationWindowRef.current) {
          verificationWindowRef.current.close();
        }
        
        // Complete the verification process
        completeVerification();
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [sessionId, progressId]);
  
  // Complete the verification process after receiving confirmation
  const completeVerification = async () => {
    try {
      if (!sessionId) return;
      
      // Get the current KYC progress ID for this contract
      const kycProgressResponse = await apiRequest<{
        id: number;
        contractId: number;
        step: string;
        completed: boolean;
        data: string | null;
      }>("GET", `/api/application-progress/kyc/${contractId}`);
      
      if (!kycProgressResponse || !kycProgressResponse.id) {
        throw new Error("Could not find KYC progress for this contract");
      }
      
      const kycProgressId = kycProgressResponse.id;
      console.log("Found KYC progress ID for completion:", kycProgressId);
      
      // Mark the KYC step as completed in our application
      await apiRequest("PATCH", `/api/application-progress/${kycProgressId}`, {
        completed: true,
        data: JSON.stringify({
          verifiedAt: new Date().toISOString(),
          sessionId: sessionId,
          status: "approved"
        }),
      });
      
      setStep("complete");
      setIsVerifying(false);
      
      // After a short delay, move to the next step in the application
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error("Error updating verification status:", error);
      toast({
        title: "Verification Error",
        description: "There was an error completing your verification. Please try again.",
        variant: "destructive",
      });
      setIsVerifying(false);
      setStep("instructions");
    }
  };

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
    // Skip document/selfie collection and go directly to DiDit verification
    createVerificationSession();
  };

  // Move to the selfie step after document upload
  const handleDocumentNext = () => {
    if (!documentImage) {
      toast({
        title: "Document Required",
        description: "Please upload or take a photo of your identification document",
        variant: "destructive",
      });
      return;
    }
    setStep("selfie");
  };

  // Handle the verification submission
  const handleSelfieNext = () => {
    if (!selfieImage) {
      toast({
        title: "Selfie Required",
        description: "Please take a selfie photo for identity verification",
        variant: "destructive",
      });
      return;
    }
    submitVerification();
  };
  
  // Create a verification session with DiDit
  const createVerificationSession = async () => {
    try {
      setIsLoading(true);
      
      // First, let's get the correct KYC progress ID for this contract
      const kycProgressResponse = await apiRequest<{
        id: number;
        contractId: number;
        step: string;
        completed: boolean;
        data: string | null;
      }>("GET", `/api/application-progress/kyc/${contractId}`);
      
      if (!kycProgressResponse || !kycProgressResponse.id) {
        throw new Error("Could not find KYC progress for this contract");
      }
      
      const kycProgressId = kycProgressResponse.id;
      console.log("Found KYC progress ID:", kycProgressId);
      
      // Call our API endpoint to create a DiDit verification session
      const response = await apiRequest<{
        success: boolean;
        session: {
          session_id: string;
          session_url: string;
          status: string;
        }
      }>("POST", "/api/kyc/create-session", {
        contractId
      });
      
      if (!response?.success || !response.session) {
        throw new Error("Failed to create verification session");
      }
      
      const { session } = response;
      
      console.log("KYC verification session created:", session);
      setSessionId(session.session_id);
      setVerificationUrl(session.session_url);
      
      // Update application progress to track that verification has started
      await apiRequest("PATCH", `/api/application-progress/${kycProgressId}`, {
        completed: false, // Not completed yet, just starting
        data: JSON.stringify({
          verificationStarted: new Date().toISOString(),
          sessionId: session.session_id,
          sessionUrl: session.session_url
        }),
      });
      
      // Open the DiDit verification in a new window
      setStep("verifying_external");
      
      // Open the DiDit verification URL in a new window
      const verificationWindow = window.open(session.session_url, "_blank", "width=500,height=600");
      
      // Store the window reference
      verificationWindowRef.current = verificationWindow;
      
      if (!verificationWindow) {
        // If popup was blocked, show a message with link instead
        toast({
          title: "Popup Blocked",
          description: "Please allow popups for this site and try again, or click the button below to open verification.",
          variant: "destructive",
        });
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error creating verification session:", error);
      toast({
        title: "Verification Error",
        description: "Could not start the identity verification process. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Submit the verification data to the backend (legacy method)
  const submitVerification = async () => {
    try {
      setIsVerifying(true);
      setStep("verifying");
      
      // Get the current KYC progress ID for this contract
      const kycProgressResponse = await apiRequest<{
        id: number;
        contractId: number;
        step: string;
        completed: boolean;
        data: string | null;
      }>("GET", `/api/application-progress/kyc/${contractId}`);
      
      if (!kycProgressResponse || !kycProgressResponse.id) {
        throw new Error("Could not find KYC progress for this contract");
      }
      
      const kycProgressId = kycProgressResponse.id;
      console.log("Found KYC progress ID for manual verification:", kycProgressId);
      
      // Create base64 representations of the images
      // In a real app, you would properly encode the images
      // For demo purposes, we'll use placeholders
      const encodedDocumentImage = documentImage ? "base64_document_data" : "";
      const encodedSelfieImage = selfieImage ? "base64_selfie_data" : "";
      
      // Call the DiDit KYC API (using legacy endpoint for now)
      const response = await apiRequest<{
        session_id: string;
        session_url: string;
        status: string;
      }>("POST", "/api/mock/didit-kyc", {
        contractId,
        documentImage: encodedDocumentImage,
        selfieImage: encodedSelfieImage,
      });
      
      if (!response || !response.session_id) {
        throw new Error("Verification session creation failed");
      }
      
      console.log("KYC verification session created:", response);
      setSessionId(response.session_id);
      
      // Update application progress to track that verification has started
      await apiRequest("PATCH", `/api/application-progress/${kycProgressId}`, {
        completed: false, // Not completed yet, just starting
        data: JSON.stringify({
          verificationStarted: new Date().toISOString(),
          sessionId: response.session_id,
          sessionUrl: response.session_url
        }),
      });
      
      // Simulate verification completion after a delay
      // In a real app, this would be handled by the DiDit webhook
      setTimeout(async () => {
        try {
          // Mark the KYC step as completed in our application
          await apiRequest("PATCH", `/api/application-progress/${kycProgressId}`, {
            completed: true,
            data: JSON.stringify({
              verifiedAt: new Date().toISOString(),
              sessionId: response.session_id,
              status: "approved"
            }),
          });
          
          setStep("complete");
          setIsVerifying(false);
          // After a short delay, move to the next step in the application
          setTimeout(() => {
            onComplete();
          }, 2000);
        } catch (error) {
          console.error("Error updating verification status:", error);
          toast({
            title: "Verification Error",
            description: "There was an error completing your verification. Please try again.",
            variant: "destructive",
          });
          setIsVerifying(false);
          setStep("instructions");
        }
      }, 5000); // Simulate verification taking 5 seconds
    } catch (error) {
      console.error("Verification submission error:", error);
      toast({
        title: "Verification Failed",
        description: "There was an error starting the verification process. Please try again.",
        variant: "destructive",
      });
      setIsVerifying(false);
      setStep("instructions");
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6 max-w-lg mx-auto">
      {/* Instructions Step */}
      {step === "instructions" && (
        <div className="w-full space-y-6">
          <div className="bg-primary/5 rounded-lg p-6 border border-primary/20">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Identity Verification</h2>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              We need to verify your identity before proceeding with your financing application. 
              This process is secure and typically takes less than 2 minutes.
            </p>
            
            <div className="space-y-3 mb-4">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-primary/10 rounded-full mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm">You'll need a valid government-issued ID (driver's license, passport, or national ID)</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-primary/10 rounded-full mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm">We'll need to take a photo of your face to match with your ID</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-primary/10 rounded-full mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm">This verification is provided by DiDit, our secure identity verification partner</p>
              </div>
            </div>
            
            <div className="flex space-x-2 pt-4">
              <Button variant="outline" onClick={onBack}>Back</Button>
              <Button onClick={handleStartVerification} disabled={isLoading}>
                {isLoading ? "Starting Verification..." : "Start Verification"}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Document Upload Step */}
      {step === "document" && (
        <div className="w-full space-y-6">
          <div className="bg-primary/5 rounded-lg p-6 border border-primary/20">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Document Upload</h2>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Please take a clear photo of your government-issued ID. Make sure all details are clearly visible.
            </p>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-6">
              {documentImage ? (
                <div className="space-y-3">
                  <div className="relative h-48 w-full max-w-sm mx-auto">
                    <img src={documentImage} alt="ID Document" className="h-full w-full object-contain mx-auto" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setDocumentImage(null)}>
                    Remove Photo
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="h-10 w-10 text-primary/70" />
                  </div>
                  <p className="text-sm text-gray-500">Take or upload a photo of your ID</p>
                  <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 justify-center">
                    <label className="cursor-pointer">
                      <Button variant="secondary" size="sm" className="relative">
                        <Camera className="h-4 w-4 mr-2" />
                        Take Photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleDocumentUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </Button>
                    </label>
                    <label className="cursor-pointer">
                      <Button variant="outline" size="sm" className="relative">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleDocumentUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </Button>
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setStep("instructions")}>Back</Button>
              <Button onClick={handleDocumentNext} disabled={!documentImage}>Continue</Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Selfie Step */}
      {step === "selfie" && (
        <div className="w-full space-y-6">
          <div className="bg-primary/5 rounded-lg p-6 border border-primary/20">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Take a Selfie</h2>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Please take a clear photo of your face. This will be compared with your ID photo for verification.
            </p>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-6">
              {selfieImage ? (
                <div className="space-y-3">
                  <div className="relative h-48 w-full max-w-sm mx-auto">
                    <img src={selfieImage} alt="Selfie" className="h-full w-full object-contain mx-auto" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelfieImage(null)}>
                    Remove Photo
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="h-10 w-10 text-primary/70" />
                  </div>
                  <p className="text-sm text-gray-500">Take a selfie photo</p>
                  <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 justify-center">
                    <label className="cursor-pointer">
                      <Button variant="secondary" size="sm" className="relative">
                        <Camera className="h-4 w-4 mr-2" />
                        Take Selfie
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={handleSelfieUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </Button>
                    </label>
                    <label className="cursor-pointer">
                      <Button variant="outline" size="sm" className="relative">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSelfieUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </Button>
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setStep("document")}>Back</Button>
              <Button onClick={handleSelfieNext} disabled={!selfieImage}>Continue</Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Verifying Step */}
      {step === "verifying" && (
        <div className="w-full space-y-6">
          <div className="bg-primary/5 rounded-lg p-6 border border-primary/20 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-primary/10 rounded-full animate-pulse">
                <ShieldCheck className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Verifying Your Identity</h2>
              <p className="text-sm text-gray-600">
                Please wait while we verify your identity. This process usually takes less than a minute.
              </p>
              <div className="w-full max-w-md mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${isVerifying ? '70%' : '0%'}` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* External Verification Step */}
      {step === "verifying_external" && (
        <div className="w-full space-y-6">
          <div className="bg-primary/5 rounded-lg p-6 border border-primary/20 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <ShieldCheck className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">External Verification</h2>
              <p className="text-sm text-gray-600">
                We've opened the DiDit verification page in a new window. Please complete the verification process there.
              </p>
              <p className="text-sm text-gray-600">
                If the verification window was blocked or you closed it, you can open it again with the button below.
              </p>
              <Button 
                onClick={() => {
                  if (verificationUrl) {
                    const newWindow = window.open(verificationUrl, "_blank", "width=500,height=600");
                    verificationWindowRef.current = newWindow;
                  }
                }}
                disabled={!verificationUrl}
              >
                Open Verification Window
              </Button>
              <div className="border-t border-gray-200 w-full pt-4 mt-4">
                <p className="text-sm text-gray-500">
                  After completing verification, you'll be automatically redirected back to continue your application.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Complete Step */}
      {step === "complete" && (
        <div className="w-full space-y-6">
          <div className="bg-primary/5 rounded-lg p-6 border border-primary/20 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-green-100 rounded-full">
                <Check className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold">Verification Complete</h2>
              <p className="text-sm text-gray-600">
                Your identity has been successfully verified. You may now proceed with your application.
              </p>
              <p className="text-sm text-green-500 font-medium">
                Moving to the next step automatically...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}