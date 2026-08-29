'use client';

import { useEffect, useState } from 'react';

interface AuthUser {
  userId: string;
  email?: string;
  username?: string;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Baca identitas dari cookie `am_buyer_user` (non-httpOnly) — lihat lib/session.ts. */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = getCookie('am_buyer_user');
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  return { user, loading, isLoggedIn: !!user };
}
