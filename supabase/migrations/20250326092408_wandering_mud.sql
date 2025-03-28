/*
  # Initial Schema Setup

  1. Tables
    - profiles
      - id (uuid, references auth.users)
      - username (text)
      - avatar_url (text)
      - created_at (timestamp)
    - stories
      - id (uuid)
      - user_id (uuid, references profiles)
      - content (text)
      - created_at (timestamp)
    - chats
      - id (uuid)
      - sender_id (uuid, references profiles)
      - receiver_id (uuid, references profiles)
      - message (text)
      - created_at (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  username text UNIQUE,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Create stories table
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles NOT NULL,
  receiver_id uuid REFERENCES profiles NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Stories policies
CREATE POLICY "Users can read all stories"
  ON stories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own stories"
  ON stories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Chats policies
CREATE POLICY "Users can read their own chats"
  ON chats FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);