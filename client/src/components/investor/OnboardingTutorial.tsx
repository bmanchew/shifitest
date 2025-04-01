import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight, ArrowLeft, Info, CheckCircle2, AlertCircle, FileText, Upload } from 'lucide-react';

type TutorialStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  actionLabel?: string;
  actionFn?: () => void;
  skipAllowed?: boolean;
};

export interface OnboardingTutorialProps {
  defaultOpen?: boolean;
  onComplete?: () => void;
  onboardingCompleted?: boolean;
  investorId?: number;
  verificationMethod?: string | null;
}

export function OnboardingTutorial({
  defaultOpen = false,
  onComplete,
  onboardingCompleted = false,
  investorId,
  verificationMethod
}: OnboardingTutorialProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(onboardingCompleted);

  // Define tutorial steps based on verification method
  const getTutorialSteps = (): TutorialStep[] => {
    const generalSteps: TutorialStep[] = [
      {
        id: 'welcome',
        title: 'Welcome to Investor Verification',
        description: 'Let\'s get you verified as an accredited investor',
        icon: <Info className="h-6 w-6 text-primary" />,
        content: (
          <div className="space-y-4">
            <p>
              Welcome to the investor verification process. As required by SEC regulations,
              we need to verify your status as an accredited investor before you can participate
              in certain investment offerings.
            </p>
            <p>
              This tutorial will guide you through the verification process step-by-step.
            </p>
            <p className="font-semibold">
              The verification process consists of:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Selecting your verification method</li>
              <li>Uploading supporting documentation</li>
              <li>Review by our compliance team</li>
              <li>Confirmation of your accredited status</li>
            </ul>
          </div>
        ),
        actionLabel: 'Let\'s Begin',
      }
    ];

    // Add method-specific steps
    if (verificationMethod === 'income') {
      return [
        ...generalSteps,
        {
          id: 'income-overview',
          title: 'Income-Based Verification',
          description: 'Overview of income requirements',
          icon: <FileText className="h-6 w-6 text-primary" />,
          content: (
            <div className="space-y-4">
              <p>
                You've selected <strong>Income-Based Verification</strong>. Under this method, 
                you'll need to demonstrate:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Individual income exceeding $200,000 in each of the two most recent years</li>
                <li>OR joint income with spouse exceeding $300,000 in those years</li>
                <li>AND a reasonable expectation of reaching the same income level in the current year</li>
              </ul>
              <p className="font-semibold mt-4">
                Required Documentation:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Tax returns (Form 1040) for the past two years</li>
                <li>W-2 statements or 1099 forms for the past two years</li>
                <li>Pay stubs or other evidence of current year income (optional but helpful)</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'income-document-upload',
          title: 'Document Upload',
          description: 'Upload your income verification documents',
          icon: <Upload className="h-6 w-6 text-primary" />,
          content: (
            <div className="space-y-4">
              <p>
                Next, you'll need to upload documents that verify your income.
              </p>
              <p>
                You can upload these documents on the main verification page. Be sure to include:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Form 1040 or other tax returns for the past two years</li>
                <li>W-2 statements or 1099 forms</li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                All documents are securely stored and handled according to our privacy policy.
              </p>
            </div>
          ),
        }
      ];
    } else if (verificationMethod === 'net_worth') {
      return [
        ...generalSteps,
        {
          id: 'net-worth-overview',
          title: 'Net Worth Verification',
          description: 'Overview of net worth requirements',
          icon: <FileText className="h-6 w-6 text-primary" />,
          content: (
            <div className="space-y-4">
              <p>
                You've selected <strong>Net Worth Verification</strong>. Under this method, 
                you'll need to demonstrate:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Individual or joint net worth with spouse exceeding $1 million</li>
                <li>Excluding the value of your primary residence</li>
              </ul>
              <p className="font-semibold mt-4">
                Required Documentation:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Bank statements (most recent 60 days)</li>
                <li>Investment account statements (most recent 60 days)</li>
                <li>Real estate valuations (excluding primary residence)</li>
                <li>List of liabilities (mortgage statements, loan documents, etc.)</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'net-worth-document-upload',
          title: 'Document Upload',
          description: 'Upload your net worth verification documents',
          icon: <Upload className="h-6 w-6 text-primary" />,
          content: (
            <div className="space-y-4">
              <p>
                Next, you'll need to upload documents that verify your net worth.
              </p>
              <p>
                You can upload these documents on the main verification page. Be sure to include:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Bank and investment account statements</li>
                <li>Property valuations and mortgage statements</li>
                <li>Any other documents showing significant assets or liabilities</li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                All documents are securely stored and handled according to our privacy policy.
              </p>
            </div>
          ),
        }
      ];
    } else if (verificationMethod === 'professional') {
      return [
        ...generalSteps,
        {
          id: 'professional-overview',
          title: 'Professional Certification',
          description: 'Overview of professional certification requirements',
          icon: <FileText className="h-6 w-6 text-primary" />,
          content: (
            <div className="space-y-4">
              <p>
                You've selected <strong>Professional Certification</strong>. Under this method, 
                you qualify based on certain professional credentials.
              </p>
              <p>
                You can qualify as an accredited investor if you hold in good standing one of these professional certifications or designations:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Series 7 – General Securities Representative license</li>
                <li>Series 65 – Uniform Investment Adviser Law license</li>
                <li>Series 82 – Private Securities Offerings Representative license</li>
                <li>Certain other SEC-recognized credentials</li>
              </ul>
              <p className="font-semibold mt-4">
                Required Documentation:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Copy of your professional license/certification</li>
                <li>Evidence that the certification/license is current and in good standing</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'professional-document-upload',
          title: 'Document Upload',
          description: 'Upload your professional certification documents',
          icon: <Upload className="h-6 w-6 text-primary" />,
          content: (
            <div className="space-y-4">
              <p>
                Next, you'll need to upload documents that verify your professional credentials.
              </p>
              <p>
                You can upload these documents on the main verification page. Be sure to include:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>A copy of your license or certification</li>
                <li>Any document showing the current status of your certification</li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                All documents are securely stored and handled according to our privacy policy.
              </p>
            </div>
          ),
        }
      ];
    } else if (verificationMethod === 'third_party') {
      return [
        ...generalSteps,
        {
          id: 'third-party-overview',
          title: 'Third-Party Verification',
          description: 'Overview of third-party verification',
          icon: <FileText className="h-6 w-6 text-primary" />,
          content: (
            <div className="space-y-4">
              <p>
                You've selected <strong>Third-Party Verification</strong>. Under this method, 
                a qualified third party will attest to your accredited investor status.
              </p>
              <p>
                Qualified third parties include:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>A registered broker-dealer</li>
                <li>An SEC-registered investment adviser</li>
                <li>A licensed attorney</li>
                <li>A certified public accountant (CPA)</li>
              </ul>
              <p className="font-semibold mt-4">
                Process:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>You'll provide contact information for your verifier</li>
                <li>We'll send them a verification request</li>
                <li>They'll complete an attestation form confirming your status</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'third-party-contact',
          title: 'Third-Party Contact Information',
          description: 'Provide contact details for your verifier',
          icon: <Upload className="h-6 w-6 text-primary" />,
          content: (
            <div className="space-y-4">
              <p>
                On the main verification page, you'll need to provide the following information about your third-party verifier:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Full name</li>
                <li>Email address</li>
                <li>Professional role (attorney, CPA, etc.)</li>
                <li>Optional message to include with the verification request</li>
              </ul>
              <p className="mt-4">
                Once submitted, we'll send an email to your verifier with instructions on how to complete the attestation.
              </p>
            </div>
          ),
        }
      ];
    }

    // Default steps (no method selected yet)
    return [
      ...generalSteps,
      {
        id: 'method-selection',
        title: 'Choose Your Verification Method',
        description: 'Select the most appropriate verification method',
        icon: <FileText className="h-6 w-6 text-primary" />,
        content: (
          <div className="space-y-4">
            <p>
              SEC regulations allow for several methods to verify your accredited investor status:
            </p>
            <div className="space-y-3">
              <div className="p-3 border rounded-md">
                <h4 className="font-semibold">Income-Based</h4>
                <p className="text-sm">Income exceeding $200,000 individually (or $300,000 jointly with spouse) in each of the two most recent years.</p>
              </div>
              <div className="p-3 border rounded-md">
                <h4 className="font-semibold">Net Worth</h4>
                <p className="text-sm">Net worth exceeding $1 million (excluding primary residence).</p>
              </div>
              <div className="p-3 border rounded-md">
                <h4 className="font-semibold">Professional Certification</h4>
                <p className="text-sm">Holding professional certifications such as Series 7, 65, or 82 licenses.</p>
              </div>
              <div className="p-3 border rounded-md">
                <h4 className="font-semibold">Third-Party Verification</h4>
                <p className="text-sm">Verification by a registered broker-dealer, investment adviser, attorney, or CPA.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Choose the method that best applies to your situation. You'll be able to provide the appropriate documentation in the next steps.
            </p>
          </div>
        ),
      }
    ];
  };

  const tutorialSteps = getTutorialSteps();
  const currentStep = tutorialSteps[currentStepIndex];
  
  useEffect(() => {
    // Calculate progress percentage
    setProgress(((currentStepIndex + 1) / tutorialSteps.length) * 100);
  }, [currentStepIndex, tutorialSteps.length]);

  const handleNext = () => {
    if (currentStepIndex < tutorialSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleComplete = () => {
    setCompleted(true);
    setOpen(false);
    if (onComplete) {
      onComplete();
    }
  };

  const startTutorial = () => {
    setOpen(true);
    setCurrentStepIndex(0);
  };

  return (
    <>
      {/* Tutorial Launcher */}
      {!open && (
        <div className="mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Investor Verification Guide</CardTitle>
              <CardDescription>
                {completed 
                  ? "You've completed the verification tutorial, but you can review it again anytime." 
                  : "Not sure how to proceed? Follow our step-by-step tutorial."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant={completed ? "outline" : "default"} onClick={startTutorial} className="w-full">
                {completed ? "Review Verification Steps" : "Start Tutorial"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tutorial Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {currentStep.icon}
              <DialogTitle>{currentStep.title}</DialogTitle>
            </div>
            <DialogDescription>{currentStep.description}</DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Progress value={progress} className="h-2 mb-6" />
            {currentStep.content}
          </div>
          
          <DialogFooter className="flex sm:justify-between">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handlePrevious} 
                disabled={currentStepIndex === 0}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button onClick={handleNext}>
                {currentStepIndex === tutorialSteps.length - 1 ? 'Complete' : 'Next'} 
                {currentStepIndex < tutorialSteps.length - 1 && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
            
            {currentStep.skipAllowed && (
              <Button variant="ghost" onClick={handleComplete} className="text-sm">
                Skip Tutorial
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}