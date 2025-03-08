
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { TrendingUp, Award, FileText, CheckCircle } from 'lucide-react';

interface MerchantPerformance {
  grade: string;
  performanceScore: number;
  totalContracts: number;
  activeContracts: number;
  completedContracts: number;
  lastUpdated: string;
}

export default function MerchantPerformanceCard() {
  const { data, isLoading, error } = useQuery<MerchantPerformance>({
    queryKey: ['/api/merchant-performance'],
    queryFn: async () => {
      const res = await fetch('/api/merchant-performance', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch merchant performance data');
      }
      return res.json();
    },
  });

  // Helper function to determine badge color based on grade
  const getGradeColor = (grade: string) => {
    const firstChar = grade.charAt(0);
    switch (firstChar) {
      case 'A':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'B':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'C':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'D':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'F':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Merchant Performance</CardTitle>
          <CardDescription>Your current performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-12 w-12" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Merchant Performance</CardTitle>
          <CardDescription>Your current performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">
            Error loading performance data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Merchant Performance</CardTitle>
        <CardDescription>Your current performance metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-blue-500 mr-2" />
            <div>
              <p className="text-sm text-gray-500">Performance Grade</p>
              <div className="flex items-center">
                <Badge 
                  className={`text-lg font-bold border px-3 py-1 ${getGradeColor(data.grade)}`}
                >
                  {data.grade}
                </Badge>
                <span className="ml-2 text-sm text-gray-500">
                  Score: {Math.round(data.performanceScore)}
                </span>
              </div>
            </div>
          </div>
          <TrendingUp className="h-6 w-6 text-green-500" />
        </div>
        
        <div className="border-t border-gray-200 pt-4 mt-2">
          <p className="text-xs text-gray-500 mb-2">Contract Performance</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 p-2 rounded-md">
              <div className="flex items-center">
                <FileText className="h-4 w-4 text-gray-400 mr-1" />
                <span className="text-xs text-gray-500">Total</span>
              </div>
              <p className="text-lg font-semibold">{data.totalContracts}</p>
            </div>
            <div className="bg-gray-50 p-2 rounded-md">
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 text-blue-400 mr-1" />
                <span className="text-xs text-gray-500">Active</span>
              </div>
              <p className="text-lg font-semibold">{data.activeContracts}</p>
            </div>
            <div className="bg-gray-50 p-2 rounded-md">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-400 mr-1" />
                <span className="text-xs text-gray-500">Completed</span>
              </div>
              <p className="text-lg font-semibold">{data.completedContracts}</p>
            </div>
          </div>
        </div>
        
        <div className="text-xs text-gray-400 mt-4 text-right">
          Last updated: {format(new Date(data.lastUpdated), 'MMM d, yyyy')}
        </div>
      </CardContent>
    </Card>
  );
}
