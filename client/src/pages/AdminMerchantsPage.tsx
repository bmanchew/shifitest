
import React from "react";
import MerchantList from "../components/admin/MerchantList";

const AdminMerchantsPage: React.FC = () => {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Merchants</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all merchants including their name, contact, email, phone, and onboarding status.
          </p>
        </div>
      </div>
      
      <MerchantList />
    </div>
  );
};

export default AdminMerchantsPage;
