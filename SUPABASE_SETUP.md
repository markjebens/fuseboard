# Supabase Setup for Fuseboard

## Storage Bucket Configuration

Run this SQL in **Supabase SQL Editor** to fix image loading:

```sql
-- 1. Make the assets bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'assets';

-- 2. Drop old restrictive policies
DROP POLICY IF EXISTS "Users can view their files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files" ON storage.objects;

-- 3. Create public read access (required for images to load in browser)
CREATE POLICY "Public read access for assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'assets');

-- 4. Keep upload restricted to authenticated users
-- (If not already created)
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assets');

-- 5. Users can only delete their own files
DROP POLICY IF EXISTS "Users can delete their files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);
```

## Environment Variables

Make sure these are set in both `.env.local` and Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://nrquawqhiwekdafavzue.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Database Schema

The required tables should already exist from `supabase-schema.sql`. If not, run that file first.

## Troubleshooting

### Images not loading
1. Check if bucket is public: `SELECT * FROM storage.buckets WHERE id = 'assets';`
2. Check policies: `SELECT * FROM pg_policies WHERE tablename = 'objects';`
3. Test URL directly in browser - if you get XML error, policies are wrong

### Canvas not saving
1. Check browser console for errors
2. Verify user is logged in
3. Check `graph_nodes` and `graph_edges` tables have data

