-- Run in the Supabase SQL editor. Lets the app delete a feeding (undo a mis-press).
-- Same open trust model as the existing insert/select policies; the delete itself
-- is password-gated in the API route.

create policy "feedings delete" on feedings for delete using (true);
