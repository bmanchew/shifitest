import { Suspense } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import AdminAuthDebug from '@/components/admin/AdminAuthDebug';

const AuthDebug = () => {
  return (
    <AdminLayout>
      <Suspense fallback={<div>Loading authentication debug tools...</div>}>
        <AdminAuthDebug />
      </Suspense>
    </AdminLayout>
  );
};

export default AuthDebug;