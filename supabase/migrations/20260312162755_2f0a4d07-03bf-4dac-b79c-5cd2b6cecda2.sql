-- Delete duplicate program_audio_files links (keep the one linked to the oldest audio_file)
DELETE FROM program_audio_files
WHERE audio_file_id IN (
  SELECT af.id FROM audio_files af
  WHERE af.id NOT IN (
    SELECT DISTINCT ON (title, program_id) id
    FROM audio_files
    ORDER BY title, program_id, created_at ASC
  )
  AND EXISTS (
    SELECT 1 FROM (
      SELECT title, program_id, count(*) as cnt 
      FROM audio_files 
      GROUP BY title, program_id 
      HAVING count(*) > 1
    ) dups 
    WHERE dups.title = af.title AND dups.program_id = af.program_id
  )
);

-- Delete duplicate audio_files (keep the oldest)
DELETE FROM audio_files
WHERE id NOT IN (
  SELECT DISTINCT ON (title, program_id) id
  FROM audio_files
  ORDER BY title, program_id, created_at ASC
)
AND EXISTS (
  SELECT 1 FROM (
    SELECT title, program_id, count(*) as cnt 
    FROM audio_files 
    GROUP BY title, program_id 
    HAVING count(*) > 1
  ) dups 
  WHERE dups.title = audio_files.title AND dups.program_id = audio_files.program_id
);