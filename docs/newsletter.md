# Release email alerts

The footer signup requires explicit consent, Turnstile when configured, and a
confirmation email. Confirmation links expire after 24 hours. Link scanners cannot
subscribe/unsubscribe with GET requests; the management page requires a button.
Every release email has an unsubscribe link and RFC 8058 one-click POST headers.
Only verified subscribers present at publication time receive the release.
Editing or unpublishing/republishing the same release does not send it again.
Existing published releases are not emailed retroactively.

## Without a custom domain: Gmail

1. Enable Google 2-Step Verification for your sending Gmail account.
2. Create an App Password named VITOENCODES at https://myaccount.google.com/apppasswords.
3. Set `NEWSLETTER_PROVIDER=gmail`, `GMAIL_USER=your-address@gmail.com`, and
   `GMAIL_APP_PASSWORD` in ignored `.env.local` and Vercel environment settings.
   Never use your ordinary Google password or put credentials in client code.
4. `SITE_URL` defaults to the existing Vercel production origin. Set it explicitly
   if your production address changes. Redeploy after setting credentials.

Recipients see `VITOENCODES <your-address@gmail.com>`. A custom domain is not
required. Gmail is intended here for a small list; the app caps Gmail attempts at
250/day. Each SMTP job is marked `review` before sending and `sent` after acceptance.
If delivery is ambiguous or interrupted, it stays in `review` and is not retried
silently: SMTP has no provider idempotency guarantee. An administrator must review
these jobs rather than blindly resend them.

## With your own domain later: Resend

1. Set `NEWSLETTER_PROVIDER=resend`. Verify a sending domain in Resend, including its required DNS records.
2. Set `NEWSLETTER_FROM` to an address on that verified domain in Vercel.
   Keep `RESEND_API_KEY` server-only. Set `SITE_URL` to the canonical HTTPS origin.
   The `resend.dev` test sender is deliberately disabled for newsletters.
3. Run `npm run db:migrate` with the direct Postgres URL to apply migration 003
   before deploying this code. Test migrations on a Neon development branch first.
4. Deploy, subscribe with a real mailbox, confirm, and publish a new test encode.
   Provider acceptance alone does not prove inbox placement.
5. For prompt retries and more than 25 subscribers, schedule an independent
   service to GET `/api/cron/newsletter` every minute with
   `Authorization: Bearer <CRON_SECRET>`. Do not put the secret in the URL.
   The existing Vercel Hobby daily maintenance also drains one batch, but is not
   frequent enough for prompt delivery to a growing list.

Publishing immediately triggers a bounded background batch using Next `after`.
The database outbox survives process restarts and concurrent workers claim jobs
under the existing writer lock. Each recipient has a separate message. Resend uses a stable
idempotency key. Failed Resend jobs retry at least two minutes later, up to five
attempts and within 23 hours of the first attempt. Older ambiguous deliveries
remain pending for review rather than risking duplicate email after Resend's
24-hour idempotency window. Inspect `newsletter_deliveries` for state/attempts;
do not blindly reset attempts on old jobs.

No subscriber address is exposed by a public API. Unsubscribed addresses remain
suppressed. Handle deletion requests through the existing contact channel.
