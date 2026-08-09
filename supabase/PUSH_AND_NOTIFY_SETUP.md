# Mobile push + Admin Notify (pinGGet)

## 1) SQL (Supabase → SQL Editor → Run)
- `supabase/APPLY_NOW_PUSH_OUTBOX.sql`
- (if not already) `supabase/APPLY_NOW_MUTUAL_CANCEL_AND_NOTIFY.sql`

## 2) Deploy edge functions
```bash
supabase functions deploy notify-broadcast
supabase functions deploy dispatch-push
supabase functions deploy advance-request-scheduler
```

## 3) Set FCM secrets (required for mobile push)
Either legacy server key:
```bash
supabase secrets set FCM_SERVER_KEY="AAAA...."
```
Or Firebase service account JSON (HTTP v1):
```bash
supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"
```

Also ensure `RESEND_API_KEY` is set for email.

## 4) Cron
Keep `advance-request-scheduler` on a short schedule (e.g. every 1–5 min) so:
- scheduled Admin Notify fires on time
- `push_outbox` drains for any notification inserts

## Behaviour
- Every row in `notifications` enqueues `push_outbox` (DB trigger)
- Client + edge also call `dispatch-push` for faster delivery
- Admin offers open `/app/offers/:id` or `/dp/offers/:id` with full text + image
