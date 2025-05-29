import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import * as schema from '@shared/schema';

// Load environment variables
dotenv.config();

// Choose DATABASE_URL (private network) for production or DATABASE_PUBLIC_URL for local development
const connectionString = process.env.NODE_ENV === 'production' 
  ? process.env.DATABASE_URL 
  : process.env.DATABASE_PUBLIC_URL;

if (!connectionString) {
  throw new Error('Database connection string not available');
}

// Create the connection
const client = postgres(connectionString);

// Create the Drizzle instance with schema
export const db = drizzle(client, { schema }); 