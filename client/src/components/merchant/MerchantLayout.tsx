import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard,
  FileText, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  X,
  LogOut,
  BarChartBig,
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { 
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MerchantLayoutProps {
  children: React.ReactNode;
}

export default function MerchantLayout({ children }: MerchantLayoutProps) {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check if the sidebar state is stored in localStorage
    const storedCollapsed = localStorage.getItem("merchantSidebarCollapsed");
    if (storedCollapsed !== null) {
      setIsCollapsed(storedCollapsed === "true");
    }
    
    // Close mobile menu when location changes
    setIsMobileMenuOpen(false);
  }, [location]);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("merchantSidebarCollapsed", String(newState));
  };

  // Query to get user profile data
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ["/api/user/profile"],
    queryFn: async () => {
      const response = await fetch("/api/user/profile");
      if (!response.ok) {
        throw new Error("Failed to load user profile");
      }
      return response.json();
    },
  });

  // Also fetch merchant specific data
  const { data: merchantData, isLoading: isLoadingMerchant } = useQuery({
    queryKey: ["/api/merchants/current"],
    queryFn: async () => {
      const response = await fetch("/api/merchants/current");
      if (!response.ok) {
        throw new Error("Failed to load merchant data");
      }
      return response.json();
    },
  });

  // Get number of unread messages to display badge (if any)
  const { data: messagesData } = useQuery({
    queryKey: ["/api/conversations/merchant/unread-count"],
    queryFn: async () => {
      const response = await fetch("/api/conversations/merchant/unread-count");
      if (!response.ok) {
        throw new Error("Failed to load unread messages count");
      }
      return response.json();
    },
  });

  const unreadMessagesCount = messagesData?.count || 0;
  
  const merchant = merchantData?.merchant;
  const user = userData?.user;
  
  // Navigation items
  const navigationItems = [
    {
      name: "Dashboard",
      href: "/merchant/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
      current: location === "/merchant/dashboard",
    },
    {
      name: "Contracts",
      href: "/merchant/contracts",
      icon: <FileText className="h-5 w-5" />,
      current: location.startsWith("/merchant/contracts"),
    },
    {
      name: "Reports",
      href: "/merchant/reports",
      icon: <BarChartBig className="h-5 w-5" />,
      current: location === "/merchant/reports",
    },
    {
      name: "Messages",
      href: "/merchant/messages",
      icon: <MessageCircle className="h-5 w-5" />,
      current: location.startsWith("/merchant/messages"),
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    },
    {
      name: "Settings",
      href: "/merchant/settings",
      icon: <Settings className="h-5 w-5" />,
      current: location === "/merchant/settings",
    },
  ];

  // Function to handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      
      if (response.ok) {
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Desktop Sidebar */}
      <div
        className={`hidden md:flex h-full flex-col border-r bg-white transition-all duration-300 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/merchant/dashboard" className="flex items-center space-x-2">
            {!isCollapsed && (
              <img src="/logo3.png" alt="Logo" className="h-6" />
            )}
            {isCollapsed && (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  SF
                </AvatarFallback>
              </Avatar>
            )}
          </Link>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto py-2">
          <nav className="grid gap-1 px-2">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                  item.current
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                } ${isCollapsed ? "justify-center" : "justify-start"}`}
              >
                <div className="relative">
                  {item.icon}
                  {item.badge && (
                    <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </div>
                  )}
                </div>
                {!isCollapsed && <span className="ml-3">{item.name}</span>}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t p-2">
          <div
            className={`flex items-center ${
              isCollapsed ? "justify-center" : "justify-between"
            } py-2`}
          >
            {!isCollapsed && (
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user?.firstName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {user?.firstName
                      ? `${user.firstName} ${user.lastName || ""}`
                      : merchant?.businessName || "Merchant"}
                  </p>
                  <p className="text-xs text-gray-500 truncate max-w-[160px]">
                    {user?.email || ""}
                  </p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size={isCollapsed ? "icon" : "sm"}
              onClick={handleLogout}
              className={isCollapsed ? "h-8 w-8" : ""}
            >
              {isCollapsed ? (
                <LogOut className="h-4 w-4" />
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Header & Menu */}
      <div className="fixed inset-x-0 top-0 z-50 h-14 border-b bg-white md:hidden">
        <div className="flex h-full items-center justify-between px-4">
          <Link href="/merchant/dashboard" className="flex items-center space-x-2">
            <img src="/logo3.png" alt="Logo" className="h-6" />
          </Link>
          
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-14 items-center border-b px-4">
                <Link href="/merchant/dashboard" className="flex items-center space-x-2">
                  <img src="/logo3.png" alt="Logo" className="h-6" />
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-8 w-8"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="py-2">
                <nav className="grid gap-1 px-2">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                        item.current
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <div className="relative">
                        {item.icon}
                        {item.badge && (
                          <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                            {item.badge > 99 ? "99+" : item.badge}
                          </div>
                        )}
                      </div>
                      <span className="ml-3">{item.name}</span>
                    </Link>
                  ))}
                </nav>
              </div>
              
              <div className="mt-auto border-t p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user?.firstName?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {user?.firstName
                          ? `${user.firstName} ${user.lastName || ""}`
                          : merchant?.businessName || "Merchant"}
                      </p>
                      <p className="text-xs text-gray-500 truncate max-w-[160px]">
                        {user?.email || ""}
                      </p>
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}