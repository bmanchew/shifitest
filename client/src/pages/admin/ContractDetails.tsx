
import ContractDetailsComponent from "@/components/contract/ContractDetails";
import AdminLayout from "@/components/layout/AdminLayout";
import { useRoute } from "wouter";

export default function ContractDetails() {
  // Use wouter's useRoute hook instead of react-router-dom's useParams
  const [_, params] = useRoute("/admin/contracts/:contractId");
  const contractId = params?.contractId;
  
  return (
    <AdminLayout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <ContractDetailsComponent contractId={contractId} />
        </div>
      </div>
    </AdminLayout>
  );
}
