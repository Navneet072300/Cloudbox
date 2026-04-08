'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from '@/components/drive/sidebar';
import { UploadQueue } from '@/components/drive/uploadqueue';
import { useSync } from '@/hooks/useSync';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router   = useRouter();
  useSync();

  useEffect(() => {
    if (!user) router.replace('/login');
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
      <UploadQueue />
    </div>
  );
}
