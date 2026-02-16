
-- Add pdf_file_path column to programs table
ALTER TABLE public.programs
ADD COLUMN pdf_file_path TEXT DEFAULT NULL;
