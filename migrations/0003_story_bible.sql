-- Story Bible 2.0: field-level spoiler reveals, typed relationships and chapter locations.
ALTER TABLE places ADD COLUMN region TEXT DEFAULT '';
ALTER TABLE places ADD COLUMN parent_place_id INTEGER REFERENCES places(id) ON DELETE SET NULL;
ALTER TABLE places ADD COLUMN atmosphere TEXT DEFAULT '';
ALTER TABLE places ADD COLUMN population TEXT DEFAULT '';
ALTER TABLE places ADD COLUMN dangers TEXT DEFAULT '';
ALTER TABLE places ADD COLUMN rules TEXT DEFAULT '';
ALTER TABLE places ADD COLUMN residents TEXT DEFAULT '';

ALTER TABLE objects ADD COLUMN owner_current TEXT DEFAULT '';
ALTER TABLE objects ADD COLUMN previous_owners TEXT DEFAULT '';
ALTER TABLE objects ADD COLUMN current_location TEXT DEFAULT '';
ALTER TABLE objects ADD COLUMN origin TEXT DEFAULT '';
ALTER TABLE objects ADD COLUMN creator TEXT DEFAULT '';
ALTER TABLE objects ADD COLUMN powers TEXT DEFAULT '';
ALTER TABLE objects ADD COLUMN limitations TEXT DEFAULT '';
ALTER TABLE objects ADD COLUMN condition TEXT DEFAULT '';
ALTER TABLE objects ADD COLUMN history TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS lore_field_reveals (
  entity_type TEXT NOT NULL CHECK(entity_type IN ('character','place','object')),
  entity_id INTEGER NOT NULL,
  field_key TEXT NOT NULL,
  reveal_chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  PRIMARY KEY (entity_type, entity_id, field_key)
);
CREATE INDEX IF NOT EXISTS idx_lore_reveals_chapter ON lore_field_reveals(reveal_chapter_id);

CREATE TABLE IF NOT EXISTS lore_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK(source_type IN ('character','place','object')),
  source_id INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('character','place','object')),
  target_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  reveal_chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(NOT (source_type = target_type AND source_id = target_id))
);
CREATE INDEX IF NOT EXISTS idx_lore_relationships_book ON lore_relationships(book_id);
CREATE INDEX IF NOT EXISTS idx_lore_relationships_source ON lore_relationships(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_lore_relationships_target ON lore_relationships(target_type, target_id);

CREATE TABLE IF NOT EXISTS lore_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('character','object')),
  entity_id INTEGER NOT NULL,
  place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
  location_note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(book_id, chapter_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_lore_locations_chapter ON lore_locations(book_id, chapter_id);
