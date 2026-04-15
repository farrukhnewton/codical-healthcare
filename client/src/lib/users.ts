import { supabase } from './supabase';

/**
 * Fetches all users from the database.
 * This is used for populating user lists, e.g., for creating new conversations.
 */
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, fullName:full_name, email, avatarUrl:avatar_url');

  if (error) {
    console.error('Error fetching all users:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Fetches a single user by their ID.
 * @param userId The ID of the user to fetch.
 */
export async function getUser(userId: number) {
    const { data, error } = await supabase
    .from('users')
    .select('id, fullName:full_name, email, avatarUrl:avatar_url')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    throw new Error(error.message);
  }

  return data;
}
