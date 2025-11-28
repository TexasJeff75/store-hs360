# Session Management & Security

This document explains how user sessions are tracked, managed, and secured in the application.

## Overview

The application implements comprehensive session tracking to:
- Monitor how long users are logged in
- Automatically expire inactive sessions for security
- Track legitimate logouts vs. browser closures
- Identify security risks from orphaned sessions
- Provide audit trails for compliance

## Session Lifecycle

### 1. Login
When a user logs in:
- A unique `session_id` is generated
- Login timestamp is recorded in `login_audit` table
- User's IP address and browser info are captured
- Activity monitoring begins

### 2. Active Session
During an active session:
- User activity is monitored (mouse, keyboard, scroll, touch events)
- Last activity timestamp is updated
- Session validity is checked every minute
- Sessions expire after **2 hours of inactivity**

### 3. Logout
When a user explicitly logs out:
- Logout timestamp is recorded
- Session duration is automatically calculated
- `session_ended` flag is set to `true` (explicit logout)
- Activity monitoring stops

### 4. Browser Close
When user closes browser without logging out:
- `beforeunload` event triggers
- Logout timestamp is recorded
- `session_ended` flag is set to `false` (implicit logout)
- Indicates potential security concern

### 5. Timeout
When session times out due to inactivity:
- User is automatically logged out
- Session is recorded as ended
- User is redirected with `?session_expired=true` parameter

## Database Schema

### login_audit Table

```sql
- id (uuid): Primary key
- user_id (uuid): References auth.users
- email (text): User's email
- session_id (text): Unique session identifier
- age_verified (boolean): Whether user confirmed age
- ip_address (text): Client IP address
- user_agent (text): Browser/device information
- login_timestamp (timestamptz): When login occurred
- logout_timestamp (timestamptz): When session ended
- session_duration (integer): Duration in seconds (auto-calculated)
- session_ended (boolean): True if explicit logout, false if browser close
- created_at (timestamptz): Record creation time
```

## Security Features

### 1. Automatic Session Expiration
- **Timeout**: 2 hours of inactivity
- **Check Interval**: Every 60 seconds
- **Activity Events**: mousedown, keydown, scroll, touchstart, click

### 2. Orphaned Session Detection
Sessions that weren't properly closed are automatically expired:
```sql
-- Run this periodically to clean up orphaned sessions
SELECT expire_orphaned_sessions();
```

This function:
- Finds sessions older than 24 hours without logout timestamp
- Marks them as expired
- Sets session_duration to 24 hours (maximum)
- Flags them as NOT explicitly ended (security risk indicator)

### 3. Session Storage
- Session info stored in `sessionStorage` (not `localStorage`)
- Automatically cleared when browser tab/window closes
- Prevents session persistence across browser restarts

### 4. Browser Close Detection
- Uses `beforeunload` event to detect browser closure
- Uses `navigator.sendBeacon()` for reliable tracking even during page unload
- Marks session as not explicitly ended (security audit flag)

## API Reference

### sessionTrackingService

```typescript
// Record user login
await sessionTrackingService.recordLogin(userId, email, ageVerified);

// Record explicit logout
await sessionTrackingService.recordLogout();

// Get current session ID
const sessionId = sessionTrackingService.getCurrentSessionId();

// Get session duration in seconds
const duration = await sessionTrackingService.getSessionDuration();

// Check if session is still valid
const isValid = sessionTrackingService.isSessionValid();

// Get time remaining until timeout (in milliseconds)
const timeRemaining = sessionTrackingService.getTimeUntilTimeout();

// Clean up orphaned sessions (admin function)
await sessionTrackingService.cleanupOrphanedSessions();
```

## Configuration

### Session Timeout
Modify in `/src/services/sessionTracking.ts`:
```typescript
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
```

### Activity Check Interval
Modify in `/src/services/sessionTracking.ts`:
```typescript
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
```

### Supabase Auth Settings
Configure in your Supabase dashboard under Authentication > Settings:
- JWT expiry: Recommended 1 hour
- Refresh token expiry: Recommended 24 hours
- Refresh token rotation: Enabled

## Security Best Practices

### ✅ Implemented
- [x] Automatic session timeout on inactivity
- [x] Session tracking in database
- [x] Browser close detection
- [x] Unique session identifiers
- [x] Activity monitoring
- [x] Orphaned session cleanup
- [x] sessionStorage (not localStorage)

### 🔒 Recommended Additional Measures
- [ ] IP address change detection (may disconnect)
- [ ] Device fingerprinting for anomaly detection
- [ ] Multi-factor authentication (MFA)
- [ ] Session revocation (admin force logout)
- [ ] Concurrent session limits
- [ ] Geographic location tracking

## Monitoring & Auditing

### View Active Sessions
```sql
SELECT 
  email,
  login_timestamp,
  EXTRACT(EPOCH FROM (NOW() - login_timestamp)) / 60 AS minutes_active
FROM login_audit
WHERE session_ended = false
  AND logout_timestamp IS NULL
ORDER BY login_timestamp DESC;
```

### View Session Duration Statistics
```sql
SELECT 
  email,
  AVG(session_duration) / 60 AS avg_duration_minutes,
  MAX(session_duration) / 60 AS max_duration_minutes,
  COUNT(*) AS total_sessions,
  SUM(CASE WHEN session_ended = true THEN 1 ELSE 0 END) AS explicit_logouts,
  SUM(CASE WHEN session_ended = false THEN 1 ELSE 0 END) AS browser_closes
FROM login_audit
WHERE logout_timestamp IS NOT NULL
GROUP BY email
ORDER BY total_sessions DESC;
```

### Find Suspicious Activity
```sql
-- Sessions that lasted over 12 hours (potential security issue)
SELECT *
FROM login_audit
WHERE session_duration > 43200
ORDER BY login_timestamp DESC;

-- Users who never explicitly log out
SELECT 
  email,
  COUNT(*) AS total_sessions,
  SUM(CASE WHEN session_ended = true THEN 1 ELSE 0 END) AS explicit_logouts
FROM login_audit
GROUP BY email
HAVING SUM(CASE WHEN session_ended = true THEN 1 ELSE 0 END) = 0;
```

## Troubleshooting

### Session Expired Unexpectedly
- Check if 2-hour timeout is appropriate for your use case
- Verify activity events are being captured
- Check browser console for errors

### Sessions Not Ending on Browser Close
- Verify `beforeunload` handler is registered
- Check if `navigator.sendBeacon()` is supported
- Ensure Supabase REST endpoint is accessible

### Database Migration Issues
Run the migration manually:
```bash
# Apply the session tracking migration
psql -U postgres -d your_database -f supabase/migrations/20251128000000_add_session_tracking.sql
```

## Compliance Notes

### GDPR
- Users can request their session history
- Session logs include personal data (IP, email)
- Implement data retention policy for old session records

### SOC 2
- Session audit trail provides required logging
- Track both successful and failed login attempts
- Monitor for anomalous session patterns

### HIPAA (if applicable)
- 2-hour timeout meets typical requirements
- Session logs provide required audit trail
- Consider shorter timeout for high-security areas
