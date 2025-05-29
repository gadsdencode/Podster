import { db } from './db';
import { episodes } from '../shared/schema';
import { TranscriptFormatter } from './transcript-formatter';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function batchFormatTranscripts() {
  try {
    console.log('🚀 Starting batch transcript formatting...\n');
    
    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('❌ OpenAI API key is not set. Cannot proceed.');
      return;
    }
    
    // Get episodes that need formatting
    const allEpisodes = await db.select().from(episodes);
    const episodesNeedingFormatting = allEpisodes.filter(ep => 
      ep.transcript && 
      !ep.formattedTranscript && 
      ep.status === 'completed' &&
      ep.transcript.length > 50 // Only format substantial transcripts
    );
    
    console.log(`Found ${episodesNeedingFormatting.length} episodes that need formatting\n`);
    
    if (episodesNeedingFormatting.length === 0) {
      console.log('✅ All episodes already have formatted transcripts!');
      return;
    }
    
    const formatter = new TranscriptFormatter();
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < episodesNeedingFormatting.length; i++) {
      const episode = episodesNeedingFormatting[i];
      console.log(`📝 Processing Episode ${episode.id}: "${episode.title}" (${i + 1}/${episodesNeedingFormatting.length})`);
      
      try {
        // Format the transcript
        console.log(`   🤖 Formatting transcript (${episode.transcript!.length} characters)...`);
        const result = await formatter.formatTranscript(episode.transcript!);
        
        // Update the database
        await db.update(episodes)
          .set({
            formattedTranscript: result.formatted,
            transcriptSentences: result.sentences,
            transcriptParagraphs: result.paragraphs,
            transcriptMetadata: result.processingMetadata
          })
          .where(eq(episodes.id, episode.id));
        
        console.log(`   ✅ Success! Generated ${result.processingMetadata.paragraphCount} paragraphs, ${result.processingMetadata.sentenceCount} sentences`);
        successCount++;
        
        // Add a small delay to avoid rate limiting
        if (i < episodesNeedingFormatting.length - 1) {
          console.log(`   ⏳ Waiting 2 seconds to avoid rate limiting...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
        failureCount++;
      }
      
      console.log(''); // Empty line for readability
    }
    
    console.log(`\n🎉 Batch formatting complete!`);
    console.log(`   ✅ Successfully formatted: ${successCount} episodes`);
    console.log(`   ❌ Failed to format: ${failureCount} episodes`);
    
    if (successCount > 0) {
      console.log(`\n💡 The enhanced transcript viewer will now show formatted versions for these episodes!`);
    }
    
  } catch (error) {
    console.error('❌ Error in batch formatting:', error);
  } finally {
    process.exit(0);
  }
}

batchFormatTranscripts(); 