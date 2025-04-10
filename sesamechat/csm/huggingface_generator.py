"""
Hugging Face TTS Generator Module

This module provides integration with Hugging Face's TTS models
through their Inference API. It's used as a fallback for DataCrunch TTS.
"""

import os
import json
import base64
import logging
import requests
from typing import Optional, Tuple

# Configure logging
logger = logging.getLogger(__name__)

class HuggingFaceGenerator:
    """
    Hugging Face text-to-speech generator that uses the Hugging Face
    Inference API for voice synthesis.
    """
    
    # Constants
    DEFAULT_VOICE = "speaker_0"
    DEFAULT_MODEL = "facebook/mms-tts-eng"
    API_URL_BASE = "https://api-inference.huggingface.co/models/"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Hugging Face generator.
        
        Args:
            api_key: Hugging Face API key, defaults to env var HUGGINGFACE_API_KEY
        """
        # Get API key from environment if not provided
        self.api_key = api_key or os.getenv("HUGGINGFACE_API_KEY")
        
        # Check if we have a valid API key
        if not self.api_key:
            logger.warning("Hugging Face API key not found. Set HUGGINGFACE_API_KEY environment variable.")
    
    def generate_audio(self, 
                      text: str, 
                      voice: str = DEFAULT_VOICE,
                      model: Optional[str] = None) -> Tuple[bytes, float]:
        """
        Generate audio from text using Hugging Face TTS API.
        
        Args:
            text: The text to convert to speech
            voice: The voice ID to use (default: speaker_0)
            model: The model ID to use (defaults to facebook/mms-tts-eng)
            
        Returns:
            Tuple[bytes, float]: Audio data as bytes and duration in seconds
            
        Raises:
            ValueError: If there's an issue with the request or response
            RequestException: If the API request fails
        """
        if not text.strip():
            raise ValueError("Text cannot be empty")
            
        if not self.api_key:
            raise ValueError("Hugging Face API key is required")
        
        # Use provided model or default
        model_id = model or self.DEFAULT_MODEL
        
        # Prepare API URL
        api_url = f"{self.API_URL_BASE}{model_id}"
        
        # Prepare headers
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Prepare payload
        payload = {
            "inputs": text,
            "parameters": {
                "speaker": voice
            }
        }
        
        try:
            # Make API request
            logger.debug(f"Requesting speech synthesis from Hugging Face model: {model_id}")
            response = requests.post(
                api_url,
                headers=headers,
                json=payload,
                timeout=30  # Speech generation can take time
            )
            
            # Check response
            response.raise_for_status()
            
            # Audio is returned directly as bytes
            audio_data = response.content
            
            # Estimate duration (no duration info provided by API)
            # Assuming WAV format, ~32KB per second of audio as rough estimate
            estimated_duration = len(audio_data) / 32000
            
            return audio_data, estimated_duration
            
        except requests.exceptions.HTTPError as e:
            if response.status_code == 401:
                raise ValueError(f"Hugging Face API authentication error: {response.text}")
            elif response.status_code == 404:
                raise ValueError(f"Hugging Face model not found: {model_id}")
            else:
                raise ValueError(f"Hugging Face API error: {response.text}")
        except requests.exceptions.RequestException as e:
            raise e