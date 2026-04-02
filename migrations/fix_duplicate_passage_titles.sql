-- Migration: fix duplicate passage titles in P6 comprehension passages
-- Run in Supabase SQL editor:
-- https://supabase.com/dashboard/project/iutcgogmxhaqgaxkznxu/sql/new

-- Four passages all titled "The Clever Little Beaver" — renamed by unique content
UPDATE passages SET title = 'Beavers: Dam Builders'
  WHERE id = '01302b87-4625-43d8-bda0-97a4a2132433';
  -- content: dam as moat protecting kits from predators; wetland habitats; "tiny engineer"

UPDATE passages SET title = 'The Beaver''s Tail Slap'
  WHERE id = 'fb9855b8-dc19-47b4-9034-c1e6365ee198';
  -- content: flat tail as paddle; tail slaps water surface as danger warning

UPDATE passages SET title = 'Nature''s Engineers'
  WHERE id = '96c9b4d1-b925-40bb-8f5f-3c6acfe890cb';
  -- content: winter huddling in lodge; passage uses exact phrase "nature''s engineers"

UPDATE passages SET title = 'The Beaver''s Hidden Door'
  WHERE id = '1e1b34c8-d40f-4098-9c1a-2546581812e2';
  -- content: teeth never stop growing; lodge entrance hidden underwater

-- Two passages titled "The Busy Honeybee" / "The Busy Honey Bee" — renamed by unique content
UPDATE passages SET title = 'The Honeybee''s Pollen Baskets'
  WHERE id = '1c2999ce-0eee-40cd-b4e8-8eea801d1522';
  -- content: pollen sacs on back legs; hive described as "like a busy city"

UPDATE passages SET title = 'The Honeybee''s Winter Store'
  WHERE id = 'e6a3aca5-e039-40dc-8f0e-5af4d1e115b8';
  -- content: honeycomb wax cells; winter honey stores; colony "like a well-oiled machine"
