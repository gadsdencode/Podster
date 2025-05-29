import { db } from './db';
import { episodes } from '../shared/schema';
import { TranscriptFormatter } from './transcript-formatter';
import dotenv from 'dotenv';

dotenv.config();

async function debugTranscriptFormatting() {
  try {
    console.log('🔍 Debugging transcript formatting...\n');
    
    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('OpenAI API Key:', apiKey ? '✅ SET' : '❌ NOT SET');
    
    if (!apiKey) {
      console.log('❌ OpenAI API key is not set. Transcript formatting will not work.');
      return;
    }
    
    // Get all episodes from database
    console.log('\n📊 Checking episodes in database...');
    const allEpisodes = await db.select().from(episodes);
    console.log(`Found ${allEpisodes.length} episodes in database\n`);
    
    if (allEpisodes.length === 0) {
      console.log('No episodes found in database.');
      return;
    }
    
    // Check each episode for formatted transcript data
    for (const episode of allEpisodes) {
      console.log(`📝 Episode ${episode.id}: "${episode.title}"`);
      console.log(`   Status: ${episode.status}`);
      console.log(`   Has transcript: ${episode.transcript ? '✅' : '❌'}`);
      console.log(`   Has formatted transcript: ${episode.formattedTranscript ? '✅' : '❌'}`);
      console.log(`   Has transcript paragraphs: ${episode.transcriptParagraphs ? '✅' : '❌'}`);
      console.log(`   Has transcript metadata: ${episode.transcriptMetadata ? '✅' : '❌'}`);
      
      if (episode.transcript && !episode.formattedTranscript) {
        console.log(`   ⚠️  Episode has raw transcript but no formatted version`);
        
        // Test formatting for this episode
        try {
          console.log(`   🤖 Testing AI formatting...`);
          const formatter = new TranscriptFormatter();
          const sampleText = episode.transcript.substring(0, 500); // Test with first 500 chars
          const result = await formatter.formatTranscript(sampleText);
          console.log(`   ✅ AI formatting works! Generated ${result.processingMetadata.paragraphCount} paragraphs`);
          
          // Show a sample of the formatted text
          const preview = result.formatted.substring(0, 200);
          console.log(`   📄 Preview: "${preview}..."`);
        } catch (error) {
          console.log(`   ❌ AI formatting failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      console.log(''); // Empty line for readability
    }
    
    // Check if there are any episodes that should be reprocessed
    const episodesNeedingFormatting = allEpisodes.filter(ep => 
      ep.transcript && !ep.formattedTranscript && ep.status === 'completed'
    );
    
    if (episodesNeedingFormatting.length > 0) {
      console.log(`\n🔧 Found ${episodesNeedingFormatting.length} episodes that need formatting:`);
      episodesNeedingFormatting.forEach(ep => {
        console.log(`   - Episode ${ep.id}: "${ep.title}"`);
      });
      console.log('\nTo fix this, you can:');
      console.log('1. Reprocess these episodes through the UI');
      console.log('2. Run a batch update script to format existing transcripts');
    }
    
  } catch (error) {
    console.error('❌ Error debugging transcript formatting:', error);
  } finally {
    process.exit(0);
  }
}

debugTranscriptFormatting(); 