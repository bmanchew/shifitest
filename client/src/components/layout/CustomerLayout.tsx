import { useState } from "react";

interface CustomerLayoutProps {
  children: React.ReactNode;
  currentStep?: number;
  totalSteps?: number;
  progress?: number;
}

export default function CustomerLayout({
  children,
  currentStep = 1,
  totalSteps = 6,
  progress = 0,
}: CustomerLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-primary-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-white rounded-md p-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-primary-600"
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
                <h2 className="ml-2 text-xl font-bold text-white">ShiFi</h2>
              </div>
              <div className="text-sm text-white font-medium">
                Step <span>{currentStep}</span> of <span>{totalSteps}</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative w-full bg-gray-200 h-2">
            <div
              className="absolute top-0 left-0 bg-primary-500 h-2 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Content */}
          {children}
        </div>
      </div>
    </div>
  );
}
