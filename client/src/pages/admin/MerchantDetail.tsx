import AdminLayout from "@/components/layout/AdminLayout";
import MerchantDetail from "@/components/admin/MerchantDetail";

export default function MerchantDetailPage() {
  return (
    <AdminLayout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <MerchantDetail />
        </div>
      </div>
    </AdminLayout>
  );
}