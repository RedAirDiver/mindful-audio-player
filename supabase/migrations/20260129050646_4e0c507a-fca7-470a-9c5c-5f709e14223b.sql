-- Add policy to allow anyone to read audio files for preview playback
-- The 30-second preview limit is enforced in the frontend code
CREATE POLICY "Anyone can access audio files for preview"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'audio-files');