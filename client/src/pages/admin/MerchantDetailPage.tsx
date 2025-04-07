import React from 'react';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import MerchantDetail from '@/components/admin/MerchantDetail';

export default function MerchantDetailPage() {
  const { id } = useParams();
  const merchantId = id ? parseInt(id) : 0;

  if (!merchantId) {
    return (
      <div className="container mx-auto py-10 text-center">
        <h1 className="text-2xl font-bold text-red-500">Invalid Merchant ID</h1>
        <p className="mt-4">The merchant ID is missing or invalid.</p>
        <Link to="/admin/merchants">
          <Button variant="link" className="mt-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Merchant List
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link to="/admin/merchants">
          <Button variant="outline" size="sm" className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Merchants
          </Button>
        </Link>
      </div>
      
      <MerchantDetail merchantId={merchantId} />
    </div>
  );
}