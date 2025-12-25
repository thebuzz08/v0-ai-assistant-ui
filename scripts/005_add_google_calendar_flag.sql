-- Add google_calendar_connected column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'google_calendar_connected'
  ) THEN
    ALTER TABLE profiles ADD COLUMN google_calendar_connected BOOLEAN DEFAULT FALSE;
  END IF;
END $$;
