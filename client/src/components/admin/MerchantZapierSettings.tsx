import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MerchantZapierSettingsProps {
  merchantId: number;
}

interface ZapierSettings {
  merchantId: number;
  zapierIntegrationEnabled: boolean | null;
  zapierWebhookUrl: string | null;
  zapierIntegrationSettings: {
    notifyOnNewApplication?: boolean;
    notifyOnStatusChange?: boolean;
    notifyOnContractSigning?: boolean;
    customFields?: Record<string, string>;
  } | null;
}

const defaultSettings: ZapierSettings = {
  merchantId: 0,
  zapierIntegrationEnabled: false,
  zapierWebhookUrl: null,
  zapierIntegrationSettings: {
    notifyOnNewApplication: true,
    notifyOnStatusChange: true,
    notifyOnContractSigning: true,
    customFields: {},
  },
};

export function MerchantZapierSettings({ merchantId }: MerchantZapierSettingsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ZapierSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load settings when component mounts
  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/admin/merchant-zapier/${merchantId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load settings: ${response.statusText}`);
        }
        
        const data = await response.json();
        setSettings(data || defaultSettings);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load Zapier settings';
        setError(errorMessage);
        toast({
          variant: 'destructive',
          title: 'Error loading settings',
          description: errorMessage,
        });
      } finally {
        setLoading(false);
      }
    }
    
    if (merchantId) {
      loadSettings();
    }
  }, [merchantId, toast]);

  // Save settings
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const data = {
        zapierIntegrationEnabled: settings.zapierIntegrationEnabled,
        zapierWebhookUrl: settings.zapierWebhookUrl,
        zapierIntegrationSettings: settings.zapierIntegrationSettings,
      };
      
      const response = await fetch(`/api/admin/merchant-zapier/${merchantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      setSettings(responseData || settings);
      toast({
        title: 'Settings saved',
        description: 'Zapier integration settings have been updated successfully.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save Zapier settings';
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Error saving settings',
        description: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  // Test Zapier integration
  const handleTest = async () => {
    if (!settings.zapierIntegrationEnabled || !settings.zapierWebhookUrl) {
      setError('Zapier integration must be enabled and webhook URL configured before testing');
      return;
    }
    
    setTesting(true);
    setError(null);
    setTestResult(null);
    
    try {
      const response = await fetch(`/api/admin/merchant-zapier/${merchantId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to test: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      setTestResult(responseData || { success: false, message: 'No response from server' });
      
      if (responseData?.success) {
        toast({
          title: 'Test successful',
          description: 'Successfully sent test data to Zapier webhook.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Test failed',
          description: responseData?.message || 'Failed to send test data to Zapier webhook.',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test Zapier integration';
      setError(errorMessage);
      setTestResult({ success: false, message: errorMessage });
      toast({
        variant: 'destructive',
        title: 'Test failed',
        description: errorMessage,
      });
    } finally {
      setTesting(false);
    }
  };

  // Handle toggle changes
  const handleToggleChange = (checked: boolean) => {
    setSettings({
      ...settings,
      zapierIntegrationEnabled: checked,
    });
  };

  // Handle webhook URL changes
  const handleWebhookUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      zapierWebhookUrl: e.target.value,
    });
  };

  // Handle notification toggle changes
  const handleNotificationToggleChange = (setting: string, checked: boolean) => {
    setSettings({
      ...settings,
      zapierIntegrationSettings: {
        ...settings.zapierIntegrationSettings,
        [setting]: checked,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2">Loading settings...</span>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Zapier Integration Settings</CardTitle>
        <CardDescription>
          Configure Zapier integration for this merchant to route application data to external systems.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {testResult && (
          <Alert variant={testResult.success ? 'default' : 'destructive'} className="mb-4">
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>{testResult.success ? 'Test Successful' : 'Test Failed'}</AlertTitle>
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="zapier-toggle" className="font-medium">
                  Enable Zapier Integration
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, application data will be sent to Zapier instead of using SMS.
                </p>
              </div>
              <Switch
                id="zapier-toggle"
                checked={!!settings.zapierIntegrationEnabled}
                onCheckedChange={handleToggleChange}
              />
            </div>
            
            <div className="space-y-2 py-2">
              <Label htmlFor="webhook-url">Zapier Webhook URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={settings.zapierWebhookUrl || ''}
                onChange={handleWebhookUrlChange}
                disabled={!settings.zapierIntegrationEnabled}
              />
              <p className="text-xs text-muted-foreground">
                Enter the webhook URL provided by your Zapier Zap. This URL will receive application data.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="notifications" className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="notify-new-application" className="font-medium">
                  New Applications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Send notification when a new application is submitted
                </p>
              </div>
              <Switch
                id="notify-new-application"
                checked={!!settings.zapierIntegrationSettings?.notifyOnNewApplication}
                onCheckedChange={(checked) => handleNotificationToggleChange('notifyOnNewApplication', checked)}
                disabled={!settings.zapierIntegrationEnabled}
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="notify-status-change" className="font-medium">
                  Status Changes
                </Label>
                <p className="text-sm text-muted-foreground">
                  Send notification when application status changes
                </p>
              </div>
              <Switch
                id="notify-status-change"
                checked={!!settings.zapierIntegrationSettings?.notifyOnStatusChange}
                onCheckedChange={(checked) => handleNotificationToggleChange('notifyOnStatusChange', checked)}
                disabled={!settings.zapierIntegrationEnabled}
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="notify-contract-signing" className="font-medium">
                  Contract Signing
                </Label>
                <p className="text-sm text-muted-foreground">
                  Send notification when contract is signed
                </p>
              </div>
              <Switch
                id="notify-contract-signing"
                checked={!!settings.zapierIntegrationSettings?.notifyOnContractSigning}
                onCheckedChange={(checked) => handleNotificationToggleChange('notifyOnContractSigning', checked)}
                disabled={!settings.zapierIntegrationEnabled}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleTest} 
          disabled={!settings.zapierIntegrationEnabled || !settings.zapierWebhookUrl || testing}
        >
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Test Connection
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </CardFooter>
    </Card>
  );
}

export default MerchantZapierSettings;