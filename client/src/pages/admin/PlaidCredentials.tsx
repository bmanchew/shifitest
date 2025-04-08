import AdminLayout from "@/components/layout/AdminLayout";
import PlaidCredentialsManager from "@/components/admin/PlaidCredentialsManager";

export default function PlaidCredentialsPage() {
  return (
    <AdminLayout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Plaid Credentials Management</h1>
          <p className="text-gray-700 mb-6">
            Manage Plaid API credentials for merchants with integrated Plaid access. 
            These credentials are required for generating asset reports and other Plaid integrations.
          </p>
          <PlaidCredentialsManager />
        </div>
      </div>
    </AdminLayout>
  );
}