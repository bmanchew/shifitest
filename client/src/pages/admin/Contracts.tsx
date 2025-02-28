import AdminLayout from "@/components/layout/AdminLayout";
import ContractList from "@/components/admin/ContractList";

export default function Contracts() {
  return (
    <AdminLayout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <ContractList />
        </div>
      </div>
    </AdminLayout>
  );
}
