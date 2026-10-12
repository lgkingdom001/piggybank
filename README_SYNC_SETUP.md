# Piggy Bank Supabase Sync patch

## Before installing
1. Export JSON backups from BOTH your PC and phone. Keep both files.
2. In Supabase SQL Editor, run `piggy_bank_supabase_setup.sql` from the accompanying package.
3. In Supabase Authentication settings, enable Email provider. For easiest setup, you may turn off email confirmation temporarily; otherwise confirm the signup email before signing in.
4. Confirm the `public.piggy_bank_data` table exists and RLS is enabled.

## Install
Replace `app.js`, `index.html`, and `sw.js` in your GitHub Pages repository with the versions in this folder. Commit/push and wait for deployment. Open the website online on each device and navigate to Settings & data.

## First device
Create an account or sign in. If there is no cloud snapshot yet, this device initializes it.

## Second device
Sign in with the SAME email/password. If cloud data already exists, the app asks you:
- OK: download cloud snapshot and replace this device's local snapshot
- Cancel: upload this device's snapshot and replace the cloud snapshot

Do not choose either option until you exported both devices' backups and decided which data should be kept. These options are whole-snapshot choices, not a transaction-by-transaction merge.

## Sync behavior and safety
- Signed-in edits are saved locally and uploaded to Supabase after a short delay.
- The app checks for cloud updates every 15 seconds. It applies them when there are no pending local edits.
- If local edits are waiting to sync while another device has updated the cloud, the app warns rather than silently overwriting either side.
- This is snapshot-based sync, not a transaction-level merge. Avoid editing on both devices at the same time.
- The publishable key is intended for frontend use. Never put a service-role/secret key in the app.
