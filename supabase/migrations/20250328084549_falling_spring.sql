/*
  # Add Chat Image Support

  1. Changes
    - Add image_url column to chats table
    - Create storage bucket for chat images
    - Add storage policies for chat images

  2. Security
    - Enable secure image uploads for authenticated users
    - Allow viewing of chat images by chat participants
*/

-- Add image_url to chats
ALTER TABLE chats ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name)
VALUES ('chat-images', 'chat-images')
ON CONFLICT DO NOTHING;

-- Storage bucket policies
CREATE POLICY "Authenticated users can upload chat images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Chat participants can view images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-images' AND
    EXISTS (
      SELECT 1 FROM chats
      WHERE (sender_id = auth.uid() OR receiver_id = auth.uid())
      AND image_url LIKE '%' || name || '%'
    )
  );