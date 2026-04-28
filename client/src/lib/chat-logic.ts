import { supabase } from './supabase';

export const chatService = {
  // Check if users are friends before chatting
  async canChat(userId: string | number, friendId: string | number) {
    const { data } = await supabase
      .from('friend_requests')
      .select('status')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
      .eq('status', 'accepted')
      .single();
    return !!data;
  },

  // Send a file or message
  async sendMessage(convoId: string | number, senderId: string | number, content: string, type = 'text') {
    return await supabase.from('messages').insert([{
      conversation_id: convoId,
      sender_id: senderId,
      content: content,
      message_type: type
    }]);
  }
};

// Add this to your existing chatService object
export const friendService = {
  async acceptRequest(requestId: string | number) {
    const { data, error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);
    
    // Once accepted, Google Chat logic usually creates the first conversation entry
    return { data, error };
  },

  async getPendingRequests(userId: string | number) {
    return await supabase
      .from('friend_requests')
      .select('*, sender:users(name, avatar_url)')
      .eq('receiver_id', userId)
      .eq('status', 'pending');
  }
};
