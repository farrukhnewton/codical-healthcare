import React, { useState, useEffect } from 'react';
import { Bell, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const NotificationBell = ({ userId }) => {
  const [requests, setRequests] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchRequests = async () => {
      const { data } = await supabase
        .from('friend_requests')
        .select('*, sender:users(id, name, avatar_url)')
        .eq('receiver_id', userId)
        .eq('status', 'pending');
      setRequests(data || []);
    };

    fetchRequests();

    const channel = supabase
      .channel('friend-reqs')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'friend_requests',
        filter: `receiver_id=eq.${userId}` 
      }, fetchRequests)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 hover:bg-slate-100 rounded-full relative">
        <Bell size={24} className="text-slate-600" />
        {requests.length > 0 && (
          <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 p-4">
          <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 text-sm uppercase tracking-wider">Friend Requests</h3>
          {requests.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4 italic">No new requests</p>
          ) : (
            requests.map(req => (
              <div key={req.id} className="flex items-center justify-between mb-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-sm font-semibold">{req.sender?.name || 'New Member'}</span>
                <div className="flex gap-2">
                  <button className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 transition shadow-sm"><UserCheck size={16} /></button>
                  <button className="bg-slate-200 text-slate-600 p-1.5 rounded-lg hover:bg-slate-300 transition"><UserX size={16} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
