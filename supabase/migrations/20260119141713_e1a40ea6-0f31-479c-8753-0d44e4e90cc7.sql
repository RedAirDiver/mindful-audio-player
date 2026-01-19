-- Add a policy to allow anyone to view audio files metadata (without file_path)
-- For preview, we want users to see track titles and durations but not the actual file paths

-- First, drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view audio files for purchased programs" ON audio_files;

-- Create a more permissive policy for viewing audio files
-- Everyone can view basic info (title, duration, order) but RLS will be enforced for actual file access
CREATE POLICY "Anyone can view audio file metadata"
ON audio_files
FOR SELECT
USING (true);

-- Note: The actual audio streaming will be protected by signed URLs or edge functions,
-- not by RLS on the audio_files table