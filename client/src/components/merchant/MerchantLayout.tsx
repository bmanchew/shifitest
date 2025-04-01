import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  MessageSquare,
  TicketCheck,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface MerchantLayoutProps {
  children: React.ReactNode;
}

export default function MerchantLayout({ children }: MerchantLayoutProps) {
  const [location] = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const { logout } = useAuth(); // Get logout function from auth context

  // Check if we are on mobile screen size
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // Query to get unread messages count
  const { data: unreadMessagesData } = useQuery({
    queryKey: ["/api/communications/merchant/unread-count"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/communications/merchant/unread-count");
        if (!response.ok) {
          return { success: false, unreadCount: 0 };
        }
        return response.json();
      } catch (error) {
        console.error("Error fetching unread messages count:", error);
        return { success: false, unreadCount: 0 };
      }
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const unreadCount = unreadMessagesData?.unreadCount || 0;

  // Navigation items
  const navItems = [
    {
      name: "Dashboard",
      path: "/merchant/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      name: "Contracts",
      path: "/merchant/contracts",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      name: "Payments",
      path: "/merchant/payments",
      icon: <CreditCard className="h-5 w-5" />,
    },
    {
      name: "Reports",
      path: "/merchant/reports",
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      name: "Support Tickets",
      path: "/merchant/support-tickets",
      icon: <TicketCheck className="h-5 w-5" />,
    },
    {
      name: "Messages",
      path: "/merchant/messages",
      icon: <MessageSquare className="h-5 w-5" />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      name: "Settings",
      path: "/merchant/settings",
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  // Create Mobile or Desktop Navigation
  const Navigation = () => (
    <div className="space-y-1 px-3">
      {navItems.map((item) => (
        <Link 
          key={item.name} 
          href={item.path}
          className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
            location === item.path
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-3">
            {item.icon}
            <span>{item.name}</span>
          </div>
          {item.badge !== undefined && (
            <Badge variant="default" className="ml-auto">
              {item.badge}
            </Badge>
          )}
        </Link>
      ))}
      <Button 
        variant="ghost"
        className="flex w-full items-center justify-start gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={() => logout()}
      >
        <LogOut className="h-5 w-5" />
        <span>Logout</span>
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b sticky top-0 z-30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0 pt-10">
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-auto py-4">
                      <Navigation />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            )}

            <Link 
              href="/merchant/dashboard"
              className="flex items-center space-x-2"
            >
              <img src="/logo3.png" alt="ShiFi Logo" className="h-8" />
              <span className="font-bold text-xl">ShiFi</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Merchant Portal</span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        {!isMobile && (
          <aside className="w-64 h-[calc(100vh-4rem)] sticky top-16 border-r shadow-sm overflow-y-auto">
            <div className="p-6">
              <Navigation />
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1">
          <div className="min-h-[calc(100vh-4rem)]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}