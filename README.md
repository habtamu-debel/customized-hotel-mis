# Fidel Palace

Hotel website and booking system for a single property in Bole, Addis Ababa. Guests can request a room. Staff run arrivals, housekeeping, billing, and reports.

## Run

MySQL from XAMPP must be running (this machine uses port **3307**).

```bash
cd server
npm install
npm run seed
npm run dev
```

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5175

## Staff

Password for every seeded account: `Palace@2026`

- owner@fidelpalace.com
- manager@fidelpalace.com
- desk@fidelpalace.com
- house@fidelpalace.com

`npm run seed` rebuilds the `fidel_palace` database.
