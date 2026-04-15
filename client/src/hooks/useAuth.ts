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
        const res = await fetch('/api/chat/users');
        const allUsers = await res.json();

        const matchedUser = Array.isArray(allUsers)
          ? allUsers.find((u: any) => u.email && authUser.email && u.email.toLowerCase() === authUser.email.toLowerCase())
          : null;

        if (matchedUser) {
          setUser(matchedUser);
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

  console.log('useAuth user =', user);
  return { user, loading };
}
