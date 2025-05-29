import { db } from './db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Adding formatted transcript columns...');
    
    // Add formatted transcript columns if they don't exist
    await db.execute(sql`
      ALTER TABLE episodes 
      ADD COLUMN IF NOT EXISTS formatted_transcript TEXT,
      ADD COLUMN IF NOT EXISTS transcript_sentences JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS transcript_paragraphs JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS transcript_metadata JSONB;
    `);
    
    console.log('Formatted transcript migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main(); 