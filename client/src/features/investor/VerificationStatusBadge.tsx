import { Badge } from '@/components/ui/badge';
// Using the @shared alias defined in vite.config.ts
import { formatVerificationStatus, getVerificationStatusColor } from '@shared/utils/formatters';

interface VerificationStatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Displays a verification status with appropriate styling
 */
export function VerificationStatusBadge({ status, className }: VerificationStatusBadgeProps) {
  return (
    <Badge 
      className={`${getVerificationStatusColor(status)} text-xs py-1 px-2 ${className || ''}`}
      variant="outline"
    >
      {formatVerificationStatus(status)}
    </Badge>
  );
}