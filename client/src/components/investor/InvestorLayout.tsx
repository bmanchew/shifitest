import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  BarChart3,
  ChevronDown,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  PieChart,
  Settings,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface InvestorLayoutProps {
  children: ReactNode;
}

export function InvestorLayout({ children }: InvestorLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const navigationItems = [
    {
      name: "Dashboard",
      path: "/investor/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      name: "Investment Offerings",
      path: "/investor/offerings",
      icon: <PieChart className="h-5 w-5" />,
    },
    {
      name: "Documents",
      path: "/investor/documents",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      name: "Profile & KYC",
      path: "/investor/profile",
      icon: <User className="h-5 w-5" />,
    },
  ];

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
    : "IN";

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Link href="/">
              <a className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">
                  ShiFi
                </span>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  Investor Portal
                </span>
              </a>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 p-1.5"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/default-avatar.png" alt={user?.name} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden flex-col items-start lg:flex">
                    <span className="text-sm font-medium">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Investor Account
                    </span>
                  </div>
                  <ChevronDown className="ml-1 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/investor/profile">
                  <a className="w-full">
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                  </a>
                </Link>
                <Link href="/investor/dashboard">
                  <a className="w-full">
                    <DropdownMenuItem>
                      <Home className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </DropdownMenuItem>
                  </a>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="container flex-1 items-start md:grid md:grid-cols-[220px_1fr] md:gap-6 lg:grid-cols-[240px_1fr] lg:gap-10">
        {/* Sidebar navigation */}
        <aside className="fixed top-16 z-30 -ml-2 hidden h-[calc(100vh-4rem)] w-full shrink-0 md:sticky md:block">
          <div className="h-full py-6 pl-2 pr-2 lg:py-8">
            <nav className="flex flex-col gap-2">
              {navigationItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <a
                    className={cn(
                      "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                      location === item.path
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </a>
                </Link>
              ))}
            </nav>

            <Separator className="my-6" />

            <div className="px-3 py-2">
              <h4 className="mb-1 text-sm font-semibold text-foreground">
                Investment Summary
              </h4>
              <div className="grid gap-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Total Invested:</span>
                  <span className="font-medium text-foreground">$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Investments:</span>
                  <span className="font-medium text-foreground">0</span>
                </div>
                <div className="flex justify-between">
                  <span>Expected Returns:</span>
                  <span className="font-medium text-foreground">$0.00</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="relative w-full py-6 lg:py-8">
          {children}
        </main>
      </div>

      {/* Mobile navigation */}
      <div className="fixed bottom-0 z-40 w-full border-t bg-background md:hidden">
        <div className="container flex h-14 items-center justify-between px-4">
          {navigationItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <a
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium",
                  location === item.path
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {item.icon}
                <span>{item.name}</span>
              </a>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}