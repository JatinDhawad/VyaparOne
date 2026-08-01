'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

export default function Home() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [token, router]);

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
      <div className="flex items-center gap-3 text-indigo-400 font-semibold text-sm">
        <span className="h-3 w-3 rounded-full bg-indigo-500 animate-ping" />
        Redirecting to VyaparOne ERP...
      </div>
    </div>
  );
}
