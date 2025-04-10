#!/usr/bin/env python3
"""
REST API client for DataCrunch and Hugging Face API services
for high-quality speech synthesis without requiring local model loading
"""

import os
import json
import base64
import logging
import requests
import io
import numpy as np
from typing import List, Optional, Union, Dict, Any
import soundfile as sf
import tempfile
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("api_client")

class Segment:
    """
    A segment representing text or audio for conversation context
    """
    def __init__(self, speaker: int, text: str):
        """
        Initialize a segment
        
        Args:
            speaker: Speaker ID (0 for female, 1 for male)
            text: Text content
        """
        self.speaker = speaker
        self.text = text


class APIClientGenerator:
    """
    A client for remote API services (DataCrunch and HuggingFace Inference API)
    that provide text-to-speech capabilities
    """
    def __init__(
        self, 
        model_id="facebook/mms-tts-eng",  # Default model that works with HF Inference API
        datacrunch_url=None,
        datacrunch_api_key=None,
        huggingface_api_key=None,
        prefer_service="datacrunch"  # Which service to try first: "datacrunch" or "huggingface"
    ):
        """
        Initialize the generator with API connection parameters
        
        Args:
            model_id: The Hugging Face model ID to use
            datacrunch_url: The URL of the DataCrunch instance API endpoint
            datacrunch_api_key: API key for authentication with DataCrunch
            huggingface_api_key: API key for Hugging Face Inference API
            prefer_service: Which service to try first ("datacrunch" or "huggingface")
        """
        self.model_id = model_id
        
        # DataCrunch config
        self.datacrunch_url = datacrunch_url or os.environ.get("DATACRUNCH_URL")
        self.datacrunch_api_key = datacrunch_api_key or os.environ.get("DATACRUNCH_API_KEY")
        self.datacrunch_available = False
        
        # Hugging Face config
        self.huggingface_api_key = huggingface_api_key or os.environ.get("HUGGINGFACE_API_KEY")
        self.huggingface_api_url = f"https://api-inference.huggingface.co/models/{self.model_id}"
        self.huggingface_available = False
        
        # Service preference
        self.prefer_service = prefer_service
        
        # Initialize services
        self._init_services()
    
    def _init_services(self):
        """
        Test connections to available services
        """
        # Check DataCrunch availability if URL is provided
        if self.datacrunch_url:
            try:
                self._check_datacrunch_connection()
                self.datacrunch_available = True
                logger.info(f"Successfully connected to DataCrunch instance at {self.datacrunch_url}")
            except Exception as e:
                logger.warning(f"Failed to connect to DataCrunch instance: {str(e)}")
                self.datacrunch_available = False
        else:
            logger.warning("No DataCrunch URL provided. Set DATACRUNCH_URL environment variable.")
        
        # Check Hugging Face availability if API key is provided
        if self.huggingface_api_key:
            try:
                self._check_huggingface_connection()
                self.huggingface_available = True
                logger.info(f"Successfully connected to Hugging Face API for model {self.model_id}")
            except Exception as e:
                logger.warning(f"Failed to connect to Hugging Face API: {str(e)}")
                self.huggingface_available = False
        else:
            logger.warning("No Hugging Face API key provided. Set HUGGINGFACE_API_KEY environment variable.")
        
        # Set overall availability
        self.initialized = self.datacrunch_available or self.huggingface_available
        
        if not self.initialized:
            logger.error("No API services available. Please check your configuration.")
    
    def _check_datacrunch_connection(self):
        """
        Check if we can connect to the DataCrunch instance
        """
        if not self.datacrunch_url:
            return False
            
        # Create headers with API key if available
        headers = {
            "Content-Type": "application/json"
        }
        if self.datacrunch_api_key:
            headers["X-API-KEY"] = self.datacrunch_api_key
            
        # Make a simple status check request to test connectivity
        try:
            # Use models endpoint to check if connection works
            response = requests.get(
                f"{self.datacrunch_url.rstrip('/')}/models", 
                headers=headers,
                timeout=5
            )
            
            if response.status_code == 200:
                # Connection successful
                logger.info(f"Successfully connected to DataCrunch API - found {len(response.json().get('data', []))} models")
                return True
            elif response.status_code == 401:
                # Authentication error
                raise ConnectionError(f"DataCrunch API authentication failed: Invalid API key")
            else:
                # Other errors
                raise ConnectionError(f"DataCrunch API check failed with code {response.status_code}: {response.text}")
        except requests.RequestException as e:
            raise ConnectionError(f"Could not connect to DataCrunch API: {str(e)}")
            
        return False
    
    def _check_huggingface_connection(self):
        """
        Check if we can connect to the Hugging Face Inference API
        """
        if not self.huggingface_api_key:
            return False
            
        headers = {"Authorization": f"Bearer {self.huggingface_api_key}"}
        
        # Make a simple GET request to check if the model exists
        response = requests.get(
            self.huggingface_api_url,
            headers=headers,
            timeout=5
        )
        
        # 200 means model is ready, 404 means model doesn't exist
        # 503 often means the model is loading (first request)
        if response.status_code == 404:
            raise ConnectionError(f"Model {self.model_id} not found on Hugging Face Hub")
        
        return True
    
    def generate(
        self,
        text: str,
        speaker: int = 0,
        context: List[Segment] = None,
        max_audio_length_ms: float = 90000,
        temperature: float = 0.9,
        top_k: int = 50,
        output_path: str = None
    ) -> Dict[str, Any]:
        """
        Generate audio from text using the preferred API service
        
        Args:
            text: The text to convert to speech
            speaker: Speaker ID (0 for female, 1 for male)
            context: Previous conversation context (if supported by the model)
            max_audio_length_ms: Maximum length of generated audio in milliseconds
            temperature: Sampling temperature for generation
            top_k: Top-k sampling parameter
            output_path: Optional path to save the output audio file
            
        Returns:
            Dictionary with path to the generated audio file and other metadata
        """
        if not self.initialized:
            raise RuntimeError("No available API services. Check configuration and connectivity.")
        
        # Determine which service to try first based on preference
        services_to_try = []
        
        if self.prefer_service == "datacrunch" and self.datacrunch_available:
            services_to_try = ["datacrunch", "huggingface"]
        elif self.prefer_service == "huggingface" and self.huggingface_available:
            services_to_try = ["huggingface", "datacrunch"]
        elif self.datacrunch_available:
            services_to_try = ["datacrunch", "huggingface"]
        elif self.huggingface_available:
            services_to_try = ["huggingface"]
        
        # If no output path provided, create a temporary one
        if not output_path:
            temp_dir = tempfile.gettempdir()
            timestamp = int(time.time())
            output_path = os.path.join(temp_dir, f"speech_{timestamp}.wav")
        
        # Try services in order
        last_error = None
        for service in services_to_try:
            try:
                if service == "datacrunch" and self.datacrunch_available:
                    return self._generate_with_datacrunch(
                        text=text,
                        speaker=speaker,
                        context=context,
                        max_audio_length_ms=max_audio_length_ms,
                        temperature=temperature,
                        top_k=top_k,
                        output_path=output_path
                    )
                elif service == "huggingface" and self.huggingface_available:
                    return self._generate_with_huggingface(
                        text=text,
                        output_path=output_path
                    )
            except Exception as e:
                logger.warning(f"Failed to generate audio with {service}: {str(e)}")
                last_error = e
        
        # If we get here, all services failed
        raise RuntimeError(f"All available services failed to generate audio: {last_error}")
    
    def _generate_with_datacrunch(
        self,
        text: str,
        speaker: int,
        context: List[Segment] = None,
        max_audio_length_ms: float = 90000,
        temperature: float = 0.9,
        top_k: int = 50,
        output_path: str = None
    ) -> Dict[str, Any]:
        """
        Generate audio using DataCrunch API
        
        Args:
            Parameters match the generate method
            
        Returns:
            Dictionary with path to generated audio file and metadata
        """
        logger.info(f"Generating audio with DataCrunch for text: {text[:50]}...")
        
        # Prepare the request payload according to DataCrunch API docs
        payload = {
            "text": text,
            "voice_id": f"speaker_{speaker}",  # Convert speaker index to voice_id format
            "model_id": self.model_id,
            "settings": {
                "stability": 0.5,
                "similarity": 0.75,
                "style": 0.0,
                "speaker_boost": True,
                "temperature": temperature,
                "top_k": top_k,
                "max_duration_seconds": max_audio_length_ms / 1000.0  # Convert ms to seconds
            }
        }
        
        # Include context if provided
        if context:
            payload["context"] = [
                {
                    "speaker": f"speaker_{segment.speaker}",
                    "text": segment.text
                }
                for segment in context
            ]
        
        # Create headers with API key if available
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        if self.datacrunch_api_key:
            headers["X-API-KEY"] = self.datacrunch_api_key
        
        # Make the request to DataCrunch TTS endpoint
        url = f"{self.datacrunch_url}/tts" if self.datacrunch_url else ""
        if not url:
            raise ValueError("DataCrunch URL not set")
            
        # Remove any trailing slashes
        url = url.rstrip('/')
        
        response = requests.post(
            url, 
            json=payload,
            headers=headers,
            timeout=60  # Longer timeout as generation can take time
        )
        
        # Handle response
        if response.status_code != 200:
            raise RuntimeError(f"DataCrunch TTS generation failed with code {response.status_code}: {response.text}")
        
        # Parse the response
        try:
            result = response.json()
            
            # Check for success
            if not result.get("success", False):
                error_message = result.get("message", "Unknown error")
                raise RuntimeError(f"DataCrunch TTS generation failed: {error_message}")
            
            # Get audio data - assuming it comes as base64 string
            audio_data = result.get("audio_data") or result.get("data", {}).get("audio_data")
            if not audio_data:
                raise RuntimeError("No audio data in response")
                
            logger.info("Successfully received audio data from DataCrunch API")
            
        except ValueError as e:
            # Handle case where response might be raw audio data instead of JSON
            if response.headers.get("Content-Type", "").startswith("audio/"):
                logger.info("Received raw audio data from DataCrunch API")
                audio_data = response.content
            else:
                raise RuntimeError(f"Failed to parse DataCrunch API response: {str(e)}")
        
        # Decode the base64 audio data
        audio_bytes = base64.b64decode(audio_data)
        
        # Save the audio file
        with open(output_path, "wb") as f:
            f.write(audio_bytes)
        
        # Generate MP3 if ffmpeg is available
        mp3_path = output_path.replace(".wav", ".mp3")
        try:
            import subprocess
            subprocess.run([
                'ffmpeg',
                '-y',
                '-i', output_path,
                '-acodec', 'libmp3lame',
                '-ab', '192k',
                '-ac', '1',
                mp3_path
            ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            mp3_available = True
        except Exception as e:
            logger.warning(f"Failed to convert to MP3: {str(e)}")
            mp3_path = None
            mp3_available = False
        
        return {
            "success": True,
            "path": output_path,
            "mp3_path": mp3_path if mp3_available else None,
            "service": "datacrunch",
            "model": self.model_id
        }
    
    def _generate_with_huggingface(
        self,
        text: str,
        output_path: str = None
    ) -> Dict[str, Any]:
        """
        Generate audio using Hugging Face Inference API
        
        Args:
            text: The text to convert to speech
            output_path: Path to save the output audio file
            
        Returns:
            Dictionary with path to generated audio file and metadata
        """
        logger.info(f"Generating audio with Hugging Face API for text: {text[:50]}...")
        
        headers = {
            "Authorization": f"Bearer {self.huggingface_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "inputs": text
        }
        
        # The HF inference API has different behavior depending on the model
        # For TTS models, it returns the audio directly
        response = requests.post(
            self.huggingface_api_url,
            headers=headers,
            json=payload,
            timeout=60
        )
        
        if response.status_code != 200:
            raise RuntimeError(f"Hugging Face API request failed with status {response.status_code}: {response.text}")
        
        # For TTS models, the response should be the audio data
        try:
            # Save the audio file
            with open(output_path, "wb") as f:
                f.write(response.content)
            
            # Generate MP3 if ffmpeg is available
            mp3_path = output_path.replace(".wav", ".mp3")
            try:
                import subprocess
                subprocess.run([
                    'ffmpeg',
                    '-y',
                    '-i', output_path,
                    '-acodec', 'libmp3lame',
                    '-ab', '192k',
                    '-ac', '1',
                    mp3_path
                ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                mp3_available = True
            except Exception as e:
                logger.warning(f"Failed to convert to MP3: {str(e)}")
                mp3_path = None
                mp3_available = False
            
            return {
                "success": True,
                "path": output_path,
                "mp3_path": mp3_path if mp3_available else None,
                "service": "huggingface",
                "model": self.model_id
            }
        except Exception as e:
            # If we can't save the audio, something went wrong
            raise RuntimeError(f"Failed to process audio from Hugging Face API: {str(e)}")


def load_api_client(
    model_id="facebook/mms-tts-eng",
    datacrunch_url=None,
    datacrunch_api_key=None,
    huggingface_api_key=None,
    prefer_service="datacrunch"
) -> APIClientGenerator:
    """
    Create and initialize an API client for TTS services
    
    Args:
        model_id: The Hugging Face model ID to use
        datacrunch_url: The URL of the DataCrunch instance API endpoint
        datacrunch_api_key: API key for authentication with DataCrunch
        huggingface_api_key: API key for Hugging Face Inference API
        prefer_service: Which service to try first ("datacrunch" or "huggingface")
        
    Returns:
        An initialized APIClientGenerator instance
    """
    return APIClientGenerator(
        model_id=model_id,
        datacrunch_url=datacrunch_url,
        datacrunch_api_key=datacrunch_api_key,
        huggingface_api_key=huggingface_api_key,
        prefer_service=prefer_service
    )