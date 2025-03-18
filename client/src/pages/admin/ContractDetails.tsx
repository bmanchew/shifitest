
import { ContractDetails as ContractDetailsComponent } from "@/components/contract/ContractDetails";
import AdminLayout from "@/components/layout/AdminLayout";
import { useParams } from "react-router-dom";

export default function ContractDetails() {
  const { contractId } = useParams();
  
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
