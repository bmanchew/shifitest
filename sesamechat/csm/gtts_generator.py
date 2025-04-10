"""
Google Text-to-Speech Generator Module

This module provides integration with Google's Text-to-Speech service
through the gtts library. It's used as a fallback for DataCrunch TTS.
"""

import os
import logging
from typing import Optional
from gtts import gTTS

# Configure logging
logger = logging.getLogger(__name__)

class GttsGenerator:
    """
    Google Text-to-Speech generator that uses the gTTS library
    for voice synthesis.
    """
    
    def __init__(self):
        """Initialize the Google TTS generator."""
        pass
    
    def generate_speech(self, 
                       text: str, 
                       output_path: str, 
                       lang: str = 'en',
                       slow: bool = False) -> str:
        """
        Generate speech from text using Google TTS API.
        
        Args:
            text: The text to convert to speech
            output_path: Path to save the output WAV file
            lang: Language code (default: 'en')
            slow: Whether to speak slowly (default: False)
            
        Returns:
            Path to the generated audio file
        """
        if not text.strip():
            raise ValueError("Text cannot be empty")
        
        try:
            # Create gTTS object
            tts = gTTS(text=text, lang=lang, slow=slow)
            
            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Save to file
            tts.save(output_path)
            
            logger.info(f"Speech generated with Google TTS and saved to {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"Failed to generate speech with Google TTS: {str(e)}")
            raise