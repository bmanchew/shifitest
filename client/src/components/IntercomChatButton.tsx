import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

type IntercomChatButtonProps = {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  label?: string;
  showIcon?: boolean;
};

/**
 * IntercomChatButton component
 * A button that opens the Intercom chat messenger
 */
export const IntercomChatButton: React.FC<IntercomChatButtonProps> = ({
  variant = 'default',
  size = 'default',
  className = '',
  label = 'Chat Support',
  showIcon = true,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const handleOpenChat = () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to use the chat support.',
        variant: 'destructive',
      });
      return;
    }

    if (window.openIntercomMessenger) {
      window.openIntercomMessenger();
    } else {
      toast({
        title: 'Chat unavailable',
        description: 'Live chat support is currently unavailable.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleOpenChat}
    >
      {showIcon && <MessageSquare className="w-4 h-4 mr-2" />}
      {label}
    </Button>
  );
};

export default IntercomChatButton;