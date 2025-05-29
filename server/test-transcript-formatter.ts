import { TranscriptFormatter } from './transcript-formatter';
import dotenv from 'dotenv';

dotenv.config();

async function testTranscriptFormatter() {
  console.log('Testing Transcript Formatter...\n');
  
  // Sample raw transcript (simulating what we get from YouTube captions)
  const rawTranscript = `hello everyone welcome to this podcast today we are going to talk about artificial intelligence and machine learning this is a very exciting topic that has been gaining a lot of attention recently so lets dive right in first lets define what artificial intelligence actually means artificial intelligence or ai is the simulation of human intelligence in machines that are programmed to think and learn like humans the term may also be applied to any machine that exhibits traits associated with a human mind such as learning and problem solving now machine learning is a subset of artificial intelligence that focuses on the ability of machines to receive data and learn for themselves without being explicitly programmed machine learning algorithms build a mathematical model based on training data in order to make predictions or decisions without being explicitly programmed to do so this is really fascinating stuff and i think everyone should understand the basics of how these technologies work`;

  try {
    const formatter = new TranscriptFormatter();
    
    console.log('Raw transcript:');
    console.log('================');
    console.log(rawTranscript);
    console.log('\n');
    
    console.log('Formatting transcript...\n');
    const result = await formatter.formatTranscript(rawTranscript);
    
    console.log('Formatted transcript:');
    console.log('=====================');
    console.log(result.formatted);
    console.log('\n');
    
    console.log('Metadata:');
    console.log('=========');
    console.log(JSON.stringify(result.processingMetadata, null, 2));
    console.log('\n');
    
    console.log('Paragraphs:');
    console.log('===========');
    result.paragraphs.forEach((paragraph, index) => {
      console.log(`${index + 1}. ${paragraph}\n`);
    });
    
    console.log('Sentences:');
    console.log('==========');
    result.sentences.forEach((sentence, index) => {
      console.log(`${index + 1}. ${sentence.text}`);
    });
    
    console.log('\n✅ Transcript formatting test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing transcript formatter:', error);
    
    // Test fallback formatting
    console.log('\nTesting fallback formatting...');
    try {
      const formatter = new TranscriptFormatter();
      const fallbackResult = (formatter as any).fallbackFormat(rawTranscript);
      console.log('Fallback formatted transcript:');
      console.log(fallbackResult.formatted);
      console.log('\n✅ Fallback formatting works!');
    } catch (fallbackError) {
      console.error('❌ Fallback formatting also failed:', fallbackError);
    }
  }
}

// Run the test
testTranscriptFormatter().then(() => {
  console.log('\nTest completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
}); 