/*
  # Fix Profiles RLS Policies

  1. Changes
    - Add INSERT policy for profiles table
    - Update SELECT policy to handle profile creation
    - Ensure proper RLS for profile management

  2. Security
    - Allow users to create their own profile
    - Maintain existing read/update policies
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policies
CREATE POLICY "Users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);