import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// prepie runs on seeded mock data until you set DATABASE_URL.
// When it's present, `db` becomes a live Drizzle client; otherwise it's null
// and lib/data.ts falls back to the mock seed. This keeps `npm run dev`
// working with zero setup.
const connectionString = process.env.DATABASE_URL;

const client = connectionString
  ? postgres(connectionString, { prepare: false }) // prepare:false for Supabase pooler
  : null;

export const db = client ? drizzle(client, { schema }) : null;

export { schema };
