import AdminLayout from "@/components/layout/AdminLayout";
import MerchantList from "@/components/admin/MerchantList";

export default function Merchants() {
  return (
    <AdminLayout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <MerchantList />
        </div>
      </div>
    </AdminLayout>
  );
}
