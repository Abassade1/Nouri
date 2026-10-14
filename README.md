# Nouri

A curated, premium pet-care marketplace. Every carer is credentialed, reviewed and approved by an admin before
owners can see them. Launch market: Calgary. Built multi-city, multi-country and multi-language (English, French,
Arabic; Simplified Chinese included as proof the system extends) from day one.

**Status: all 6 phases complete (MVP feature-complete, not yet launched)** (Phase 1: scaffold, design system, i18n + RTL, database + security rules, auth, role-based navigation. Phase 2: carer application in the app, admin dashboard to review credentials and approve. Phase 3: premium pet profiles, wellbeing trends, shared care history. Phase 4: browse and filter carers, carer profiles, booking requests, carer availability and agenda. Phase 5: Stripe Connect payments, refunds and carer payouts. Phase 6: visit reports, concern flags, reviews, push notifications, waitlist).

```
mobile/      Expo (React Native + TypeScript + Expo Router) app for owners and carers
supabase/    Database: migrations (schema, security rules, storage), seed data, automated security tests
admin/       Next.js admin dashboard: application queue, credential review, approve / return with notes (English, French, Arabic, RTL)
```

## See it in 2 minutes (no accounts needed)

```bash
cd mobile
npm install
cp .env.example .env        # keep EXPO_PUBLIC_PREVIEW_MODE=true
npx expo start --web        # press "w", or scan the QR code with Expo Go on your phone
```

On the welcome screen use **Preview as a pet owner / carer / admin** to walk through every screen with sample data.
Switch language (English / Français / العربية / 中文) from the welcome or Account screen to check RTL and translations.

### Admin dashboard preview

```bash
cd admin
npm install
cp .env.local.example .env.local     
npm run dev -- --port 3001           # open http://localhost:3001
```

With `ADMIN_PREVIEW=true` there is no login and you get three sample applications to review. Try approving one before verifying a credential: the rule that blocks it is the same one the real database enforces.

## Run it for real (with Supabase)

1. **Create a Supabase project** at supabase.com (free tier is fine). Choose a **Canada (Central)** region so data stays in Canada (PIPEDA-friendly).
2. **Create the database.** In the dashboard open *SQL Editor* and run these files **in order**, each as one query:
   1. `supabase/migrations/20261012000001_core.sql`
   2. `supabase/migrations/20261012000002_pets_bookings_care.sql`
   3. `supabase/migrations/20261012000003_rls.sql`
   4. `supabase/migrations/20261012000004_storage.sql`
   5. `supabase/migrations/20261012000005_application_rules.sql`
   6. `supabase/migrations/20261012000006_booking_rules.sql`
   7. `supabase/migrations/20261012000007_payments.sql`
   8. `supabase/migrations/20261012000008_visits_notifications.sql`
   9. `supabase/migrations/20261012000009_dispute_admin.sql`
   10. `supabase/migrations/20261012000010_admin_ops.sql`
   11. `supabase/migrations/20261012000011_service_catalogue.sql`
   12. `supabase/seed.sql` (languages, countries, cities incl. Calgary, the 5 launch services)

   *(Prefer the CLI? `supabase init`, then `supabase link` and `supabase db push`: the migrations are already in the right folder and naming.)*
3. **Connect the app.** Copy *Project Settings → API* values into `mobile/.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   EXPO_PUBLIC_PREVIEW_MODE=false
   ```
   The anon key is meant to be public; the database's security rules protect the data.
4. **Auth settings** (*Authentication → URL Configuration*): add `nouri://auth/callback` to *Redirect URLs*
   (plus the Expo Go URL shown in the terminal while developing).
5. **Apple / Google sign-in** (*Authentication → Providers*): needs your Apple Developer and Google Cloud accounts. See "Needs your input".
6. **Run the admin dashboard** against it: in `admin/.env.local` set the same `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `ADMIN_PREVIEW=false`, then `npm run dev -- --port 3001` and sign in with your admin account (step 10).
9. **Set up Stripe** (payments need it) and **push notifications**: see the next two sections.
10. **Make yourself the first admin** (nobody can self-assign admin). Sign up in the app, then in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
   ```

## Stripe setup (payments)

The money rules and webhook handling are unit-tested, but nothing has run against Stripe yet; plan a test-mode pass first.

