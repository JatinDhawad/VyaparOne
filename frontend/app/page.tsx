'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Read straight from storage: the store is only filled in after the first render.
    let token: string | null = null;
    try {
      token = localStorage.getItem('vyaparone_token');
    } catch {}
    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex items-center gap-3 text-indigo-600 font-semibold text-sm">
        <span className="h-3 w-3 rounded-full bg-indigo-500 animate-ping" />
        Redirecting to VyaparOne ERP...
      </div>
    </div>
  );
}
