-- Fix: The calculate_session_duration trigger unconditionally sets session_ended = true
-- when logout_timestamp is set, but browser-close events intentionally set session_ended = false
-- to distinguish "Browser Closed" from "Explicit Logout".
--
-- Updated trigger: only set session_ended = true if the client didn't explicitly set it to false.

CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS trigger AS $$
BEGIN
  IF NEW.logout_timestamp IS NOT NULL AND OLD.logout_timestamp IS NULL THEN
    NEW.session_duration := EXTRACT(EPOCH FROM (NEW.logout_timestamp - NEW.login_timestamp))::integer;
    -- Preserve client-specified session_ended value (false = browser close)
    -- Only default to true if the client didn't explicitly send false
    IF NEW.session_ended IS NULL THEN
      NEW.session_ended := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
