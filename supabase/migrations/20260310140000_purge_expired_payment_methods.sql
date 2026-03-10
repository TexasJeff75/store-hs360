/*
  Purge existing payment methods that stored single-use QB tokens.
  These tokens are expired and cannot be used for charges.
  Users will re-save their cards on next purchase using the new
  vaulting flow that creates reusable card-on-file / bank-on-file tokens.
*/

DELETE FROM payment_methods
WHERE payment_processor = 'quickbooks';
