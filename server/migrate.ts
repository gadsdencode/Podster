import { db } from './db';
import { users, episodes, searchQueries, processingQueue } from '@shared/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

dotenv.config();

// For migration, we need a separate connection
const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  try {
    console.log('Starting database migration...');
    
    // Ensure migrations directory exists
    const migrationsDir = './migrations';
    const metaDir = path.join(migrationsDir, 'meta');
    
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
      console.log('Created migrations directory');
    }
    
    if (!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir, { recursive: true });
      console.log('Created migrations meta directory');
    }
    
    // Create an empty journal file if it doesn't exist
    const journalPath = path.join(metaDir, '_journal.json');
    if (!fs.existsSync(journalPath)) {
      fs.writeFileSync(journalPath, JSON.stringify({ entries: [] }));
      console.log('Created empty journal file');
    }
    
    // Perform migration
    await migrate(drizzle(migrationClient), { migrationsFolder: migrationsDir });
    
    console.log('Migration completed successfully');
    
    // Seed initial admin user if needed
    const adminExists = await db.select().from(users).where(eq(users.username, 'admin'));
    
    if (adminExists.length === 0) {
      console.log('Creating default admin user...');
      await db.insert(users).values({
        username: "admin",
        email: "admin@transcriptai.com",
        password: "$2b$10$defaulthashedpassword", // In real app, this would be properly hashed
        role: "admin"
      });
      console.log('Default admin user created');
    }
    
    console.log('Database setup complete');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
    process.exit(0);
  }
}

main(); 