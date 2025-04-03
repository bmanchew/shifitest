import React, { useState } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { TicketSubmissionForm } from "@/components/forms/TicketSubmissionForm";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "@/hooks/use-search-params";
import MerchantLayout from "@/components/layout/MerchantLayout";

export default function CreateSupportTicketPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { getParam } = useSearchParams();
  
  // Get contract ID from URL if provided
  const contractId = getParam("contractId") ? 
    parseInt(getParam("contractId") as string, 10) : null;

  // Navigate back to tickets list
  const navigateBack = () => {
    setLocation("/merchant/support-tickets");
  };

  // Handle successful ticket creation
  const handleTicketCreated = (ticketId: number, ticketNumber: string) => {
    toast({
      title: "Ticket Created",
      description: `Support ticket #${ticketNumber} has been created successfully.`,
    });
    
    // Navigate to the new ticket
    setTimeout(() => {
      setLocation(`/merchant/support-tickets/${ticketId}`);
    }, 1000);
  };

  // If not authenticated as a merchant, show error
  if (!user || user.role !== "merchant") {
    return (
      <MerchantLayout>
        <div className="container py-8">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You must be logged in as a merchant to create support tickets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={navigateBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout>
      <div className="container py-8">
        <div className="flex items-center mb-6">
          <Button variant="outline" onClick={navigateBack} className="mr-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tickets
          </Button>
          <h1 className="text-2xl font-bold">Create Support Ticket</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submit a New Support Request</CardTitle>
            <CardDescription>
              Please provide details about your issue so our support team can assist you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TicketSubmissionForm 
              merchantId={user.merchantId!} 
              onSuccess={handleTicketCreated}
              contractId={contractId}
            />
          </CardContent>
        </Card>
      </div>
    </MerchantLayout>
  );
}