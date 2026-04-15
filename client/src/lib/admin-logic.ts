import { supabase } from './supabase';

export const adminService = {
  // Check if current user is admin in this conversation
  async checkAdminStatus(convoId, userId) {
    const { data } = await supabase
      .from('participants')
      .select('is_admin')
      .eq('conversation_id', convoId)
      .eq('user_id', userId)
      .single();
    return data?.is_admin || false;
  },

  // Hard delete a message (Admin only)
  async deleteMessage(messageId) {
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true, content: '[Message deleted by Admin]' })
      .eq('id', messageId);
    return !error;
  }
};
