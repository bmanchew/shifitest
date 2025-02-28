import React from "react";
import { Progress } from "@/components/ui/progress";

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
            <div className="bg-primary-600 rounded-md p-1 mr-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
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