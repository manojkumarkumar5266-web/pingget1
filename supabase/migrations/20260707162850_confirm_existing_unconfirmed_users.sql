-- Auto-confirm email for all existing unconfirmed users
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL AND deleted_at IS NULL;
