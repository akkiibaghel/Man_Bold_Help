/*
  # Add Call Features

  1. New Tables
    - call_signals
      - id (uuid, primary key)
      - from_user (uuid, references profiles)
      - to_user (uuid, references profiles)
      - type (text)
      - signal (text)
      - created_at (timestamp)

  2. Security
    - Enable RLS on new tables
    - Add policies for authenticated users
*/

-- Create call_signals table
CREATE TABLE IF NOT EXISTS call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid REFERENCES profiles ON DELETE CASCADE,
  to_user uuid REFERENCES profiles ON DELETE CASCADE,
  type text NOT NULL,
  signal text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;

-- Call signals policies
CREATE POLICY "Users can read their own call signals"
  ON call_signals FOR SELECT
  TO authenticated
  USING (
    auth.uid() = from_user OR
    auth.uid() = to_user
  );

CREATE POLICY "Users can create call signals"
  ON call_signals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user);

CREATE POLICY "Users can delete their own call signals"
  ON call_signals FOR DELETE
  TO authenticated
  USING (auth.uid() = from_user);