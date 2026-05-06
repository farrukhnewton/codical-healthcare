-- Run this once in the Supabase SQL Editor to enable Realtime for chat tables.
-- This only adds tables to the supabase_realtime publication if they are not
-- already enabled.

do $$
declare
  table_name text;
  chat_tables text[] := array[
    'conversations',
    'participants',
    'messages',
    'attachments',
    'message_reactions',
    'friend_requests'
  ];
begin
  foreach table_name in array chat_tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
