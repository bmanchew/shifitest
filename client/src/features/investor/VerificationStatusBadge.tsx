/**
 * VerificationStatusBadge Component
 * 
 * Displays a visual badge indicating the verification status of an investor
 * with appropriate color coding and icons.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle,
  FileText,
  HelpCircle
} from 'lucide-react';

// Define the possible verification statuses
export type VerificationStatus = 
  | 'not_started' 
  | 'pending' 
  | 'verified' 
  | 'rejected' 
  | 'under_review'
  | 'incomplete';

interface VerificationStatusBadgeProps {
  status: VerificationStatus;
  className?: string;
  showIcon?: boolean;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * VerificationStatusBadge Component
 * 
 * @param status The current verification status
 * @param className Optional additional classes
 * @param showIcon Whether to show the status icon (default: true)
 * @param showText Whether to show the status text (default: true)
 * @param size Size of the badge (default: 'md')
 */
export const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({
  status,
  className = '',
  showIcon = true,
  showText = true,
  size = 'md'
}) => {
  // Define configuration for each status
  const statusConfig = {
    not_started: {
      variant: 'outline' as const,
      text: 'Not Started',
      icon: <FileText className="w-4 h-4" />,
      color: 'text-gray-500'
    },
    pending: {
      variant: 'secondary' as const,
      text: 'Pending',
      icon: <Clock className="w-4 h-4" />,
      color: 'text-orange-500'
    },
    verified: {
      variant: 'default' as const,
      text: 'Verified',
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'text-green-500'
    },
    rejected: {
      variant: 'destructive' as const,
      text: 'Rejected',
      icon: <XCircle className="w-4 h-4" />,
      color: 'text-red-500'
    },
    under_review: {
      variant: 'secondary' as const,
      text: 'Under Review',
      icon: <AlertCircle className="w-4 h-4" />,
      color: 'text-blue-500'
    },
    incomplete: {
      variant: 'outline' as const,
      text: 'Incomplete',
      icon: <HelpCircle className="w-4 h-4" />,
      color: 'text-yellow-500'
    }
  };

  // Get config for current status, default to "not_started" if status is invalid
  const config = statusConfig[status] || statusConfig.not_started;
  
  // Set size-based classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1'
  };

  return (
    <Badge 
      variant={config.variant}
      className={`
        gap-1.5 font-medium ${sizeClasses[size]} ${config.color} ${className}
      `}
    >
      {showIcon && config.icon}
      {showText && config.text}
    </Badge>
  );
};

export default VerificationStatusBadge;