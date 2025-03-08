
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon, RefreshCw, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function CreditCheckSchedule() {
  const [date, setDate] = useState<Date>();
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  // Fetch monitoring schedule
  const { data: schedule, isLoading } = useQuery({
    queryKey: ["/api/admin/reports/monitoring-schedule"],
    queryFn: async () => {
      const response = await fetch("/api/admin/reports/monitoring-schedule");
      if (!response.ok) {
        throw new Error("Failed to fetch monitoring schedule");
      }
      return response.json();
    },
  });

  // Mutation to update schedule
  const updateScheduleMutation = useMutation({
    mutationFn: async (nextDate: Date) => {
      const response = await fetch("/api/admin/reports/monitoring-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nextCreditCheckDate: nextDate,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update schedule");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast.success("Credit check schedule updated");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/monitoring-schedule"] });
    },
    onError: (error) => {
      toast.error(`Failed to update schedule: ${error.message}`);
    }
  });

  // Mutation to run credit checks
  const runCreditChecksMutation = useMutation({
    mutationFn: async () => {
      setIsRunning(true);
      const response = await fetch("/api/admin/reports/run-portfolio-monitoring", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "credit-checks",
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to run credit checks");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Credit checks completed: ${data.data.success} successful, ${data.data.failed} failed`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/monitoring-schedule"] });
      setIsRunning(false);
    },
    onError: (error) => {
      toast.error(`Failed to run credit checks: ${error.message}`);
      setIsRunning(false);
    }
  });

  const handleSchedule = () => {
    if (date) {
      updateScheduleMutation.mutate(date);
    }
  };

  const handleRunNow = () => {
    runCreditChecksMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Check Schedule</CardTitle>
          <CardDescription>Loading schedule...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const lastRunDate = schedule?.data?.lastCreditCheckDate ? new Date(schedule.data.lastCreditCheckDate) : null;
  const nextRunDate = schedule?.data?.nextCreditCheckDate ? new Date(schedule.data.nextCreditCheckDate) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Check Schedule</CardTitle>
        <CardDescription>Schedule regular soft credit pulls via Pre-Fi</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <span>Last run:</span>
            <span className="text-muted-foreground">
              {lastRunDate ? format(lastRunDate, "PPP") : "Never"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Next scheduled run:</span>
            <span className="text-muted-foreground">
              {nextRunDate ? format(nextRunDate, "PPP") : "Not scheduled"}
            </span>
          </div>
          <div className="pt-4">
            <p className="text-sm mb-2">Update next scheduled run:</p>
            <div className="flex space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button onClick={handleSchedule} disabled={!date}>
                <Check className="mr-2 h-4 w-4" />
                Schedule
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={handleRunNow}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Run Credit Checks Now
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
