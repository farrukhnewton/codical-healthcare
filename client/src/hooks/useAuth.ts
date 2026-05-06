import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveUser = async (session: any) => {
      if (!session?.user) {
        setUser(null);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setError(null);
        const authUser = session.user;
        const res = await fetch('/api/chat/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supabaseId: authUser.id,
            email: authUser.email,
            fullName: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            avatarUrl: authUser.user_metadata?.avatar_url || null,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message || 'Unable to prepare chat user');
        }

        const appUser = await res.json();
        setUser(appUser);
      } catch (err) {
        console.error('Error resolving app user:', err);
        setUser(null);
        setError(err instanceof Error ? err.message : 'Unable to prepare chat user');
      }

      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error fetching session:', error);
        setError(error.message || 'Unable to load auth session');
        setLoading(false);
        return;
      }
      resolveUser(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveUser(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, error };
}
