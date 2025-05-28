import re
import requests
import json
from urllib.parse import unquote
from typing import Optional, Dict

class CaptionScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        })

    def extract_captions_from_page(self, video_id: str) -> Optional[Dict]:
        """
        Extract captions directly from YouTube using multiple strategies
        """
        try:
            # Strategy 1: Try direct timedtext API
            caption_text = self._try_direct_timedtext_api(video_id)
            
            if not caption_text:
                # Strategy 2: Try transcript page scraping
                caption_text = self._try_transcript_page_scraping(video_id)
            
            if not caption_text or len(caption_text.strip()) < 50:
                return None
            
            # Get basic metadata
            title, upload_date, channel = self._get_basic_metadata(video_id)
            
            return {
                'transcript': caption_text,
                'title': title or f'Video {video_id}',
                'date': upload_date or '2024-01-01',
                'channel': channel or 'Unknown Channel',
                'video_id': video_id,
                'extraction_method': 'web_scraping'
            }
            
        except Exception as e:
            print(f"Error scraping captions for {video_id}: {e}")
            return None

    def _try_direct_timedtext_api(self, video_id: str) -> Optional[str]:
        """Try using youtube-transcript-api with authentication"""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            
            # Try without authentication first
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['en', 'en-US'])
            
            if transcript_list:
                # Combine all text segments
                full_text = ' '.join([item['text'] for item in transcript_list])
                return self._clean_text(full_text)
                
        except ImportError:
            print("youtube-transcript-api not available")
        except Exception as e:
            if "IP" in str(e) or "blocked" in str(e).lower():
                print(f"YouTube is blocking requests from this server. Trying web scraping: {e}")
                return None
            else:
                print(f"YouTube Transcript API failed: {e}")
            
        return None

    def _try_transcript_page_scraping(self, video_id: str) -> Optional[str]:
        """Try scraping the main video page for embedded captions"""
        try:
            url = f"https://www.youtube.com/watch?v={video_id}"
            response = self.session.get(url, timeout=15)
            
            if response.status_code != 200:
                return None
            
            html_content = response.text
            return self._extract_caption_data(html_content)
            
        except Exception as e:
            print(f"Page scraping failed: {e}")
            return None

    def _get_basic_metadata(self, video_id: str) -> tuple:
        """Get basic video metadata"""
        try:
            url = f"https://www.youtube.com/watch?v={video_id}"
            response = self.session.get(url, timeout=10)
            
            if response.status_code == 200:
                html = response.text
                title = self._extract_title(html)
                date = self._extract_upload_date(html)
                channel = self._extract_channel(html)
                return title, date, channel
        except:
            pass
        
        return None, None, None

    def _extract_title(self, html: str) -> Optional[str]:
        """Extract video title from HTML"""
        patterns = [
            r'"title"\s*:\s*"([^"]+)"',
            r'<title>([^<]+)</title>',
            r'property="og:title"\s+content="([^"]+)"'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                title = match.group(1)
                if ' - YouTube' in title:
                    title = title.replace(' - YouTube', '')
                return self._clean_text(title)
        return None

    def _extract_upload_date(self, html: str) -> Optional[str]:
        """Extract upload date from HTML"""
        patterns = [
            r'"uploadDate"\s*:\s*"([^"]+)"',
            r'"datePublished"\s*:\s*"([^"]+)"'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                date_str = match.group(1)
                try:
                    from datetime import datetime
                    # Parse ISO format date
                    date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    return date_obj.strftime('%Y-%m-%d')
                except:
                    continue
        return None

    def _extract_channel(self, html: str) -> Optional[str]:
        """Extract channel name from HTML"""
        patterns = [
            r'"author"\s*:\s*"([^"]+)"',
            r'"ownerChannelName"\s*:\s*"([^"]+)"',
            r'property="og:video:tag"\s+content="([^"]+)"'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                return self._clean_text(match.group(1))
        return None

    def _extract_caption_data(self, html: str) -> Optional[str]:
        """Extract caption/subtitle data from HTML"""
        try:
            # Look for the player config that contains caption track URLs
            player_config_pattern = r'ytInitialPlayerResponse\s*=\s*({.+?});'
            match = re.search(player_config_pattern, html)
            
            if match:
                try:
                    config_json = match.group(1)
                    player_data = json.loads(config_json)
                    
                    # Navigate to captions data
                    captions = player_data.get('captions', {})
                    caption_tracks = captions.get('playerCaptionsTracklistRenderer', {}).get('captionTracks', [])
                    
                    # Find English captions (prefer manual over auto-generated)
                    english_track = None
                    for track in caption_tracks:
                        if track.get('languageCode', '').startswith('en'):
                            if track.get('kind') != 'asr':  # Manual captions
                                english_track = track
                                break
                            elif english_track is None:  # Auto-generated as fallback
                                english_track = track
                    
                    if english_track and 'baseUrl' in english_track:
                        caption_url = english_track['baseUrl']
                        caption_text = self._download_caption_file(caption_url)
                        if caption_text and len(caption_text.strip()) > 100:
                            return caption_text
                
                except json.JSONDecodeError:
                    print("Failed to parse player config JSON")
            
            return None
            
        except Exception as e:
            print(f"Error extracting caption data: {e}")
            return None

    def _download_caption_file(self, url: str) -> Optional[str]:
        """Download and parse caption file from URL"""
        try:
            # Decode URL if needed
            if '\\u' in url:
                url = url.encode().decode('unicode_escape')
            
            response = self.session.get(url, timeout=10)
            if response.status_code == 200:
                content = response.text
                
                # Parse different caption formats
                if '<text' in content:  # XML format
                    return self._parse_xml_captions(content)
                elif '"text"' in content:  # JSON format
                    return self._parse_json_captions(content)
                else:  # Plain text
                    return self._clean_text(content)
            
        except Exception as e:
            print(f"Error downloading caption file: {e}")
        
        return None

    def _parse_xml_captions(self, xml_content: str) -> str:
        """Parse XML caption format (YouTube's timedtext format)"""
        # Extract ALL text elements using the most comprehensive approach
        text_matches = re.findall(r'<text[^>]*>([^<]+)</text>', xml_content, re.DOTALL)
        
        print(f"Found {len(text_matches)} text elements in XML")
        
        if text_matches:
            print(f"Raw text matches found: {len(text_matches)} elements")
            
            # Join all text with absolutely minimal processing to capture everything
            raw_transcript = ' '.join(text_matches)
            print(f"Raw joined transcript: {len(raw_transcript)} characters")
            
            # Only normalize whitespace, keep all content
            full_transcript = raw_transcript.replace('\xa0', ' ').replace('\n', ' ')
            full_transcript = re.sub(r'\s+', ' ', full_transcript).strip()
            
            print(f"Final processed transcript: {len(full_transcript)} characters from {len(text_matches)} text elements")
            
            # Ensure we're getting the complete content
            if len(full_transcript) < 38000:
                print(f"WARNING: Transcript may be incomplete - only {len(full_transcript)} chars (expected ~38K+)")
            
            return full_transcript
        
        # If no text elements found, try extracting all content between tags
        print("No text elements found, trying fallback extraction")
        simple_text = re.sub(r'<[^>]+>', ' ', xml_content)
        cleaned_fallback = self._clean_text(simple_text)
        print(f"Fallback extraction: {len(cleaned_fallback)} characters")
        return cleaned_fallback

    def _parse_json_captions(self, json_content: str) -> str:
        """Parse JSON caption format"""
        try:
            data = json.loads(json_content)
            
            # Handle YouTube's JSON3 format
            if 'events' in data:
                text_parts = []
                for event in data['events']:
                    if 'segs' in event:
                        for seg in event['segs']:
                            if 'utf8' in seg:
                                text_parts.append(seg['utf8'])
                    # Also check for direct text in events
                    elif 'utf8' in event:
                        text_parts.append(event['utf8'])
                
                if text_parts:
                    full_transcript = ' '.join([self._clean_text(text) for text in text_parts if text])
                    print(f"Extracted {len(full_transcript)} characters from JSON captions")
                    return full_transcript
            
            # Handle other JSON formats that might have text arrays
            if 'body' in data and isinstance(data['body'], list):
                text_parts = []
                for item in data['body']:
                    if isinstance(item, dict) and 'utf8' in item:
                        text_parts.append(item['utf8'])
                    elif isinstance(item, str):
                        text_parts.append(item)
                
                if text_parts:
                    full_transcript = ' '.join([self._clean_text(text) for text in text_parts if text])
                    print(f"Extracted {len(full_transcript)} characters from JSON body")
                    return full_transcript
            
            return None
            
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            return None

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text while preserving maximum content"""
        if not text:
            return ""
        
        # Decode HTML entities more comprehensively
        text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
        text = text.replace('&quot;', '"').replace('&#39;', "'").replace('&apos;', "'")
        text = text.replace('&nbsp;', ' ')
        
        # Handle special unicode characters that YouTube uses
        text = text.replace('\xa0', ' ')  # Non-breaking space
        text = text.replace('\n', ' ')   # Convert newlines to spaces
        
        # Normalize whitespace but preserve content
        text = re.sub(r'\s+', ' ', text)
        
        # Only remove very obvious caption artifacts, keep everything else
        text = re.sub(r'\[Music\]', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\[Applause\]', '', text, flags=re.IGNORECASE)
        
        return text.strip()

if __name__ == "__main__":
    scraper = CaptionScraper()
    result = scraper.extract_captions_from_page("dQw4w9WgXcQ")
    if result:
        print(f"Title: {result['title']}")
        print(f"Transcript: {result['transcript'][:200]}...")
    else:
        print("Failed to extract captions")