
import { cn } from "../../lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-t-2 border-primary",
        {
          "h-4 w-4 border-2": size === "sm",
          "h-8 w-8 border-2": size === "md",
          "h-12 w-12 border-4": size === "lg",
        },
        className
      )}
    />
  );
}