1. **Stripe account**: create one, enable **Connect**, choose *Express* accounts, and complete your business profile. Stay in **test mode** until the end-to-end run below works.
2. **Keys → app and server.**
   - `mobile/.env`: `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
   - Server secrets (Supabase CLI):
     ```bash
     supabase secrets set STRIPE_SECRET_KEY=sk_test_... \
       STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_CONNECT_WEBHOOK_SECRET=whsec_... \
       STRIPE_RETURN_URL=https://YOUR-ADMIN-DOMAIN/stripe-return CRON_SECRET=$(openssl rand -hex 24)
     ```
3. **Deploy the functions** (the webhook and the scheduled job are called by Stripe/cron, not by a signed-in user, so they skip login checks and protect themselves with signature / secret instead):
   ```bash
   supabase functions deploy stripe-connect create-payment cancel-booking admin-dispute-refund
   supabase functions deploy stripe-webhook release-payouts --no-verify-jwt
   ```
4. **Webhooks** (Stripe dashboard → Developers → Webhooks): add **two** endpoints, both `https://YOUR-PROJECT.functions.supabase.co/stripe-webhook`:
   - *Your account*: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` → its signing secret is `STRIPE_WEBHOOK_SECRET`.
   - *Connected accounts*: `account.updated`, `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled` → its secret is `STRIPE_CONNECT_WEBHOOK_SECRET`.
5. **Hourly payout job** (enable the `pg_cron` and `pg_net` extensions first):
   ```sql
   select cron.schedule('release-payouts', '0 * * * *', $$
     select net.http_post(
       url := 'https://YOUR-PROJECT.functions.supabase.co/release-payouts',
       headers := '{"x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb) $$);
   ```
6. **Carer return page**: the admin app serves `/stripe-return`, which forwards carers from Stripe back into the app. Deploy the admin app somewhere with a public https address and use that in `STRIPE_RETURN_URL`.
7. **Test it** with a carer account (approved, then *Earnings → Set up payouts* using Stripe's test onboarding data) and an owner paying with card `4242 4242 4242 4242` (any future date, any CVC). `4000 0000 0000 9995` simulates a declined card. Then check: booking turns *Confirmed*, cancel shows the refund, completing a visit leads to a transfer after the hold, and bank payouts appear on the carer's Earnings screen.

### How money moves
1. The carer accepts a request, and the owner taps **Confirm & pay**. The owner is charged the full total (subtotal + tax) by the platform. Stripe tells our server the payment succeeded, and only then does the booking become *Confirmed*.
2. After the visit the carer marks it *Completed*. After the city's **hold period** (default 24 h, so owners can raise a concern) the hourly job **transfers the carer's payout** (subtotal minus commission) to their Stripe account. Tax and commission stay with the platform. Stripe pays the carer's balance to their bank on its own schedule.
3. A **confirmed (paid) booking can only be cancelled through the server**, which applies the city's refund rule: owner cancels at least 24 h ahead → full refund; later → 50% (both numbers are per-city settings); a carer cancelling always means a full refund. The app shows the exact refund *before* the owner confirms.
4. Carers **can't be booked or accept requests until their payout account is active**, and don't appear in Discover until then.

## Phone builds (EAS)

The app is a native iOS and Android app. Expo's build service (EAS) compiles it, signs it, sends it to the stores and delivers small fixes over the air. Settings live in `mobile/eas.json`.

| Profile | What you get | Use it for |
|---|---|---|
| `development` | A debug app that loads code from your computer | Day-to-day work on a real phone |
| `development-simulator` | The same, for the iOS simulator | Work without a phone |
| `preview` | A standalone app (Android `.apk`, iOS ad hoc) | Handing to testers |
| `production` | Store-ready builds, build number raised automatically | App Store and Google Play |

**On this Mac, no account needed** (needs Xcode / Android Studio): `cd mobile && npm run ios` or `npm run android` compiles the development app and opens it in the simulator or emulator.

**One-time cloud setup** (in `mobile/`):
1. `npx eas-cli login` (free Expo account), then `npx eas-cli init` to create the project and write its id into `app.json`.
2. `npx eas-cli update:configure` to switch on over-the-air updates.
3. In the Expo dashboard, add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` to the *preview* and *production* environments. Never add `EXPO_PUBLIC_PREVIEW_MODE` there.
4. EAS builds from a git repository, so this folder needs its own (`git init` here and a first commit).

**Then**: `npm run build:dev:ios` / `build:dev:android` (real phones; iOS needs a paid Apple Developer account and asks you to register the phone), `npm run build:preview`, `npm run build:production`, `npm run submit`, and `npm run update:preview` / `update:production` for over-the-air fixes. An over-the-air update only reaches builds with the same app version (`runtimeVersion` policy), so anything that changes native code needs a new build.

## Push notifications setup

Notifications are queued by the database (a row in `notifications` whenever something happens that someone should hear about) and sent by the `send-push` function through Expo's push service, in each person's own language. Lock-screen text never contains health details.

1. **EAS project**: do the "Phone builds" steps below first; `eas init` writes the project id into `mobile/app.json` (until then, devices simply won't register).
2. **Phone credentials**: iOS needs an Apple push key and Android needs a Firebase (FCM) key; `eas credentials` walks you through both. Push does **not** work on web or the iOS simulator; use a real device.
3. **Deploy**: `supabase functions deploy send-push --no-verify-jwt` (it reuses `CRON_SECRET`). Optional `supabase secrets set EXPO_ACCESS_TOKEN=...` if you turn on Expo's enhanced push security.
4. **Make it instant**: Supabase dashboard → *Database → Webhooks* → new webhook on table `notifications`, event **Insert**, calling `https://YOUR-PROJECT.functions.supabase.co/send-push` with header `x-cron-secret: YOUR_CRON_SECRET`. This is what makes a concern flag reach the owner within seconds.
5. **Safety net and reminders** (`pg_cron` + `pg_net` enabled):
   ```sql
   -- retry anything the webhook missed, every minute
   select cron.schedule('send-push', '* * * * *', $$ select net.http_post(
     url := 'https://YOUR-PROJECT.functions.supabase.co/send-push',
     headers := '{"x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb) $$);
   -- warn carers 30 days and 7 days before a verified credential expires
   select cron.schedule('credential-reminders', '0 15 * * *', $$ select public.enqueue_expiry_reminders() $$);
   ```

What triggers a notification: booking requested (carer), accepted / declined / completed (owner), confirmed (carer), cancelled (the other person), visit report (owner), **concern flag (owner, high priority, its own loud Android channel)**, review received (carer), application approved / returned (carer), credential expiring (carer). Tapping one opens the right screen.

## Checks

```bash
cd mobile && npm run typecheck && npm run i18n:check && npm test   # types; every language has every string; booking time/price maths
cd supabase/tests && npm install && npm test             # 162 database security checks
cd admin && npm test                                     # 17 checks on payment totals, city and service form validation, CSV export
cd supabase/functions && npm install && npm test         # 32 checks on refund / payout / dispute / webhook / notification rules; `npm run typecheck` checks the functions (runs in-process, no Docker)
```

The database tests apply the real migrations and then act as an owner, a carer, an admin and a signed-out visitor to
prove the rules hold, e.g. an owner can't read another owner's pets, a carer can't approve themselves or edit an application under review, an admin can't approve without a verified credential, prices can't be
edited by the client, visit reports can't be changed after submission.

## Key decisions (plain language)

- **Light, warm, restrained look** with one accent colour (forest green). All colours/spacing/type live in `mobile/src/theme/tokens.ts`; screens never hard-code them. (A reference you shared used a dark luxury look; this is easy to switch by changing the tokens.)
- **Screens can't see data they shouldn't, even if the app has a bug.** Privacy is enforced inside the database (Row Level Security), not just in the app. Example: a carer sees a pet's name and routine when a request arrives, but health notes and medications only once the booking is confirmed (and for 7 days after).
- **Prices are calculated by the database**, never the phone: carer rate x quantity, plus the city's taxes, minus the city's commission. A tampered app can't change what's charged.
- **City = configuration.** Currency, taxes (itemised, e.g. GST + PST), commission, default language, launch neighbourhoods and which services are offered are rows in `cities` / `city_services`. Adding Edmonton or Dubai is data entry, not code. A city that isn't `is_active` can't take bookings and feeds the waitlist.
- **Content in three-plus languages lives in the database** as `{"en": "...", "fr": "...", "ar": "..."}` (service names, city names), so adding a language doesn't need a new app release for that content.
- **Money is stored as whole cents** with a currency code, formatted per language at display time (`0,00 $` in French, `CA$0.00` in Chinese).
- **Append-only trust layer.** Visit reports, wellbeing scores, concern flags, owner actions on flags and the care-history timeline can be added to but never edited or deleted, even by admins. The timeline is written by the database itself (triggers), so it can't be forged from the app. No blockchain needed.
- **Right-to-left done properly.** Layout uses start/end (never left/right), icons that imply direction mirror, Arabic gets its own font and extra line-height, and email/password fields stay left-to-right. On iPhone/Android, switching to/from Arabic asks to restart the app (an OS requirement); the first launch on an Arabic phone restarts once automatically.
- **Sessions are encrypted on the phone** (key in the iOS Keychain / Android Keystore).
- **Deviation from the brief:** none in the stack. One addition: *preview mode* (above), so you can review the design before any backend exists.

## Needs your input (flagged)

| Area | What I need from you |
|---|---|
| **Brand** | Final app name (currently "Nouri", set in `mobile/src/config/app.ts` and `app.json`), logo, bundle ID (`com.nouri.app` is a placeholder). |
| **Legal** | Terms of Service, Privacy Policy and the exact consent wording (currently a placeholder string + version `2026-10-draft`); a lawyer should review, incl. PIPEDA and Quebec Law 25 before launching in Quebec; CASL wording for the waitlist. Data-erasure policy: account deletion is only partly designed (see below). |
| **Tax** | The tax rates in `seed.sql` are illustrative. Confirm with an accountant what GST/PST applies to pet services and who collects it (platform vs carer), then adjust `cities.tax_components`. |
| **Pricing & money policy** | Commission is a placeholder 15% in every city. Placeholder cancellation rule (full refund ≥24 h ahead, else 50%) and payout hold (24 h): **decide the real numbers**. When an owner cancels late, the withheld share currently stays with the platform; decide whether part should go to the carer. Also rate floors/ceilings per service. |
| **Tax & who is the seller** | Today the platform charges the owner the tax and keeps it; decide with your accountant who collects and remits GST/PST (platform vs. each carer), and whether carers must be GST-registered. This also decides how receipts and carer statements are worded. |
| **Insurance** | Platform liability cover, whether carers must hold their own, and which credentials count (the `insurance` credential type exists). Background-check provider choice (consent is captured; the check itself isn't wired). |
| **Policy** | Minimum references required to apply (set to 2 in `guard_carer_profile`), who may become a carer, dispute window (7 days after completion is set in `bookings_before_update`). |
| **Stripe** | A Stripe account with **Connect** enabled (Express accounts, Canada), your platform business details, and your decision on who is the merchant of record. Stripe reviews Connect platforms: allow time. Apple Pay needs a merchant ID (`merchant.com.nouri.app` is a placeholder). |
| **Apple / Google** | Apple Developer account ($99/yr) with Sign in with Apple enabled; a Google Cloud OAuth client. Both are then pasted into Supabase *Authentication → Providers*. |
| **Translations** | **All French and Arabic (and Chinese) text is a first draft by me and must be reviewed by native speakers** before launch: `mobile/src/i18n/locales/*` and the French/Arabic/Chinese parts of `supabase/seed.sql`. Pay special attention to Quebec French conventions, and to Arabic medical/pet terminology. |

## What is built and what is not

Admin dashboard, service catalogue (added after Phase 6):
- **Services** (nav: *Services*): the catalogue of care on offer. The list shows how each is charged, how many cities and carers offer it, whether it's active, and **which app languages are still missing a translation** (those show English in the apps until filled in).
- **Edit a service:** name and owner-facing description in English, French, Arabic and Chinese side by side; position in lists; icon; and an active switch. Because names live in the database, **a new or renamed service reaches the apps without an app-store release**.
- **Add a service:** it starts in no city; you then switch it on per city in *Cities*.
- **Safety:** the short name is permanent, and the **billing unit locks once any carer or booking uses the service** (changing "per visit" to "per night" would silently change what existing prices mean); the database enforces this even if the form is tampered with. **Retiring** a service hides it from owners and carers, removes it from carers' public prices and blocks new bookings, while existing bookings carry on. Every change is in the audit log and shown as "Recent changes".

Admin dashboard, payments, cities and waitlist (added after Phase 6):
- **Payments** (nav: *Payments*): money in and out **per currency** (CAD and AED are never added together) for the last 30 / 90 days or all time: charged to owners, refunded, net, platform commission earned, tax collected, released to carers, owed to carers, and held for disputes. A *Needs attention* box lists open disputes, failed payments, and **payouts that are overdue for release** (completed and paid, past the hold, not yet sent: usually a carer without an active payout account). A table of paid bookings with status, and a **CSV download for your accountant**.
- **Cities** (nav: *Cities*): every city with its currency, language, commission, taxes, service count and live status. Each city has one edit screen: names in each language, commission, up to four taxes (typed as percentages, e.g. `9.975`), the refund rule, the payout hold, launch neighbourhoods, which services are offered, and the **live switch**. *Add a city* creates a new one (always closed to start).
- **Safety on money settings:** the form checks ranges and explains what's wrong; the database re-checks (a 150% tax can't be saved by any route); a city **can't go live without at least one service**; changes affect **new bookings only**; and **every change is written to an audit log by the database** (who, when, before and after), shown as "Recent changes" on the city.
- **Waitlist** (nav: *Waitlist*): **demand by city** (owners, carers, total, not yet contacted), with cities people typed themselves merged regardless of capitalisation; the full list with filters; *Mark all contacted* per city; delete an entry when someone asks to be removed; CSV download. A CASL reminder sits at the top.
- CSV exports neutralise spreadsheet formulas in user-typed text (a security precaution) and open correctly in Excel with accents and Arabic.
- All three are in English, French and Arabic (right-to-left) and work in sample-data preview mode.

Admin dashboard, disputes and concern flags (added after Phase 6):
- **Disputes** (nav: *Disputes*, with an open-count badge): every booking an owner reported a problem on, in an *Open* and a *Decided* tab. Each case shows what the owner said, the visit, the money (what was charged, whether the carer was already paid, the platform's share), the carer's visit reports and photos, and any concerns raised. The payout is paused while a case is open.
- **Two possible decisions, both needing a written note** that is saved on the booking and sent to both people as a notification: **side with the carer** (the visit counts as completed and the payout is released after the normal hold) or **refund the owner in full**. The refund goes through the server: it reverses the carer's payout first if it was already sent, then refunds the card, safe to retry without refunding twice, and it is gated behind a confirmation tickbox because it can't be undone.
- **Concern flags** (nav: *Concern flags*, with a badge counting urgent flags that aren't resolved): everything carers have raised, filtered to *Needs attention* / *Urgent* / *Resolved* / *All*. **An urgent flag the owner hasn't responded to is highlighted with how many hours it has waited**, so a worrying silence is visible. Each flag shows the carer's notes and photos and what the owner did about it (acknowledged, called the vet, booked a taxi, resolved). Read-only by design: the owner decides what happens to their pet.
- Both areas are available in English, French and Arabic (right-to-left) and work in sample-data preview mode.
- Carers are now notified when a dispute is opened (their payout is paused), and both people when it's decided.

Phase 6 added:
- **Visit reports (carer):** from a confirmed booking: *Start visit*, then *Submit visit report* with a note, checklist (fed, walked, fresh water), medications given (from the pet's real medication list), up to six photos, and a 1-5 wellbeing score for each of the four metrics for every pet. It is sent as one atomic action, so a report can never exist without its scores, and it can't be edited afterwards. The carer can also mark the visit complete in the same step. Before a visit the carer can open the pet's **full profile read-only** (routine, health, medications, history).
- **Visit report feed (owner):** each booking shows its reports with photos, checklist and scores; the scores feed the pet's trend charts and care-history timeline automatically.
- **Concern flags:** a carer raises a concern about a pet (health / behaviour / other; for information / needs attention / urgent) with notes and photos. The owner gets a high-priority push and a "Needs your attention" card on Home. One-tap actions: **Call vet** (dials the number in the pet's profile), **Book a pet taxi to the vet** (opens Discover filtered to taxis and records the taxi booking against the concern), **Acknowledge**, **Mark resolved**. Everything is logged in the pet's care history.
- **Reviews:** owners rate completed visits (1-5 stars, optional comment); the carer's rating updates and shows on their profile; carers see their reviews. Owners can also **report a problem** within 7 days, which pauses that visit's payout until an admin reviews it.
- **Push notifications** in the user's language (see setup above), including credential-expiry reminders for carers.
- **Waitlist:** open to signed-out visitors and signed-in users; pick a city that isn't live yet or type your own; explicit consent; joining twice is treated as success.

Phase 5 added:
- **Owner payment:** *Confirm & pay* on an accepted booking opens Stripe's secure payment sheet (cards, Apple Pay / Google Pay, saved cards). The amount is decided by the server, never the phone. A failed payment leaves the booking recoverable ("Try payment again").
- **Refunds and cancellation:** estimate shown before confirming; the server applies it (idempotent, so a retry can never refund twice).
- **Carer payouts:** Stripe Express onboarding from *Earnings*, held-then-released transfers, bank payouts listed, a link into the Stripe dashboard, and a per-stage earnings summary (paid out / releasing soon / upcoming / this month).
- **Safety rules in the database (migration 0007):** paid bookings can't be cancelled from the app; carers must have an active payout account to be listed, booked or to accept; Stripe customer ids and processed webhook events are server-only; amounts in a payment webhook must match the booking or it is not confirmed.

Phase 4 added:
- **Discover (owner):** carers in the owner's city, filtered by service, a specific day (only carers with a bookable slot that day), minimum rating and specialty. Each card shows rating (or "New"), the verified-credential badges and a "from" price (or the exact price when a service is selected). Only approved carers in live cities ever appear: the app reads from a database view that exposes a safe subset of columns, and shows only the first part of a carer's postal code.
- **Carer profile:** verified credentials (issuer and expiry, "checked by our team"), bio, languages, specialties, services and rates, weekly hours, reviews.
- **Booking request:** pick a service, (nights, for overnight stays), a date among the days the carer works, a start time from real open slots, which pets, and notes. A price summary shows subtotal, each tax and an estimated total. Nothing is charged until the carer accepts.
- **Times are city time.** Bookings are stored in UTC but read and shown in the city's own time zone, with daylight-saving handled (unit-tested).
- **Server-enforced rules (migration 0006):** a request must start inside the carer's weekly hours, at least 2 hours ahead, and can't overlap a booking the carer has already accepted; accepting re-checks overlap. A tampered app can't bypass these.
- **Bookings (owner):** upcoming and past, status, price breakdown, cancel. **Bookings (carer):** a Requests section with accept/decline, an agenda grouped by day, past bookings, and the carer sees the pet's profile, owner notes and their payout after the platform fee.
- **Weekly availability (carer):** add or remove hours for each weekday (Today tab).

Phase 3 added (owner side of the app, Pets tab):
- **Premium pet profile:** photo, name, species, breed, sex, spayed/neutered, age (typed as years + months, stored as an approximate birth date), weight, status tags (Healthy, Senior, Special needs, On medication; "On medication" also appears automatically while any medication is active), behaviour notes, feeding and walking routines, quirks.
- **Health, kept separate from identity:** medical notes, allergies, microchip ID, insurance status and provider, vet clinic/name/phone with a one-tap **Call vet**. This lives in its own table so carers only see it for confirmed bookings (and 7 days after), and the form says so in plain words.
- **Medications with schedules:** name, dose, frequency, times (24-hour), instructions; pause, resume or remove.
- **Wellbeing scores:** four separate metrics (Health, Nutrition & hydration, Activity, Happiness), each with the latest score, change since last visit and a trend chart. The chart is a small dependency-free SVG component, and its time axis follows the reading direction (newest on the left in Arabic). Scores are written by carers in their visit reports; owners see them here.
- **Shared care history:** a timeline of visit reports, medication given, concern flags and what was done about them, completed visits, plus vet visits and notes the owner logs themselves (with their own date). Entries can't be edited or removed, and only the owner's vet visits/notes can be created from the app; everything else is written by the database.
- Pets are **archived, never deleted**, so history is preserved.
- Text people type (names, notes, medication names) keeps its own reading order inside right-to-left screens, aligned to the app's start edge.

Phase 2 added:
- **Carer application (app):** a checklist hub with five steps: About you (city, bio, languages, specialties, service radius, postal code), Services & rates (per city, with the platform's commission shown), Credentials (upload PDF/photo to private storage), References (two required), Consent (background check + terms). Submit is only enabled when everything is complete; the database re-checks. While in review the application is locked; if returned, the carer sees the admin's notes and can fix and resubmit.
- **Admin dashboard (web):** queue filtered by status, full application view, open each credential document (private, 5-minute links), verify / reject each with a note, then approve or return with a reason. Badges shown to owners come only from credentials an admin verified.
- **Rules in the database** (migration 0005): lock during review, approval needs a verified unexpired credential, rejection needs a reason, submit needs a service with a rate.

Phase 1 built: design system (`mobile/src/components/ui`), i18n for 4 languages with RTL, localized formatting helpers,
full database schema for every phase (`supabase/migrations`), security rules + storage rules, auth (email, Apple, Google),
role-based navigation (owner tabs, carer tabs, admin hand-off screen), Calgary seed data.

Known gaps and things not yet verified:
- **Document upload, document viewing and the admin sign-in have not run against a live Supabase project.** The app side was clicked through in preview mode and the admin in sample-data mode; the database rules are covered by the automated tests, but the real upload/signed-link path needs your first end-to-end try.
- **Pet photo upload and signed photo links have not run against a live Supabase project** (previewed with local images only). Dates for vet-visit entries and credentials are typed as YYYY-MM-DD (a native date picker is a small follow-up).
- **Distance and service-radius matching are not built.** Discover filters by city only. Matching an owner's address to each carer's radius needs a geocoding provider (address to coordinates); the radius and postal codes are already stored.
- **Nothing has run against Stripe yet** (no account or keys here). The server code type-checks against Stripe's current library and its decisions are unit-tested with fakes, but the first real run is test-mode, with a native build on a device (the payment sheet doesn't exist on web; preview mode simulates it).
- **Native build required for real payments.** Stripe's payment sheet works in Expo Go and development builds, not on web.
- **Disputes and chargebacks** aren't handled yet: a card dispute after payout needs an admin process (and likely a transfer reversal). The admin dashboard has no payments screen yet.
- **Wellbeing charts and care history show sample data in preview**; with a live project they fill from real visit reports.
- **Breed lists, species beyond dog/cat/other, and weight units (kg only)** are simple for now.
- **Weekly availability** is set from the Today tab after sign-up (built in Phase 4).
- **Admin city management** (activate a city, edit taxes/services) is still done in the Supabase dashboard; a screen for it is planned alongside Phase 4.
- **Not yet run on a physical iPhone/Android device or a native simulator.** Everything visual was verified on the web build at phone width in all four languages. The native-only paths (Apple sign-in, the Arabic restart, Keychain storage) are written but untested, so please try them on a device.
- **Apple/Google/email sign-in are untested against a live Supabase project** (no project exists yet); the database side is covered by the automated tests.
- **Account deletion** (PIPEDA right to erasure) is only partially designed: the append-only tables allow cascade deletes, but bookings keep references to both parties. Needs a policy decision (anonymise vs delete) before launch.
- The mobile app uses hand-written database types for now; generate them with the Supabase CLI once it's set up.
- Credential-expiry reminders are queued by `enqueue_expiry_reminders()` (daily schedule in the push setup section) and delivered as push notifications.
- Owner address entry and postal-code validation per country are in the database (regex per country, Canadian format enforced); the form UI arrives in Phase 3 with the profile screens.

## Roadmap

1. **Phase 1** done. 2. **Phase 2** done (carer application + admin approval). **Phase 3** done (pet profiles, wellbeing, care history). **Phase 4** done (browse, profiles, booking requests, availability). **Phase 5** done (Stripe Connect payments, refunds, payouts). **Phase 6** done (visit reports, concern flags, reviews, push, waitlist).

**Before launch:** a first live run of everything against real Supabase, Stripe (test mode) and a real phone; native-speaker translation review; legal text; an admin screen for disputes, flags and payments; app-store assets and review.
