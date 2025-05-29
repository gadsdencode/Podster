import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import * as schema from '@shared/schema';

// Load environment variables
dotenv.config();

// Ensure the database URL is available
if (!process.env.DATABASE_PUBLIC_URL) {
  throw new Error('DATABASE_PUBLIC_URL environment variable is not set');
}

// Create the connection
const client = postgres(process.env.DATABASE_PUBLIC_URL);

// Create the Drizzle instance with schema
export const db = drizzle(client, { schema }); 