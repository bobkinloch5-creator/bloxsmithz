-- Global Chat is shared community history, so keep it in Supabase for all devices.
-- Project chat can still expire to limit private workspace data growth.
CREATE OR REPLACE FUNCTION public.purge_old_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.global_chat_reactions
  WHERE message_id NOT IN (SELECT id FROM public.global_chat_messages);

  DELETE FROM public.project_chat_messages
  WHERE created_at < now() - interval '7 days';
END;
$$;
