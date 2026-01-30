-- Remove approval_deadline column from work_orders
-- This field was causing unnecessary complexity without generating automatic alerts or state changes
-- Notifications and client viewing tracking already exist in the system

ALTER TABLE work_orders DROP COLUMN IF EXISTS approval_deadline;
