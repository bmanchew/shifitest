
import React from 'react';
import UnderwritingDetails from '../admin/UnderwritingDetails';
import MerchantUnderwritingView from '../merchant/MerchantUnderwritingView';

interface UnderwritingViewFactoryProps {
  userRole: string;
  contractId: number;
}

const UnderwritingViewFactory: React.FC<UnderwritingViewFactoryProps> = ({ userRole, contractId }) => {
  // Display full details for admins, limited view for merchants and others
  if (userRole === 'admin') {
    return <UnderwritingDetails contractId={contractId} />;
  } else {
    return <MerchantUnderwritingView contractId={contractId} />;
  }
};

export default UnderwritingViewFactory;
