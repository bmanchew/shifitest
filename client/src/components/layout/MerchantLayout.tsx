import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  FileText,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
} from "lucide-react";

interface MerchantLayoutProps {
  children: React.ReactNode;
}

export default function MerchantLayout({ children }: MerchantLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/merchant/dashboard",
      icon: LayoutDashboard,
      current: location === "/merchant/dashboard" || location === "/merchant" || location === "/",
    },
    {
      name: "Contracts",
      href: "/merchant/contracts",
      icon: FileText,
      current: location === "/merchant/contracts",
    },
    {
      name: "Reports",
      href: "/merchant/reports",
      icon: BarChart2,
      current: location === "/merchant/reports",
    },
    {
      name: "Settings",
      href: "/merchant/settings",
      icon: Settings,
      current: location === "/merchant/settings",
    },
  ];

  return (
    <div className="flex h-screen flex-col">
      {/* Mobile menu */}
      <div className={`${mobileMenuOpen ? "block" : "hidden"} md:hidden absolute inset-0 z-50 bg-white`}>
        <div className="pt-5 pb-6 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-primary-500 text-white p-2 rounded-md">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className="ml-2 text-xl font-semibold">ShiFi</span>
            </div>
            <div>
              <button
                type="button"
                className="bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
          <div className="mt-6">
            <nav className="grid gap-y-8">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    item.current
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  } -m-3 p-3 flex items-center rounded-md`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon
                    className={`${
                      item.current ? "text-gray-500" : "text-gray-400 group-hover:text-gray-500"
                    } flex-shrink-0 h-6 w-6 mr-3`}
                  />
                  <span className="text-base font-medium">{item.name}</span>
                </Link>
              ))}
              <button
                className="text-gray-600 hover:bg-gray-50 hover:text-gray-900 -m-3 p-3 flex items-center rounded-md"
                onClick={logout}
              >
                <LogOut className="h-6 w-6 mr-3 text-gray-400" />
                <span className="text-base font-medium">Logout</span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Top navigation */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <div className="bg-primary-500 text-white p-2 rounded-md">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <span className="ml-2 text-xl font-semibold">ShiFi</span>
              </div>
              <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigationItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`${
                      item.current
                        ? "border-primary-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <button className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                <span className="sr-only">View notifications</span>
                <Bell className="h-6 w-6" />
              </button>

              <div className="ml-3 relative">
                <div>
                  <Avatar>
                    <AvatarImage src="" />
                    <AvatarFallback>{user?.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
              </div>

              <button
                className="ml-4 text-gray-600 hover:text-gray-900"
                onClick={logout}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
            <div className="-mr-2 flex items-center sm:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                onClick={() => setMobileMenuOpen(true)}
              >
                <span className="sr-only">Open main menu</span>
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto bg-white">
        {children}
      </div>
    </div>
  );
}
