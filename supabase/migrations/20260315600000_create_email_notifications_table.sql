-- Create the email_notifications table for logging all sent/failed/pending emails
CREATE TABLE IF NOT EXISTS email_notifications (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id),
  email_to        TEXT NOT NULL,
  email_type      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_html       TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX idx_email_notifications_user_id ON email_notifications(user_id);
CREATE INDEX idx_email_notifications_email_type ON email_notifications(email_type);
CREATE INDEX idx_email_notifications_status ON email_notifications(status);
CREATE INDEX idx_email_notifications_created_at ON email_notifications(created_at DESC);

-- RLS: admins can read all, service_role bypasses RLS for inserts from Netlify function
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Admins can view all email logs
CREATE POLICY "Admins can view email notifications"
  ON email_notifications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can view their own email notifications
CREATE POLICY "Users can view own email notifications"
  ON email_notifications FOR SELECT
  USING (auth.uid() = user_id);
