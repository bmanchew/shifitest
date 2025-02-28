import { FC } from "react";
import { Check, CircleDashed } from "lucide-react";

export interface Step {
  id: string;
  title: string;
  description: string;
}

interface ApplicationStepsProps {
  steps: Step[];
  currentStep: string;
  completedSteps: string[];
}

export default function ApplicationSteps({
  steps,
  currentStep,
  completedSteps,
}: ApplicationStepsProps) {
  return (
    <div className="w-full">
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center relative flex-1">
            <div className="flex items-center justify-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  completedSteps.includes(step.id)
                    ? "bg-green-500"
                    : currentStep === step.id
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {completedSteps.includes(step.id) ? (
                  <Check className="h-5 w-5 text-white" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
            </div>
            
            {index < steps.length - 1 && (
              <div 
                className={`h-0.5 absolute top-4 left-8 right-0 -mr-4 ${
                  completedSteps.includes(step.id) ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
            
            <div className="ml-3 absolute -bottom-7 w-max">
              <p className={`text-xs ${
                currentStep === step.id
                  ? "font-semibold text-gray-900"
                  : completedSteps.includes(step.id)
                  ? "text-green-600"
                  : "text-gray-500"
              }`}>
                {step.title}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="sm:hidden mt-1">
        <p className="text-sm font-medium text-gray-900">
          Step {steps.findIndex(s => s.id === currentStep) + 1} of {steps.length}: {steps.find(s => s.id === currentStep)?.title}
        </p>
        <div className="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
          <div
            className="bg-primary-600"
            style={{
              width: `${((steps.findIndex(s => s.id === currentStep) + 1) / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}