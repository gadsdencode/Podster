import re
import requests
import json
import html
import sys
import time
import random
from typing import Optional, Dict, Tuple

def extract_complete_transcript(video_id: str) -> Optional[str]:
    """Extract the complete YouTube transcript with maximum content preservation"""
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Referer': 'https://www.google.com/',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
    })
    
    try:
        print(f"Starting transcript extraction for video ID: {video_id}")
        
        # Get the video page
        url = f"https://www.youtube.com/watch?v={video_id}"
        print(f"Fetching main video page: {url}")
        
        # Add retry mechanism
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = session.get(url, timeout=15)
                break
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    wait_time = 2 * (attempt + 1) + random.uniform(0, 1)
                    print(f"Request failed, retrying in {wait_time:.1f}s: {e}")
                    time.sleep(wait_time)
                else:
                    raise
        
        print(f"Video page response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Failed to fetch video page: HTTP {response.status_code}")
            return None
        
        html_content = response.text
        html_length = len(html_content)
        print(f"Received HTML content: {html_length} characters")
        
        if html_length < 5000:
            print("Warning: HTML content is suspiciously short, likely not complete")
            with open(f"debug_html_{video_id}.txt", "w", encoding="utf-8") as f:
                f.write(html_content)
            print(f"Saved debug HTML to debug_html_{video_id}.txt")
        
        # Extract player configuration
        player_config_pattern = r'ytInitialPlayerResponse\s*=\s*({.+?});'
        match = re.search(player_config_pattern, html_content)
        
        if not match:
            print("Failed to extract player configuration from HTML")
            
            # Try alternative pattern
            alt_pattern = r'"captions":({.+?}),"videoDetails"'
            alt_match = re.search(alt_pattern, html_content)
            
            if alt_match:
                print("Found captions data with alternative pattern")
                captions_data = json.loads(alt_match.group(1))
                # Process as needed
            else:
                print("Could not find caption data with any pattern")
                return None
        
        config_json = match.group(1)
        
        try:
            player_data = json.loads(config_json)
        except json.JSONDecodeError as e:
            print(f"Failed to parse player JSON: {e}")
            return None
        
        # Navigate to captions
        captions = player_data.get('captions', {})
        if not captions:
            print("No captions data found in player config")
            return None
            
        caption_tracks = captions.get('playerCaptionsTracklistRenderer', {}).get('captionTracks', [])
        
        if not caption_tracks:
            print("No caption tracks found in player config")
            return None
            
        print(f"Found {len(caption_tracks)} caption tracks")
        
        # Find English captions (or any available captions if English not found)
        english_track = None
        available_tracks = []
        
        for idx, track in enumerate(caption_tracks):
            lang = track.get('languageCode', '')
            name = track.get('name', {}).get('simpleText', '')
            kind = track.get('kind', '')
            base_url = track.get('baseUrl', '')
            
            track_info = f"Track {idx}: lang={lang}, name={name}, kind={kind}, has_url={'Yes' if base_url else 'No'}"
            available_tracks.append(track_info)
            print(track_info)
            
            if lang.startswith('en'):
                if not english_track or kind != 'asr':  # Prefer manual over auto-generated
                    english_track = track
        
        # If no English track, use the first available track
        if not english_track and caption_tracks:
            english_track = caption_tracks[0]
            print(f"No English track found, using {english_track.get('languageCode', 'unknown')} track instead")
        
        if not english_track or 'baseUrl' not in english_track:
            print(f"No suitable caption track found. Available tracks: {len(available_tracks)}")
            for track in available_tracks:
                print(f"  {track}")
            return None
        
        # Download caption file
        caption_url = english_track['baseUrl']
        print(f"Using caption URL: {caption_url[:100]}...")
        
        try:
            caption_response = session.get(caption_url, timeout=10)
        except requests.exceptions.RequestException as e:
            print(f"Failed to fetch caption data: {e}")
            return None
        
        if caption_response.status_code != 200:
            print(f"Caption request failed: HTTP {caption_response.status_code}")
            return None
        
        caption_content = caption_response.text
        print(f"Received caption content: {len(caption_content)} characters")
        
        # Extract ALL text elements
        text_matches = re.findall(r'<text[^>]*>([^<]+)</text>', caption_content, re.DOTALL)
        
        if not text_matches:
            print("No caption text matches found in response")
            
            # Try alternative caption format parsing
            text_matches = extract_captions_from_alternative_format(caption_content)
            if not text_matches:
                return None
        
        print(f"Extracted {len(text_matches)} caption segments")
        
        # Join with minimal processing - preserve maximum content
        complete_transcript = ' '.join(text_matches)
        
        # Decode HTML entities first
        complete_transcript = html.unescape(complete_transcript)
        
        # Only essential normalization
        complete_transcript = complete_transcript.replace('\xa0', ' ')  # Non-breaking spaces
        complete_transcript = complete_transcript.replace('\n', ' ')   # Newlines to spaces
        complete_transcript = re.sub(r'\s+', ' ', complete_transcript)  # Multiple spaces to single
        complete_transcript = complete_transcript.strip()
        
        transcript_length = len(complete_transcript)
        print(f"Complete transcript extracted: {transcript_length} characters from {len(text_matches)} elements")
        
        if transcript_length < 50:
            print(f"Warning: Extracted transcript is too short ({transcript_length} chars)")
            return None
        
        return complete_transcript
        
    except Exception as e:
        import traceback
        trace = traceback.format_exc()
        print(f"Error extracting complete transcript: {e}")
        print(f"Traceback: {trace}")
        return None

def extract_captions_from_alternative_format(content: str) -> list:
    """Try to extract captions from alternative formats"""
    
    # Try JSON format
    if content.strip().startswith('{'):
        try:
            data = json.loads(content)
            if 'events' in data:
                texts = []
                for event in data['events']:
                    if 'segs' in event.get('tStartMs', {}):
                        for seg in event['segs']:
                            if 'utf8' in seg:
                                texts.append(seg['utf8'])
                return texts
        except json.JSONDecodeError:
            pass
    
    # Try different XML formats
    xml_patterns = [
        r'<transcript>(.+?)</transcript>',
        r'<timedtext>(.+?)</timedtext>'
    ]
    
    for pattern in xml_patterns:
        match = re.search(pattern, content, re.DOTALL)
        if match:
            text_parts = re.findall(r'<text[^>]*>([^<]+)</text>', match.group(1), re.DOTALL)
            if text_parts:
                return text_parts
    
    return []

if __name__ == "__main__":
    if len(sys.argv) > 1:
        video_id = sys.argv[1]
    else:
        video_id = "59aRc_KCu3s"  # Default test video
        
    result = extract_complete_transcript(video_id)
    if result:
        print(f"Success: {len(result)} characters")
        print(f"Preview: {result[:100]}...")
    else:
        print("Failed to extract transcript")
        sys.exit(1)