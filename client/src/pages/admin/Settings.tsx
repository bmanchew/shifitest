import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, RefreshCw } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = (section: string) => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Settings Saved",
        description: `${section} settings have been updated successfully.`,
      });
    }, 1000);
  };

  return (
    <AdminLayout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage application settings and configurations
              </p>
            </div>
          </div>

          <Tabs defaultValue="general">
            <TabsList className="mb-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="integration">Integrations</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>
            
            {/* General Settings */}
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>
                    Configure general application settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input id="companyName" defaultValue="ShiFi Inc." />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="supportEmail">Support Email</Label>
                      <Input id="supportEmail" type="email" defaultValue="support@shifi.com" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="defaultTermMonths">Default Term Length (Months)</Label>
                      <Input id="defaultTermMonths" type="number" defaultValue="24" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="defaultInterestRate">Default Interest Rate (%)</Label>
                      <Input id="defaultInterestRate" type="number" step="0.01" defaultValue="0" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="defaultDownPaymentPercent">Default Down Payment (%)</Label>
                      <Input id="defaultDownPaymentPercent" type="number" step="0.01" defaultValue="15" />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="maintenanceMode">Maintenance Mode</Label>
                        <p className="text-sm text-gray-500">Temporarily disable the application for maintenance</p>
                      </div>
                      <Switch id="maintenanceMode" />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => handleSave("General")} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            {/* Integration Settings */}
            <TabsContent value="integration">
              <Card>
                <CardHeader>
                  <CardTitle>Integration Settings</CardTitle>
                  <CardDescription>
                    Configure third-party service integrations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">DiDit KYC Integration</h3>
                    <div className="space-y-2">
                      <Label htmlFor="diditApiKey">DiDit API Key</Label>
                      <Input id="diditApiKey" type="password" defaultValue="••••••••••••••••" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diditEnvironment">Environment</Label>
                      <Select defaultValue="sandbox">
                        <SelectTrigger id="diditEnvironment">
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sandbox">Sandbox</SelectItem>
                          <SelectItem value="production">Production</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <h3 className="text-lg font-medium pt-4">Plaid Integration</h3>
                    <div className="space-y-2">
                      <Label htmlFor="plaidClientId">Plaid Client ID</Label>
                      <Input id="plaidClientId" defaultValue="client_id_12345" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plaidSecret">Plaid Secret</Label>
                      <Input id="plaidSecret" type="password" defaultValue="••••••••••••••••" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plaidEnvironment">Environment</Label>
                      <Select defaultValue="sandbox">
                        <SelectTrigger id="plaidEnvironment">
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sandbox">Sandbox</SelectItem>
                          <SelectItem value="development">Development</SelectItem>
                          <SelectItem value="production">Production</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <h3 className="text-lg font-medium pt-4">Thanks Roger E-Signature</h3>
                    <div className="space-y-2">
                      <Label htmlFor="thanksRogerApiKey">Thanks Roger API Key</Label>
                      <Input id="thanksRogerApiKey" type="password" defaultValue="••••••••••••••••" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="testMode">Test Mode</Label>
                        <p className="text-sm text-gray-500">Send test signatures that don't count as legal documents</p>
                      </div>
                      <Switch id="testMode" defaultChecked />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => handleSave("Integration")} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            {/* Notification Settings */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>
                    Configure how and when notifications are sent
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Email Notifications</h3>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>New Contract Created</Label>
                        <p className="text-sm text-gray-500">Send notification when a new contract is created</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Contract Status Changed</Label>
                        <p className="text-sm text-gray-500">Send notification when a contract status changes</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Payment Reminders</Label>
                        <p className="text-sm text-gray-500">Send payment reminder notifications</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <h3 className="text-lg font-medium pt-4">SMS Notifications</h3>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Payment Reminders</Label>
                        <p className="text-sm text-gray-500">Send SMS payment reminders to customers</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Application Status Updates</Label>
                        <p className="text-sm text-gray-500">Send SMS updates when application status changes</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="smsProvider">SMS Provider</Label>
                      <Select defaultValue="twilio">
                        <SelectTrigger id="smsProvider">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="twilio">Twilio</SelectItem>
                          <SelectItem value="vonage">Vonage</SelectItem>
                          <SelectItem value="messagebird">MessageBird</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="smsApiKey">SMS API Key</Label>
                      <Input id="smsApiKey" type="password" defaultValue="••••••••••••••••" />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => handleSave("Notification")} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            {/* Security Settings */}
            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Configure security and access controls
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-sm text-gray-500">Require 2FA for all admin users</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Password Expiration</Label>
                        <p className="text-sm text-gray-500">Force password reset every 90 days</p>
                      </div>
                      <Switch />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                      <Input id="sessionTimeout" type="number" defaultValue="60" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                      <Input id="maxLoginAttempts" type="number" defaultValue="5" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="ipWhitelist">IP Whitelist (Optional)</Label>
                      <Input id="ipWhitelist" placeholder="Comma-separated list of IP addresses" />
                      <p className="text-sm text-gray-500 mt-1">
                        Leave empty to allow all IP addresses
                      </p>
                    </div>
                    
                    <h3 className="text-lg font-medium pt-4">Data Retention</h3>
                    <div className="space-y-2">
                      <Label htmlFor="logRetentionDays">Log Retention Period (days)</Label>
                      <Input id="logRetentionDays" type="number" defaultValue="365" />
                    </div>
                    
                    <Button variant="destructive" className="mt-2">
                      Purge Expired Logs
                    </Button>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => handleSave("Security")} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminLayout>
  );
}
