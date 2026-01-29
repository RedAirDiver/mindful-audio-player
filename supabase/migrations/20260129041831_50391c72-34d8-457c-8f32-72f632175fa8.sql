-- Add storage policies for audio-files bucket

-- Allow admins to upload files
CREATE POLICY "Admins can upload audio files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio-files' 
  AND has_role(auth.uid(), 'admin')
);

-- Allow admins to update files
CREATE POLICY "Admins can update audio files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'audio-files' 
  AND has_role(auth.uid(), 'admin')
);

-- Allow admins to delete files
CREATE POLICY "Admins can delete audio files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio-files' 
  AND has_role(auth.uid(), 'admin')
);

-- Allow admins to view all files in the bucket
CREATE POLICY "Admins can view audio files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio-files' 
  AND has_role(auth.uid(), 'admin')
);

-- Allow users who purchased the program to access the audio file
-- This requires checking purchases table
CREATE POLICY "Purchasers can access audio files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio-files'
  AND EXISTS (
    SELECT 1 FROM public.audio_files af
    JOIN public.purchases p ON p.program_id = af.program_id
    WHERE p.user_id = auth.uid()
    AND af.file_path = name
  )
);