-- Fix the category name: remove leading space
UPDATE categories SET name = 'ICC deltagare' WHERE name = ' ICC deltagare';

-- Fix Avspänning: has both "ICC deltagare" and " ICC deltagare" (duplicate with space)
UPDATE programs SET categories = ARRAY['Ecxellent ledarskap', 'ICC deltagare', 'NLP deltagare', 'Populära Produkter', 'Dolda']
WHERE id = '34f302ee-7044-423b-8ada-afc81ea14339';