/*
# Add eta_minutes column to requests table
*/
ALTER TABLE requests ADD COLUMN IF NOT EXISTS eta_minutes integer;
