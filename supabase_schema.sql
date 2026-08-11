-- The Lineage Engine — Supabase (Postgres) Database Schema Design

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. CHARACTERS TABLE (Holds Players, NPCs, and Offspring)
create table characters (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  species text not null, -- 'Human' | 'Elf' | 'Dwarf' | 'Orc' | 'Tiefling' | 'Beastfolk'

  -- Physical Traits HSL
  skin_tone_hue integer not null default 25,
  skin_tone_sat integer not null default 50,
  skin_tone_light integer not null default 60,
  hair_color_hue integer not null default 35,
  hair_color_sat integer not null default 60,
  hair_color_light integer not null default 30,
  eye_color_hue integer not null default 200,
  eye_color_sat integer not null default 80,
  eye_color_light integer not null default 50,

  -- Style tags
  hair_style text not null,
  face_shape text not null,
  build text not null,
  marking_style text not null,
  accessory text not null,

  -- Personality Stats (0-100)
  boldness integer not null default 50,
  warmth integer not null default 50,
  wit integer not null default 50,
  ambition integer not null default 50,
  chaos integer not null default 50,

  background text,
  origin text not null, -- 'player' | 'generated' | 'offspring'

  -- Parentage for offspring lineage
  parent_a_id uuid references characters(id) on delete set null,
  parent_b_id uuid references characters(id) on delete set null,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexing for quick relationship queries
create index idx_characters_origin on characters(origin);

-- 2. RELATIONSHIPS TABLE (Tracks metrics between Characters)
create table relationships (
  id uuid primary key default uuid_generate_v4(),
  character_a_id uuid references characters(id) on delete cascade not null,
  character_b_id uuid references characters(id) on delete cascade not null,
  stage text not null default 'Stranger', -- 'Stranger' | 'Acquaintance' | 'Interested' | 'Partner'

  -- Metrics
  affection integer not null default 10,
  trust integer not null default 10,
  attraction integer not null default 10,
  rivalry integer not null default 10,

  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (character_a_id, character_b_id)
);

-- 3. INTERACTION LOGS TABLE (Dialogue and Decision history)
create table interaction_logs (
  id uuid primary key default uuid_generate_v4(),
  relationship_id uuid references relationships(id) on delete cascade not null,
  scene_id text not null,
  choice_made text not null,
  stat_deltas jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
