INSERT INTO categories (name, slug, sort_order) VALUES
  ('Utländska Program', 'utlandska-program', 7),
  ('Företag & Ledarskap', 'foretag-ledarskap', 8)
ON CONFLICT DO NOTHING;