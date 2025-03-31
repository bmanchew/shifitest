import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';

// Define Notification type
export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

// Context interface
interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: number) => void;
  markAllAsRead: () => void;
  fetchNotifications: () => void;
}

// Create context
const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// Hook to use the notifications context
export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};

// Provider component
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [polling, setPolling] = useState<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch notifications
  const notificationsQuery = useQuery({
    queryKey: ['/api/investor/notifications'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/investor/notifications');
        return response.notifications || [];
      } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
    },
    refetchOnWindowFocus: false,
  });
  
  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return await apiRequest('POST', `/api/investor/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investor/notifications'] });
    }
  });
  
  // Mark all notifications as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/investor/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investor/notifications'] });
    }
  });
  
  // Calculate unread count
  const unreadCount = notificationsQuery.data
    ? notificationsQuery.data.filter((notification: Notification) => !notification.isRead).length
    : 0;
  
  // Mark a notification as read
  const markAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
  };
  
  // Mark all notifications as read
  const markAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };
  
  // Fetch notifications
  const fetchNotifications = () => {
    notificationsQuery.refetch();
  };
  
  // Set up polling for new notifications
  useEffect(() => {
    if (polling) {
      clearInterval(polling);
    }
    
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000); // Poll every minute
    
    setPolling(interval);
    
    return () => {
      if (polling) {
        clearInterval(polling);
      }
    };
  }, []);
  
  return (
    <NotificationsContext.Provider 
      value={{
        notifications: notificationsQuery.data || [],
        unreadCount,
        markAsRead,
        markAllAsRead,
        fetchNotifications
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

// Notifications bell icon component
export function NotificationsBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  
  // Get notification title display
  const getTitle = (notification: Notification) => {
    // Handle navigation based on notification type
    const handleNotificationClick = () => {
      markAsRead(notification.id);
      setIsOpen(false);
      
      if (notification.link) {
        // In a real implementation, we would use navigate() here
        window.location.href = notification.link;
      }
    };
    
    return (
      <div className="flex justify-between items-center w-full">
        <div className="font-medium" onClick={handleNotificationClick}>
          {notification.title}
        </div>
        {!notification.isRead && (
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6" 
            onClick={(e) => {
              e.stopPropagation();
              markAsRead(notification.id);
            }}
          >
            <CheckCheck className="h-4 w-4" />
            <span className="sr-only">Mark as read</span>
          </Button>
        )}
      </div>
    );
  };
  
  // Get notification icon based on type
  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Alert</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Important</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">Info</Badge>;
    }
  };
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-600 text-[10px] font-medium text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-8 text-xs"
              onClick={() => markAllAsRead()}
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">You have no notifications</p>
          </div>
        ) : (
          <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
            {notifications.slice(0, 5).map((notification) => (
              <DropdownMenuItem key={notification.id} className="flex flex-col items-start p-3 cursor-default">
                <div className="flex justify-between items-center w-full">
                  {getTitle(notification)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                <div className="flex justify-between items-center w-full mt-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </span>
                  {getIcon(notification.type)}
                </div>
              </DropdownMenuItem>
            ))}
            {notifications.length > 5 && (
              <DropdownMenuItem className="justify-center font-medium">
                <a 
                  href="/investor/notifications" 
                  className="w-full text-center text-primary hover:underline"
                  onClick={() => setIsOpen(false)}
                >
                  View all notifications
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Notifications page component
export function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const { toast } = useToast();
  
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <BellOff className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-medium mb-2">No Notifications</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have any notifications yet. When there are updates about your investments or account, 
          they will appear here.
        </p>
      </div>
    );
  }
  
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Notifications</h1>
        {notifications.some(n => !n.isRead) && (
          <Button 
            variant="outline" 
            onClick={() => markAllAsRead()}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>
      
      <div className="space-y-4">
        {notifications.map((notification) => (
          <div 
            key={notification.id} 
            className={`p-4 rounded-lg border ${notification.isRead ? '' : 'bg-muted/20 border-primary/30'}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium">{notification.title}</h3>
                  {!notification.isRead && (
                    <Badge className="bg-primary/15 text-primary">New</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">{notification.message}</p>
              </div>
              <Badge className={`
                ${notification.type === 'success' ? 'bg-green-100 text-green-800' : ''}
                ${notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${notification.type === 'error' ? 'bg-red-100 text-red-800' : ''}
                ${notification.type === 'info' ? 'bg-blue-100 text-blue-800' : ''}
              `}>
                {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
              </Badge>
            </div>
            <div className="flex justify-between items-center mt-3">
              <p className="text-xs text-muted-foreground">
                {new Date(notification.createdAt).toLocaleString()}
              </p>
              {notification.link && (
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-6 px-0"
                  onClick={() => {
                    markAsRead(notification.id);
                    window.location.href = notification.link!;
                  }}
                >
                  View Details
                </Button>
              )}
              {!notification.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => markAsRead(notification.id)}
                >
                  <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                  Mark as read
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}