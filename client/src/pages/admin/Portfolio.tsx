import React from 'react';
import AdminLayout from "@/components/layout/AdminLayout";
import PortfolioHealth from "@/components/admin/PortfolioHealth";
import ComplaintTrends from "@/components/admin/ComplaintTrends";
import CreditCheckSchedule from "@/components/admin/CreditCheckSchedule";
import AssetVerificationSchedule from "@/components/admin/AssetVerificationSchedule";
import UnderwritingRecommendations from "@/components/admin/UnderwritingRecommendations";
import MerchantPerformance from "@/components/admin/MerchantPerformance";

export default function Portfolio() {
  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0 mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Portfolio Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor loan portfolio performance and industry trends
          </p>
        </div>

        <div className="space-y-6 px-4 sm:px-0">
          <PortfolioHealth />
          <MerchantPerformance />
          <ComplaintTrends />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CreditCheckSchedule />
            <AssetVerificationSchedule />
          </div>
          <UnderwritingRecommendations />
        </div>
      </div>
    </AdminLayout>
  );
}