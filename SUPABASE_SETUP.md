# Supabase setup

1. Create a project at https://supabase.com.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Open Project Settings -> API and copy:
   - Project URL
   - `service_role` secret key
4. Add these variables to local `.env.local` and Vercel Environment Variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-side. Do not expose it as a `NEXT_PUBLIC_` variable and do not commit it to Git.

After adding the variables, redeploy Vercel. New imports, deletes, and image replacements will use Supabase Database and Storage. Existing JSON scenarios can be imported again through `/admin` to seed the database.
