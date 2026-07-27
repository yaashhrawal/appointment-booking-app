# Appointment Booking

A doctor appointment booking system with a patient-facing flow, a doctor dashboard, and an authenticated external API so other systems can push bookings in.

**Live:** https://appointments-app-lilac.vercel.app

---

## What it does

**Patients** book from a public page — pick a doctor, pick a slot, submit. No account needed.

**Doctors** get an authenticated dashboard: incoming appointments, patient details, notification feed.

**Other systems** can create appointments programmatically. `/api/external` is key-authenticated, so a clinic website or a CRM can book into the same calendar without a human in the loop. Keys are issued and revoked from the dashboard.

---

## Data model

Five tables in PostgreSQL via Supabase:

| Table | |
|---|---|
| `doctors` | Practitioner records and availability |
| `patients` | Patient details, created on first booking |
| `appointments` | Bookings linking doctor ↔ patient with slot and status |
| `api_keys` | Issued keys for external integrations, revocable |
| `notifications` | Delivery log for booking events |

---

## Structure

```
app/
├── api/         auth · external (key-authenticated) · notify
├── book/        public patient booking flow
└── doctor/      login + dashboard (protected)
lib/
├── supabase.ts  client + queries
├── auth.tsx     session handling
├── crm.ts       CRM integration
└── notifications.ts
```

**Stack:** Next.js (App Router) · TypeScript · Supabase (PostgreSQL + Auth) · Tailwind · Vercel

---

## Running it

```bash
npm install
cp .env.example .env.local     # add Supabase URL + anon key
npm run dev
```

Apply `supabase_schema.sql` to your Supabase project before first run.

---

Built by [Yash Rawal](https://github.com/yaashhrawal).
