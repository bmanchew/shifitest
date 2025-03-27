import MerchantLayout from "@/components/merchant/MerchantLayout";
import MerchantDashboard from "@/components/merchant/MerchantDashboard";

export default function Dashboard() {
  return (
    <MerchantLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Merchant Dashboard</h1>
        <MerchantDashboard />
      </div>
    </MerchantLayout>
  );
}
