import { db } from './db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    console.log('Adding keywords and extractKeywords columns...');
    
    // Add keywords and extractKeywords columns if they don't exist
    await db.execute(sql`
      ALTER TABLE episodes 
      ADD COLUMN IF NOT EXISTS keywords JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS extract_keywords BOOLEAN DEFAULT false;
    `);
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main(); 