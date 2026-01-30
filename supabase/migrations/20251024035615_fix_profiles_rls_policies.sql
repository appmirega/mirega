/*
  # Fix RLS Policies for Profiles Table
  
  1. Changes
    - Drop existing policies that cause infinite recursion
    - Create new simplified policies that don't query the profiles table recursively
    - Use auth.jwt() to check user role from metadata instead
  
  2. Security
    - Users can view and update their own profile
    - Admins and developers can manage all profiles (role stored in jwt metadata)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Developers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Developers and admins can manage profiles" ON profiles;

-- Create new non-recursive policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = id) OR
    (auth.jwt()->>'role' = 'admin') OR
    (auth.jwt()->>'role' = 'developer')
  );

CREATE POLICY "Admins can manage profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'admin') OR
    (auth.jwt()->>'role' = 'developer')
  );

CREATE POLICY "Allow profile creation"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
