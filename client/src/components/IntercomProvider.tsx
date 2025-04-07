import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

// Add Intercom types to the global Window interface
declare global {
  interface Window {
    intercomSettings?: {
      app_id: string;
      name?: string;
      email?: string;
      user_id?: string;
      company?: {
        id: string;
        name: string;
      };
      custom_launcher_selector?: string;
      hide_default_launcher?: boolean;
      [key: string]: any;
    };
    Intercom?: (...args: any[]) => void;
    openIntercomMessenger: () => void;
    closeIntercomMessenger: () => void;
  }
}

/**
 * IntercomProvider component
 * This component initializes and loads the Intercom chat widget
 */
export const IntercomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const intercomLoaded = useRef(false);

  // Fetch Intercom configuration from server
  const { data: intercomConfig } = useQuery({
    queryKey: ['intercom-config'],
    queryFn: async () => {
      return await apiRequest<{ appId: string }>('GET', '/api/intercom/config');
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  // Load Intercom script
  useEffect(() => {
    if (!intercomConfig?.appId || intercomLoaded.current) return;

    // Configure Intercom settings before loading the script
    window.intercomSettings = {
      app_id: intercomConfig.appId,
      hide_default_launcher: true, // Hide default launcher, we'll use our own button
    };

    // Add Intercom snippet (official Intercom snippet adapted for React)
    const initIntercom = () => {
      const w = window;
      const ic = w.Intercom;
      if (typeof ic === "function") {
        ic('reattach_activator');
        ic('update', w.intercomSettings);
      } else {
        const d = document;
        const i = function () {
          i.c(arguments);
        };
        i.q = [];
        i.c = function (args) {
          i.q.push(args);
        };
        w.Intercom = i;

        // Add Intercom script
        const script = d.createElement('script');
        script.async = true;
        script.src = 'https://widget.intercom.io/widget/' + intercomConfig.appId;
        d.head.appendChild(script);
        
        // Register script loaded status
        intercomLoaded.current = true;

        // Clean up function
        return () => {
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
          intercomLoaded.current = false;
        };
      }
    };

    // Initialize Intercom
    const cleanup = initIntercom();

    // Define helper methods on the window object
    window.openIntercomMessenger = () => {
      if (window.Intercom) {
        window.Intercom('show');
      }
    };

    window.closeIntercomMessenger = () => {
      if (window.Intercom) {
        window.Intercom('hide');
      }
    };

    // Return cleanup function
    return cleanup;
  }, [intercomConfig?.appId]);

  // Update user in Intercom when authentication changes
  useEffect(() => {
    // Only proceed if all required data is available
    if (!intercomConfig?.appId || !user) return;

    // Check if Intercom is loaded
    const intercomAvailable = typeof window.Intercom === 'function';
    if (!intercomAvailable) return;

    // Prepare user data for Intercom
    const userData: any = {
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email,
      user_id: String(user.id),
    };

    // If user is a merchant, add company data
    if (user.role === 'merchant' && user.merchantId) {
      userData.company = {
        id: String(user.merchantId),
        name: user.merchantName || 'Merchant Account',
      };
    }

    // Register user with Intercom
    window.Intercom('update', userData);

    // Also register on the server side for better integration
    apiRequest('POST', '/api/intercom/register-user', {
      name: userData.name,
      email: userData.email,
      userId: user.id,
      merchantId: user.merchantId || null,
      merchantName: user.merchantName,
    }).catch(error => {
      console.error('Failed to register user with Intercom API:', error);
    });
  }, [user, intercomConfig?.appId]);

  return <>{children}</>;
};

export default IntercomProvider;