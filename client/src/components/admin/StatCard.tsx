import { forwardRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowUp, ArrowDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  linkText?: string;
  linkHref?: string;
  change?: number;
  trend?: "up" | "down" | "neutral";
}

const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  (
    { title, value, icon, iconBgColor, iconColor, linkText, linkHref, change, trend, ...props },
    ref
  ) => {
    return (
      <Card ref={ref} {...props}>
        <CardContent className="p-6">
          <div className="flex items-center mb-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                iconBgColor
              )}
            >
              <div className={iconColor}>{icon}</div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{title}</p>
              <div className="flex items-center">
                <h3 className="mt-1 text-3xl font-semibold text-gray-900">
                  {value}
                </h3>
                {change !== undefined && trend && (
                  <div className={cn(
                    "flex items-center ml-2",
                    trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-gray-500"
                  )}>
                    {trend === "up" ? (
                      <ArrowUp className="h-4 w-4 mr-1" />
                    ) : trend === "down" ? (
                      <ArrowDown className="h-4 w-4 mr-1" />
                    ) : null}
                    <span className="text-sm font-medium">
                      {change > 0 ? "+" : ""}{change}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {linkText && linkHref && (
            <div>
              <Link
                to={linkHref}
                className="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                {linkText}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

StatCard.displayName = "StatCard";

export default StatCard;