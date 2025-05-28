# Podster YouTube Caption Extraction

This project includes multiple methods for extracting YouTube video transcripts:

## TypeScript-Based Caption Extraction (No Python Required)

The application now uses a pure TypeScript/JavaScript-based solution for extracting YouTube captions, eliminating the need for Python dependencies. The extraction system works in three progressive levels:

1. **Basic Scraper**: First attempts to extract captions using simple HTTP requests and regex.
2. **Advanced Scraper**: Uses multiple specialized extraction techniques for harder cases.
3. **Puppeteer Fallback**: As a last resort, uses browser automation to extract captions.

## How to Use

The extraction is automatically selected when processing videos. If you need to use it directly:

```typescript
import { extractTranscript } from './server/routes';

// Using the TypeScript-based scraping methods:
const transcript = await extractTranscript('videoId', 'scraping');
```

## Troubleshooting

If you encounter issues with caption extraction:

1. Check that the video has captions available on YouTube
2. Try a different extraction method
3. Look at the console logs for detailed error information

## Credits

This implementation combines several approaches to provide reliable caption extraction without external dependencies. 