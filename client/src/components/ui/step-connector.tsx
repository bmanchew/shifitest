import { cn } from "@/lib/utils";

interface StepConnectorProps {
  completed?: boolean;
  className?: string;
}

export function StepConnector({ completed, className }: StepConnectorProps) {
  return (
    <div
      className={cn(
        "absolute top-6 left-5 h-[calc(100%-24px)] w-0.5 bg-gray-200 z-[-1]",
        completed && "bg-primary-500",
        className
      )}
    />
  );
}
