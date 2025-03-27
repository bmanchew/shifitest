import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TicketSubmissionForm } from "@/components/forms/TicketSubmissionForm";
import { useAuth } from "@/hooks/use-auth";

interface CreateTicketDialogProps {
  contractId: number;
  contractNumber: string;
}

export function CreateTicketDialog({ contractId, contractNumber }: CreateTicketDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  
  // Handle successful ticket submission
  const handleTicketSuccess = (id: number, ticketNumber: string) => {
    // Close the dialog when ticket is successfully submitted
    setOpen(false);
  };

  // We need merchant ID for the form, which we get from the auth hook
  const merchantId = user?.merchantId || 0;

  // Set initial values based on contract
  const initialValues = {
    subject: `Issue with contract #${contractNumber}`,
    description: `I'm experiencing an issue with contract #${contractNumber}. `,
    category: "technical_issue" as "technical_issue" | "accounting" | "customer_issue" | "other",
    priority: "normal" as "normal" | "high" | "low" | "urgent",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Create Support Ticket</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Submit a new support ticket related to contract #{contractNumber}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <TicketSubmissionForm
            merchantId={merchantId}
            onSuccess={handleTicketSuccess}
            initialValues={initialValues}
            contractId={contractId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}