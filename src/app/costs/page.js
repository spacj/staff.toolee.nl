'use client';
import { Suspense } from 'react';
import Layout from '@/components/Layout';
import { Loader2 } from 'lucide-react';
import CostsContent from './costs-content';

// Fallback loading component
function LoadingFallback() {
  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    </Layout>
  );
}

export default function CostsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CostsContent />
    </Suspense>
  );
}
