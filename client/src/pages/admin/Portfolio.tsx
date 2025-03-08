
import AdminLayout from "@/components/layout/AdminLayout";
import PortfolioHealth from "@/components/admin/PortfolioHealth";
import ComplaintTrends from "@/components/admin/ComplaintTrends";
import UnderwritingRecommendations from "@/components/admin/UnderwritingRecommendations";
import CreditCheckSchedule from "@/components/admin/CreditCheckSchedule";
import AssetVerificationSchedule from "@/components/admin/AssetVerificationSchedule";

export default function PortfolioPage() {
  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0 mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Portfolio Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Comprehensive portfolio analysis and risk management tools
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <CreditCheckSchedule />
          <AssetVerificationSchedule />
        </div>

        <div className="space-y-6">
          <PortfolioHealth />
          <ComplaintTrends />
          <UnderwritingRecommendations />
        </div>
      </div>
    </AdminLayout>
  );
}
