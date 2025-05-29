import { db } from './db';
import { users, episodes, searchQueries, processingQueue } from '@shared/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure we have a database URL
if (!process.env.DATABASE_PUBLIC_URL) {
  console.error("DATABASE_PUBLIC_URL not set");
  process.exit(1);
}

// For migration, we need a separate connection
const migrationClient = postgres(process.env.DATABASE_PUBLIC_URL!, { max: 1 });

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

// Add function to create a new migration
const createEnhancedTranscriptMigration = async () => {
  try {
    console.log("Creating migration for enhancedTranscript field...");
    
    // Create a temporary connection to the database
    const sql = postgres(process.env.DATABASE_PUBLIC_URL!, { max: 1 });
    
    // Create the migration SQL
    const migrationSQL = `
      -- Add enhancedTranscript and hasEnhancedTranscript columns to episodes table
      ALTER TABLE episodes ADD COLUMN IF NOT EXISTS enhanced_transcript TEXT;
      ALTER TABLE episodes ADD COLUMN IF NOT EXISTS has_enhanced_transcript BOOLEAN DEFAULT FALSE;
    `;
    
    // Create the migration file
    const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, "").substring(0, 14);
    const migrationName = `${timestamp}_add_enhanced_transcript`;
    const migrationPath = path.join(__dirname, "../migrations", migrationName);
    
    // Ensure migrations directory exists
    const fs = await import("fs/promises");
    await fs.mkdir(path.join(__dirname, "../migrations"), { recursive: true });
    
    // Write the migration file
    await fs.writeFile(`${migrationPath}.sql`, migrationSQL);
    
    console.log(`Migration file created: migrations/${migrationName}.sql`);
    console.log("Now run 'npm run migrate' to apply the migration.");
    
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error("Failed to create migration:", error);
    process.exit(1);
  }
};

// Check command line arguments
const command = process.argv[2];

if (command === "create-transcript-migration") {
  createEnhancedTranscriptMigration();
} else {
  main();
} 