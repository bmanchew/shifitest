import MerchantLayout from "@/components/layout/MerchantLayout";
import MerchantFunding from "@/components/merchant/MerchantFunding";

export default function PaymentsPage() {
  // In development, use debug data to make it easier to test
  // In production, this automatically switches to false
  const isDevelopment = import.meta.env.DEV;
  
  return (
    <MerchantLayout>
      <MerchantFunding useDebugData={isDevelopment} />
    </MerchantLayout>
  );
}