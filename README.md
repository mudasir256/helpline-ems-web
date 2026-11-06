# Helpline EMS — Admin Dashboard

Next.js admin dashboard for Helpline Welfare Trust. Manage projects, employees, attendance, and daily reports.

Staff mobile app lives in a separate repo: [helpline-ems-mobile](https://github.com/helplineorgpk-web/helpline-ems-mobile).

## Setup

Requires a local MongoDB **replica set** on `127.0.0.1:27017` (Prisma needs this for upserts/transactions). Database `helplineems` is created automatically.

```bash
# Start MongoDB as a single-node replica set (once per machine)
mongod --dbpath=/path/to/data/db --replSet rs0 --bind_ip 127.0.0.1

# In mongosh (only the first time):
# rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })

npm install
cp .env.example .env
npx prisma db push
npm run db:seed:admin   # admin only
# or: npm run db:seed   # full demo data (admin + employees + projects)
npm run dev
```

Open [http://localhost:3002](http://localhost:3002)

### Admin login
- Email: `admin@helpline.org`
- Password: `admin123`

### Demo employee (for the staff app)
- Email: `ahmed@helpline.org`
- Password: `Emp@123`

## Stack

- Next.js App Router + TypeScript
- Prisma + MongoDB
- JWT cookies for admin, Bearer JWT for employees

## Attendance rules

- **8 PM auto check-out.** Duty closes at 8:00 PM Pakistan time. `vercel.json` runs `/api/cron/auto-checkout` daily at 15:00 UTC, and every attendance read also closes overdue records, so the result is the same if the cron is late. Set `CRON_SECRET` on Vercel; the endpoint refuses requests without it.
- **Late reports.** Staff can add a missed daily report within 3 days, at most 2 per month (`src/lib/late-reports.ts`).
- **7:30 PM reminder.** The staff app schedules a local notification on the phone while the employee is on duty; nothing is sent from the server.

## Exports

Attendance and Daily Reports pages have an **Export** panel: pick a date range (default: this month, up to 92 days) and download a CSV that opens in Excel. The attendance file includes an `Absent` row for every active employee who did not check in that day (only when no project is selected). Endpoints: `GET /api/admin/export/attendance` and `GET /api/admin/export/reports`, listed on the Mobile App APIs page after `npm run db:seed:apis` (run it once against each database after adding endpoints to `src/lib/api-catalog.ts`).
