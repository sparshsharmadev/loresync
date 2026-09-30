# Deployment operations

## Supabase setup

1. Apply every SQL file in `supabase/migrations/` in filename order.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the web deployment.
3. Configure `SUPABASE_SERVICE_ROLE_KEY` as a server-only secret. It is only read by the account-deletion route; never expose it through a `NEXT_PUBLIC_` variable.
4. In Supabase Dashboard, review **Authentication → Rate Limits** and **Authentication → CAPTCHA**. Keep Supabase Auth's managed limits enabled for signup, sign-in, and password recovery. The app also applies database-backed account limits to cloud import writes.
5. Confirm that the daily retention job `loresync-cloud-retention` exists and that database backups meet the retention promises shown to users.

Auth limits, CAPTCHA, deployed environment values, the retention job, and backup settings live in the Supabase project. They cannot be verified from this repository; check them in the dashboard before launch.
