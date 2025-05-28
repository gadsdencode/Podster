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
        # More comprehensive regex to capture ALL text content, including multi-line and complex formats
        patterns = [
            r'<text[^>]*>([^<]+)</text>',  # Simple format
            r'<text[^>]*><!\[CDATA\[([^\]]+)\]\]></text>',  # CDATA format
            r'<text[^>]*>([^<]*(?:<[^/][^>]*>[^<]*</[^>]*>[^<]*)*)</text>'  # Complex nested format
        ]
        
        all_text = []
        for pattern in patterns:
            text_matches = re.findall(pattern, xml_content, re.DOTALL | re.MULTILINE)
            for match in text_matches:
                # Clean HTML entities and tags from the match
                cleaned_match = re.sub(r'<[^>]+>', '', match)
                cleaned = self._clean_text(cleaned_match)
                if cleaned and len(cleaned.strip()) > 1:
                    all_text.append(cleaned)
        
        if all_text:
            full_transcript = ' '.join(all_text)
            print(f"Extracted {len(full_transcript)} characters from XML captions")
            return full_transcript
        
        # Enhanced fallback: extract any text content with better regex
        simple_text = re.sub(r'<[^>]+>', ' ', xml_content)
        cleaned_fallback = self._clean_text(simple_text)
        print(f"Using fallback extraction: {len(cleaned_fallback)} characters")
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
        """Clean and normalize text"""
        if not text:
            return ""
        
        # Remove HTML entities
        text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
        text = text.replace('&quot;', '"').replace('&#39;', "'")
        
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove common caption artifacts
        text = re.sub(r'\[Music\]', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\[Applause\]', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\[Laughter\]', '', text, flags=re.IGNORECASE)
        
        return text.strip()

if __name__ == "__main__":
    scraper = CaptionScraper()
    result = scraper.extract_captions_from_page("dQw4w9WgXcQ")
    if result:
        print(f"Title: {result['title']}")
        print(f"Transcript: {result['transcript'][:200]}...")
    else:
        print("Failed to extract captions")