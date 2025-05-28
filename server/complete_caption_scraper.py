import re
import requests
import json
import html
from typing import Optional, Dict

def extract_complete_transcript(video_id: str) -> Optional[str]:
    """Extract the complete YouTube transcript with maximum content preservation"""
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    })
    
    try:
        # Get the video page
        url = f"https://www.youtube.com/watch?v={video_id}"
        response = session.get(url, timeout=15)
        
        if response.status_code != 200:
            return None
        
        html_content = response.text
        
        # Extract player configuration
        player_config_pattern = r'ytInitialPlayerResponse\s*=\s*({.+?});'
        match = re.search(player_config_pattern, html_content)
        
        if not match:
            return None
        
        config_json = match.group(1)
        player_data = json.loads(config_json)
        
        # Navigate to captions
        captions = player_data.get('captions', {})
        caption_tracks = captions.get('playerCaptionsTracklistRenderer', {}).get('captionTracks', [])
        
        # Find English captions
        english_track = None
        for track in caption_tracks:
            if track.get('languageCode', '').startswith('en'):
                english_track = track
                break
        
        if not english_track or 'baseUrl' not in english_track:
            return None
        
        # Download caption file
        caption_url = english_track['baseUrl']
        caption_response = session.get(caption_url, timeout=10)
        
        if caption_response.status_code != 200:
            return None
        
        caption_content = caption_response.text
        
        # Extract ALL text elements
        text_matches = re.findall(r'<text[^>]*>([^<]+)</text>', caption_content, re.DOTALL)
        
        if not text_matches:
            return None
        
        # Join with minimal processing - preserve maximum content
        complete_transcript = ' '.join(text_matches)
        
        # Decode HTML entities first
        complete_transcript = html.unescape(complete_transcript)
        
        # Only essential normalization
        complete_transcript = complete_transcript.replace('\xa0', ' ')  # Non-breaking spaces
        complete_transcript = complete_transcript.replace('\n', ' ')   # Newlines to spaces
        complete_transcript = re.sub(r'\s+', ' ', complete_transcript)  # Multiple spaces to single
        complete_transcript = complete_transcript.strip()
        
        print(f"Complete transcript extracted: {len(complete_transcript)} characters from {len(text_matches)} elements")
        
        return complete_transcript
        
    except Exception as e:
        print(f"Error extracting complete transcript: {e}")
        return None

if __name__ == "__main__":
    result = extract_complete_transcript("59aRc_KCu3s")
    if result:
        print(f"Success: {len(result)} characters")
        print(f"Preview: {result[:100]}...")
    else:
        print("Failed to extract transcript")