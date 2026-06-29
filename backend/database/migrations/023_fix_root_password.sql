-- Migration 023: Fix root user password hash (Psah1234)
UPDATE app_users
SET password_hash = 'bcf42939c3007fabb4b1ff30802e2003fc0ac0b7da36eb1ac0343a3ef0bfad14'
WHERE email = 'happylinga005@gmail.com' AND role = 'root';

COMMIT;
