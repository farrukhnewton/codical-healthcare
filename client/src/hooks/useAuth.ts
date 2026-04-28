import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolveUser = async (session: any) => {
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
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

        if (res.ok) {
          const appUser = await res.json();
          setUser(appUser);
        } else {
          setUser({
            id: authUser.id,
            fullName: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            email: authUser.email,
            avatarUrl: authUser.user_metadata?.avatar_url || null,
          });
        }
      } catch (err) {
        console.error('Error resolving app user:', err);
        const authUser = session.user;
        setUser({
          id: authUser.id,
          fullName: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          email: authUser.email,
          avatarUrl: authUser.user_metadata?.avatar_url || null,
        });
      }

      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error fetching session:', error);
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

  return { user, loading };
}
