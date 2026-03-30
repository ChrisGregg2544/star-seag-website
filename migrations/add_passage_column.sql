-- Migration: add passage column to questions table
-- Run this in the Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/iutcgogmxhaqgaxkznxu/sql/new

ALTER TABLE questions ADD COLUMN IF NOT EXISTS passage text;
