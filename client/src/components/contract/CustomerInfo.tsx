
import React from 'react';
import { User } from '@shared/schema';

interface CustomerInfoProps {
  customer: Partial<User> | null;
}

export const CustomerInfo: React.FC<CustomerInfoProps> = ({ customer }) => {
  if (!customer) {
    return <div className="text-gray-500 italic">No customer information available</div>;
  }

  const fullName = (() => {
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName} ${customer.lastName}`;
    } else if (customer.name) {
      return customer.name;
    }
    return 'Unknown Customer';
  })();

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-gray-600">Name:</span>
        <span className="font-medium">{fullName}</span>
      </div>
      {customer.email && (
        <div className="flex justify-between">
          <span className="text-gray-600">Email:</span>
          <span className="font-medium">{customer.email}</span>
        </div>
      )}
      {customer.phone && (
        <div className="flex justify-between">
          <span className="text-gray-600">Phone:</span>
          <span className="font-medium">{customer.phone}</span>
        </div>
      )}
    </div>
  );
};

export default CustomerInfo;
