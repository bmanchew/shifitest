import React from "react";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/ui/logo";

interface CustomerLayoutProps {
  children: React.ReactNode;
  currentStep?: number;
  totalSteps?: number;
  progress?: number;
}

export default function CustomerLayout({
  children,
  currentStep,
  totalSteps,
  progress,
}: CustomerLayoutProps) {
  // Determine if this is a multi-step application layout
  const isApplicationFlow = !!currentStep && !!totalSteps;
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center">
            <Logo size={32} className="mr-2" />
            <h1 className="text-xl font-bold text-gray-900">ShiFi</h1>
          </div>
          
          {isApplicationFlow && (
            <div className="text-sm text-gray-600">
              Step {currentStep} of {totalSteps}
            </div>
          )}
        </div>
      </header>

      {/* Progress bar for application flow */}
      {isApplicationFlow && progress !== undefined && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-8 flex-1 flex flex-col">
          {/* Card container for application flow */}
          {isApplicationFlow ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
              {children}
            </div>
          ) : (
            // Regular content for non-application pages
            <>{children}</>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 py-6 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} ShiFi Financial, Inc. All rights reserved.</p>
          <p className="mt-2">
            <a href="#" className="text-primary-600 hover:text-primary-700">
              Terms of Service
            </a>{" "}
            •{" "}
            <a href="#" className="text-primary-600 hover:text-primary-700">
              Privacy Policy
            </a>{" "}
            •{" "}
            <a href="#" className="text-primary-600 hover:text-primary-700">
              Contact Support
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}