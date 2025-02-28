import { StepConnector } from "@/components/ui/step-connector";
import { Check, Clock, Lock } from "lucide-react";

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
    <div className="space-y-8 py-2">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isPending = !isCompleted && !isCurrent;
        const isLocked = isPending && !completedSteps.includes(steps[index - 1]?.id);
        
        // Calculate status color
        let statusColor = "bg-gray-100 text-gray-400";
        let statusIcon = <span className="text-sm font-medium">{index + 1}</span>;
        
        if (isCompleted) {
          statusColor = "bg-green-600 text-white";
          statusIcon = <Check className="h-5 w-5" />;
        } else if (isCurrent) {
          statusColor = "bg-blue-50 text-blue-600 ring-2 ring-blue-500";
          statusIcon = <Clock className="h-5 w-5" />;
        } else if (isLocked) {
          statusColor = "bg-gray-100 text-gray-400";
          statusIcon = <Lock className="h-4 w-4" />;
        }
        
        return (
          <div key={step.id} className="relative">
            <div className="flex items-center">
              {/* Step connector */}
              {index < steps.length - 1 && (
                <StepConnector 
                  completed={isCompleted} 
                  className={`${isCompleted ? "bg-green-500" : "bg-gray-200"}`}
                />
              )}
              
              {/* Step indicator */}
              <div
                className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full 
                  ${statusColor} shadow-sm transition-all duration-200`}
              >
                {statusIcon}
              </div>
              
              {/* Step content */}
              <div className="ml-4 flex-1">
                <h4 className={`text-base font-semibold transition-colors duration-200
                  ${isCurrent ? "text-blue-700" : isCompleted ? "text-gray-900" : "text-gray-500"}`}>
                  {step.title}
                </h4>
                <p className={`text-sm ${isCurrent ? "text-blue-600" : "text-gray-500"}`}>
                  {step.description}
                </p>
              </div>
              
              {/* Step status */}
              <div className="hidden md:block ml-4">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium
                  ${isCompleted ? "bg-green-100 text-green-800" : 
                     isCurrent ? "bg-blue-100 text-blue-800" : 
                     "bg-gray-100 text-gray-600"}`}>
                  {isCompleted ? "Completed" : isCurrent ? "In Progress" : "Pending"}
                </span>
              </div>
            </div>
            
            {/* Animation for current step */}
            {isCurrent && (
              <div className="absolute -inset-x-4 -inset-y-2 z-0 rounded-md bg-blue-50/50 md:block hidden" />
            )}
          </div>
        );
      })}
    </div>
  );
}
