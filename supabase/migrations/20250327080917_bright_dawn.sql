/*
  # Add Story Features

  1. New Tables
    - story_likes
      - id (uuid, primary key)
      - story_id (uuid, references stories)
      - user_id (uuid, references profiles)
      - created_at (timestamp)
    - story_comments
      - id (uuid, primary key)
      - story_id (uuid, references stories)
      - user_id (uuid, references profiles)
      - content (text)
      - created_at (timestamp)

  2. Changes
    - Add image_url column to stories table
    - Add storage bucket for story images

  3. Security
    - Enable RLS on new tables
    - Add policies for authenticated users
*/

-- Add image_url to stories
ALTER TABLE stories ADD COLUMN IF NOT EXISTS image_url text;

-- Create story_likes table
CREATE TABLE IF NOT EXISTS story_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES stories ON DELETE CASCADE,
  user_id uuid REFERENCES profiles ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- Create story_comments table
CREATE TABLE IF NOT EXISTS story_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES stories ON DELETE CASCADE,
  user_id uuid REFERENCES profiles ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_comments ENABLE ROW LEVEL SECURITY;

-- Story likes policies
CREATE POLICY "Users can read all story likes"
  ON story_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own likes"
  ON story_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON story_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Story comments policies
CREATE POLICY "Users can read all comments"
  ON story_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own comments"
  ON story_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for story images
INSERT INTO storage.buckets (id, name)
VALUES ('story-images', 'story-images')
ON CONFLICT DO NOTHING;

-- Storage bucket policies
CREATE POLICY "Authenticated users can upload story images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'story-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view story images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'story-images');