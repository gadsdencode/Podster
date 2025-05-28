import re
import os
import tempfile
from datetime import datetime
from typing import Optional, Dict
from youtube_transcript_api import YouTubeTranscriptApi
import requests
import yt_dlp
import whisper
from pydub import AudioSegment
from googleapiclient.discovery import build

class YouTubeHandler:
    def __init__(self):
        """Initialize YouTube handler"""
        self.whisper_model = None  # Load model only when needed to save memory
        self.youtube_api = None
        self._init_youtube_api()
    
    def _init_youtube_api(self):
        """Initialize YouTube Data API with authentication"""
        try:
            api_key = os.getenv('YOUTUBE_API_KEY')
            if api_key:
                self.youtube_api = build('youtube', 'v3', developerKey=api_key)
                print("YouTube API initialized successfully with authentication")
            else:
                print("YouTube API key not found, using fallback methods")
        except Exception as e:
            print(f"Failed to initialize YouTube API: {e}")
    
    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from various YouTube URL formats"""
        patterns = [
            r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]+)',
            r'(?:https?://)?(?:www\.)?youtu\.be/([a-zA-Z0-9_-]+)',
            r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]+)',
            r'(?:https?://)?(?:www\.)?youtube\.com/v/([a-zA-Z0-9_-]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    def get_video_metadata(self, video_id: str) -> Dict:
        """Get real video metadata using YouTube oEmbed API"""
        try:
            url = f"https://www.youtube.com/watch?v={video_id}"
            response = requests.get(f"https://www.youtube.com/oembed?url={url}&format=json")
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'title': data.get('title', f'Video {video_id}'),
                    'channel': data.get('author_name', 'Unknown Channel'),
                    'thumbnail_url': data.get('thumbnail_url', f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg'),
                    'video_id': video_id
                }
        except Exception as e:
            print(f"Error fetching metadata: {e}")
        
        return {
            'title': f'Video {video_id}',
            'channel': 'Unknown Channel',
            'thumbnail_url': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg',
            'video_id': video_id
        }

    def extract_transcript(self, video_id: str) -> Optional[str]:
        """Extract transcript using youtube-transcript-api"""
        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(
                video_id,
                languages=['en', 'en-US', 'en-GB']
            )
            
            # Combine transcript segments into full text
            full_transcript = ""
            for segment in transcript_list:
                full_transcript += segment['text'] + " "
            
            return full_transcript.strip()
            
        except Exception as e:
            raise Exception(f"Failed to extract transcript: {str(e)}")

if __name__ == "__main__":
    # Test the handler
    handler = YouTubeHandler()
    test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    video_id = handler.extract_video_id(test_url)
    if video_id:
        metadata = handler.get_video_metadata(video_id)
        print(f"Title: {metadata['title']}")
        print(f"Channel: {metadata['channel']}")