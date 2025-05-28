import puppeteer from 'puppeteer';

/**
 * Extract YouTube captions using browser automation
 * This is a fallback method when other extraction methods fail
 * 
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} - The extracted transcript or null if failed
 */
export async function extractCaptionsWithPuppeteer(videoId) {
  console.log(`Starting Puppeteer extraction for video: ${videoId}`);
  let browser = null;
  
  try {
    // Launch browser in headless mode
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,720',
      ]
    });
    
    const page = await browser.newPage();
    
    // Set user agent to mimic real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    
    // Enable request interception to monitor network
    await page.setRequestInterception(true);
    
    let captionsData = null;
    
    // Listen for network requests to capture captions
    page.on('request', request => {
      request.continue();
    });
    
    page.on('response', async response => {
      const url = response.url();
      
      // Capture timedtext responses
      if (url.includes('timedtext') && url.includes('lang=en')) {
        try {
          const text = await response.text();
          console.log(`Captured captions data: ${text.length} bytes`);
          captionsData = text;
        } catch (e) {
          console.error(`Failed to read captions response: ${e.message}`);
        }
      }
    });
    
    // Navigate to video page
    console.log(`Navigating to YouTube video: ${videoId}`);
    await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('Page loaded, looking for captions button');
    
    // Wait for the video player to load
    await page.waitForSelector('.ytp-chrome-bottom', { timeout: 15000 });
    
    // Try to enable captions by clicking the CC button
    try {
      // Find and click the CC button if it exists
      const ccButton = await page.$('.ytp-subtitles-button');
      if (ccButton) {
        console.log('Found CC button, clicking...');
        await ccButton.click();
        // Wait a bit to capture captions
        await page.waitForTimeout(2000);
      } else {
        console.log('CC button not found');
      }
    } catch (e) {
      console.log(`Failed to click CC button: ${e.message}`);
    }
    
    if (!captionsData) {
      console.log('No captions data captured via network, trying alternate method');
      
      // Try to extract from player data in page
      try {
        captionsData = await page.evaluate(() => {
          // Try to find the ytInitialPlayerResponse
          const scriptText = Array.from(document.querySelectorAll('script'))
            .map(script => script.textContent)
            .find(text => text && text.includes('captionTracks'));
          
          if (!scriptText) return null;
          
          // Extract caption tracks
          const match = scriptText.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
          if (!match) return null;
          
          try {
            const playerData = JSON.parse(match[1]);
            const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            
            if (!captions || !captions.length) return null;
            
            // Find English captions
            const englishTrack = captions.find(track => 
              track.languageCode && track.languageCode.startsWith('en')
            );
            
            if (!englishTrack || !englishTrack.baseUrl) return null;
            
            return englishTrack.baseUrl;
          } catch (e) {
            console.error('Error parsing player data:', e);
            return null;
          }
        });
        
        if (captionsData) {
          console.log('Found caption URL in page data, fetching captions');
          // Make a separate request to get the caption data
          const captionPage = await browser.newPage();
          const response = await captionPage.goto(captionsData, { 
            waitUntil: 'networkidle0',
            timeout: 10000
          });
          captionsData = await response.text();
          await captionPage.close();
        }
      } catch (e) {
        console.error(`Error extracting captions from page: ${e.message}`);
      }
    }
    
    // If we still don't have captions, try one last method
    if (!captionsData) {
      console.log('Still no captions, trying transcript page');
      try {
        // Go to transcript page
        await page.goto(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
          waitUntil: 'networkidle2',
          timeout: 15000
        });
        
        // Try to open transcript panel
        const moreActions = await page.$('button[aria-label="More actions"]');
        if (moreActions) {
          await moreActions.click();
          
          // Wait for menu to appear
          await page.waitForTimeout(1000);
          
          // Look for "Show transcript" option and click it
          const menuItems = await page.$$('tp-yt-paper-item');
          for (const item of menuItems) {
            const text = await page.evaluate(el => el.textContent, item);
            if (text && text.includes('transcript')) {
              await item.click();
              
              // Wait for transcript panel to appear
              await page.waitForTimeout(2000);
              
              // Extract transcript text
              const transcriptSegments = await page.$$eval(
                'yt-formatted-string.ytd-transcript-segment-renderer', 
                segments => segments.map(s => s.textContent.trim())
              );
              
              if (transcriptSegments && transcriptSegments.length > 0) {
                captionsData = transcriptSegments.join(' ');
                console.log(`Extracted ${transcriptSegments.length} transcript segments`);
              }
              
              break;
            }
          }
        }
      } catch (e) {
        console.error(`Error with transcript page: ${e.message}`);
      }
    }
    
    if (!captionsData) {
      console.log('Failed to extract captions with all methods');
      return null;
    }
    
    // Parse the captions data
    let transcriptText = '';
    
    if (typeof captionsData === 'string') {
      if (captionsData.includes('<text')) {
        // XML format
        const textMatches = captionsData.match(/<text[^>]*>([^<]+)<\/text>/g);
        if (textMatches) {
          transcriptText = textMatches.map(match => {
            const textContent = match.replace(/<[^>]+>/g, '');
            return decodeHTMLEntities(textContent);
          }).join(' ');
        }
      } else if (captionsData.startsWith('{')) {
        // JSON format (try parsing)
        try {
          const data = JSON.parse(captionsData);
          if (data.events) {
            transcriptText = data.events
              .filter(event => event.segs)
              .flatMap(event => event.segs)
              .filter(seg => seg.utf8)
              .map(seg => seg.utf8)
              .join(' ');
          }
        } catch (e) {
          console.error(`Failed to parse JSON captions: ${e.message}`);
        }
      } else {
        // Plain text or other format
        transcriptText = captionsData.replace(/\n/g, ' ').trim();
      }
    }
    
    // Clean up transcript
    transcriptText = transcriptText
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`Final transcript length: ${transcriptText.length} characters`);
    
    return transcriptText.length > 50 ? transcriptText : null;
  } catch (error) {
    console.error(`Puppeteer extraction error: ${error.message}`);
    return null;
  } finally {
    // Always close the browser
    if (browser) {
      await browser.close();
    }
  }
}

// Helper function to decode HTML entities
function decodeHTMLEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' '
  };
  
  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, match => entities[match]);
}

// Test the function directly if run as script
if (import.meta.url === `file://${process.argv[1]}`) {
  const videoId = process.argv[2] || 'cbfbS18mcUY';  // Default to the video ID from error logs
  
  (async () => {
    try {
      console.log(`Testing Puppeteer extraction with video ID: ${videoId}`);
      const transcript = await extractCaptionsWithPuppeteer(videoId);
      if (transcript) {
        console.log(`Success! Extracted ${transcript.length} characters`);
        console.log(`Preview: ${transcript.substring(0, 150)}...`);
      } else {
        console.log('Failed to extract transcript');
        process.exit(1);
      }
    } catch (e) {
      console.error(`Error during extraction: ${e.message}`);
      process.exit(1);
    }
  })();
} 