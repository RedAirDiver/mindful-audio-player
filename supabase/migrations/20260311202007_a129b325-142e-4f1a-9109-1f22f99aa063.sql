
-- Create junction table for many-to-many relationship between programs and audio files
CREATE TABLE public.program_audio_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  audio_file_id uuid NOT NULL REFERENCES public.audio_files(id) ON DELETE CASCADE,
  track_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, audio_file_id)
);

-- Enable RLS
ALTER TABLE public.program_audio_files ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view program audio mappings" ON public.program_audio_files FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage program audio mappings" ON public.program_audio_files FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing data from audio_files.program_id into junction table
INSERT INTO public.program_audio_files (program_id, audio_file_id, track_order)
SELECT program_id, id, track_order FROM public.audio_files WHERE program_id IS NOT NULL;

-- Make program_id nullable on audio_files (files can now exist independently)
ALTER TABLE public.audio_files ALTER COLUMN program_id DROP NOT NULL;
