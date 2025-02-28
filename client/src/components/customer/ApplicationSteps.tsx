import { StepConnector } from "@/components/ui/step-connector";
import { Check } from "lucide-react";

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
    <div className="space-y-6">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        
        return (
          <div key={step.id} className="relative flex">
            {index < steps.length - 1 && (
              <StepConnector completed={isCompleted} />
            )}
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full 
                ${isCompleted ? "bg-primary-500 text-white" : isCurrent ? "bg-primary-100 text-primary-600 ring-2 ring-primary-500" : "bg-gray-100 text-gray-500"}`}
            >
              {isCompleted ? (
                <Check className="h-6 w-6" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            <div className="ml-4">
              <h4 className="text-base font-medium text-gray-900">{step.title}</h4>
              <p className="text-sm text-gray-500">{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
