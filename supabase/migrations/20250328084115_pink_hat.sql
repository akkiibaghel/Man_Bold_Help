/*
  # Add Story Visibility Feature

  1. Changes
    - Add is_public column to stories table
    - Update RLS policies for story visibility

  2. Security
    - Modify RLS policies to respect story visibility
*/

-- Add is_public column to stories
ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;

-- Update stories policies
DROP POLICY IF EXISTS "Users can read all stories" ON stories;

CREATE POLICY "Users can read public stories"
  ON stories FOR SELECT
  TO authenticated
  USING (
    is_public = true OR
    auth.uid() = user_id
  );