import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Log } from "@shared/schema";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { AlertCircle, InfoIcon, AlertTriangle, Search, Download } from "lucide-react";

export default function Logs() {
  const [logLevel, setLogLevel] = useState<string>("all");

  const { data: logs = [] } = useQuery<Log[]>({
    queryKey: ["/api/logs"],
  });

  const filteredLogs = logLevel === "all" 
    ? logs 
    : logs.filter(log => log.level === logLevel);

  const getLevelBadgeVariant = (level: string) => {
    switch (level) {
      case "error":
        return "danger";
      case "warn":
        return "warning";
      case "info":
        return "info";
      default:
        return "default";
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      case "warn":
        return <AlertTriangle className="h-4 w-4" />;
      case "info":
        return <InfoIcon className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const columns: ColumnDef<Log>[] = [
    {
      accessorKey: "timestamp",
      header: "Timestamp",
      cell: ({ row }) => {
        const timestamp = row.getValue("timestamp") as string;
        return format(new Date(timestamp), "MMM d, yyyy HH:mm:ss");
      },
    },
    {
      accessorKey: "level",
      header: "Level",
      cell: ({ row }) => {
        const level = row.getValue("level") as string;
        return (
          <Badge variant={getLevelBadgeVariant(level)} className="flex w-min items-center">
            {getLevelIcon(level)}
            <span className="ml-1">{level.toUpperCase()}</span>
          </Badge>
        );
      },
    },
    {
      accessorKey: "message",
      header: "Message",
      cell: ({ row }) => {
        const message = row.getValue("message") as string;
        return (
          <div className="max-w-md truncate" title={message}>
            {message}
          </div>
        );
      },
    },
    {
      accessorKey: "userId",
      header: "User",
      cell: ({ row }) => {
        const userId = row.getValue("userId");
        return userId ? `User ID: ${userId}` : "System";
      },
    },
    {
      accessorKey: "metadata",
      header: "Metadata",
      cell: ({ row }) => {
        const metadata = row.getValue("metadata") as string;
        if (!metadata) return null;
        
        try {
          const parsed = JSON.parse(metadata);
          return (
            <div className="max-w-xs truncate" title={metadata}>
              {Object.keys(parsed).map(key => `${key}: ${parsed[key]}`).join(", ")}
            </div>
          );
        } catch {
          return metadata;
        }
      },
    },
  ];

  return (
    <AdminLayout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">System Logs</h1>
              <p className="mt-1 text-sm text-gray-500">
                View and analyze system activity logs
              </p>
            </div>
            <Button variant="outline" className="flex items-center">
              <Download className="mr-2 h-4 w-4" />
              Export Logs
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
            <div className="relative sm:max-w-xs flex-1">
              <Input
                placeholder="Search logs..."
                className="pl-9"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            <div>
              <Select value={logLevel} onValueChange={setLogLevel}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filteredLogs}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
