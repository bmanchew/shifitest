import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bell,
  ChevronDown,
  FileText,
  HelpCircle,
  Landmark,
  Layers,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTheme } from "@/hooks/use-theme";

export function InvestorLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { setTheme } = useTheme();
  
  // Fetch user details
  const userQuery = useQuery({
    queryKey: ["/api/users/me"],
    retry: false,
  });
  
  // Fetch notification count
  const notificationsQuery = useQuery({
    queryKey: ["/api/investor/notifications/unread-count"],
    retry: false,
  });
  
  // Close mobile nav when changing location
  useEffect(() => {
    setOpen(false);
  }, [location]);
  
  const userName = userQuery.data?.user?.name || "Investor";
  const userEmail = userQuery.data?.user?.email || "";
  const unreadNotifications = notificationsQuery.data?.count || 0;
  
  const navigationItems = [
    {
      title: "Dashboard",
      href: "/investor",
      icon: <Landmark className="h-5 w-5" />,
      active: location === "/investor" || location === "/investor/",
    },
    {
      title: "Investment Offerings",
      href: "/investor/offerings",
      icon: <BarChart className="h-5 w-5" />,
      active: location.startsWith("/investor/offerings"),
    },
    {
      title: "My Investments",
      href: "/investor/investments",
      icon: <Layers className="h-5 w-5" />,
      active: location.startsWith("/investor/investments") && !location.startsWith("/investor/offerings"),
    },
    {
      title: "Data Room",
      href: "/investor/documents",
      icon: <FileText className="h-5 w-5" />,
      active: location === "/investor/documents",
    },
    {
      title: "Profile",
      href: "/investor/profile",
      icon: <User className="h-5 w-5" />,
      active: location === "/investor/profile",
    },
  ];
  
  // Render the desktop navigation sidebar
  const DesktopNav = () => (
    <div className="hidden lg:flex flex-col w-64 border-r bg-background h-screen fixed">
      <div className="p-6 border-b">
        <Link href="/investor">
          <h1 className="text-xl font-bold tracking-tight">Investor Portal</h1>
        </Link>
      </div>
      
      <div className="flex-1 overflow-auto py-3">
        <nav className="grid gap-1 px-2">
          {navigationItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                  item.active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {item.icon}
                <span>{item.title}</span>
              </a>
            </Link>
          ))}
        </nav>
      </div>
      
      <div className="border-t p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full" asChild>
              <Link href="/investor/profile">
                <div className="relative">
                  <User className="h-5 w-5" />
                </div>
              </Link>
            </Button>
            <div className="text-sm">
              <p className="font-medium">{userName}</p>
              <p className="text-muted-foreground text-xs">{userEmail}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/investor/profile">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/investor/notifications">
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                  {unreadNotifications > 0 && (
                    <Badge className="ml-auto" variant="secondary">
                      {unreadNotifications}
                    </Badge>
                  )}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/investor/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span>Theme</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                      Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                      Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")}>
                      System
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/help">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/auth/logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
  
  // Render the mobile header and navigation menu
  const MobileNav = () => (
    <div className="lg:hidden border-b bg-background sticky top-0 z-10">
      <div className="flex items-center justify-between p-4">
        <Link href="/investor">
          <h1 className="text-xl font-bold tracking-tight">Investor Portal</h1>
        </Link>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/investor/notifications">
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0"
                  variant="destructive"
                >
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Badge>
              )}
            </Link>
          </Button>
          
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="p-6 border-b">
                <SheetTitle className="text-left">Investor Portal</SheetTitle>
              </SheetHeader>
              
              <div className="py-4">
                <nav className="grid gap-1 px-2">
                  {navigationItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <a
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                          item.active
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {item.icon}
                        <span>{item.title}</span>
                      </a>
                    </Link>
                  ))}
                </nav>
              </div>
              
              <div className="border-t mt-auto p-4">
                <div className="flex items-center gap-3">
                  <User className="h-8 w-8 rounded-full border p-1.5" />
                  <div>
                    <p className="font-medium">{userName}</p>
                    <p className="text-muted-foreground text-xs">{userEmail}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button variant="outline" className="w-full" size="sm" asChild>
                    <Link href="/investor/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" size="sm" asChild>
                    <Link href="/auth/logout">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-background">
      {isDesktop ? <DesktopNav /> : <MobileNav />}
      
      <main className={cn("pb-12", isDesktop ? "lg:pl-64" : "")}>
        <div className="container max-w-screen-xl mx-auto p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}