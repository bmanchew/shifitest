import { Badge } from '@/components/ui/badge';
import { formatVerificationStatus, getVerificationStatusColor } from '@/shared/utils/formatters';

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
      className={getVerificationStatusColor(status)}
      variant="outline"
      size="sm"
    >
      {formatVerificationStatus(status)}
    </Badge>
  );
}