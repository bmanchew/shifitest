"""
DataCrunch TTS Generator Module

This module provides integration with DataCrunch TTS API.
It supports authentication with OAuth client credentials and
attempts to use the DataCrunch TTS endpoint for voice generation.

If the API is not available or returns errors, it will raise exceptions
that can be caught by the calling code to fall back to other TTS providers.
"""

import os
import json
import base64
import logging
import time
from typing import Optional, Dict, Any, Tuple

import requests
from requests.exceptions import RequestException

# Configure logging
logger = logging.getLogger(__name__)

class DataCrunchGenerator:
    """
    DataCrunch text-to-speech generator that uses the DataCrunch API
    for voice synthesis.
    """
    
    # Constants
    DEFAULT_VOICE = "speaker_0"
    DEFAULT_MODEL = "tts1"
    TOKEN_ENDPOINT = "https://api.datacrunch.io/v1/oauth2/token"
    TTS_ENDPOINT_BASE = "https://api.datacrunch.io"
    TTS_ENDPOINT_PATH = "/inference/tts"  # Most promising endpoint from testing
    
    def __init__(self, 
                 client_id: Optional[str] = None, 
                 client_secret: Optional[str] = None,
                 api_key: Optional[str] = None,
                 api_url: Optional[str] = None):
        """
        Initialize the DataCrunch generator.
        
        Args:
            client_id: OAuth client ID, defaults to env var DATACRUNCH_CLIENT_ID
            client_secret: OAuth client secret, defaults to env var DATACRUNCH_CLIENT_SECRET
            api_key: DataCrunch API key, defaults to env var DATACRUNCH_API_KEY
            api_url: DataCrunch API URL, defaults to env var DATACRUNCH_URL
        """
        # Get credentials from arguments or environment
        self.client_id = client_id or os.getenv("DATACRUNCH_CLIENT_ID")
        self.client_secret = client_secret or os.getenv("DATACRUNCH_CLIENT_SECRET")
        self.api_key = api_key or os.getenv("DATACRUNCH_API_KEY")
        
        # API URL with fallback
        self.api_url = api_url or os.getenv("DATACRUNCH_URL") or self.TTS_ENDPOINT_BASE
        
        # Ensure API URL has proper format
        if self.api_url and not self.api_url.startswith(("http://", "https://")):
            self.api_url = f"https://{self.api_url}"
            
        # OAuth token storage
        self.access_token = None
        self.token_expiry = 0
        
        # Check if we have valid credentials
        if not (self.client_id and self.client_secret) and not self.api_key:
            logger.warning("DataCrunch credentials not found. Either OAuth credentials "
                          "(DATACRUNCH_CLIENT_ID and DATACRUNCH_CLIENT_SECRET) or "
                          "direct API key (DATACRUNCH_API_KEY) is required.")
    
    def _get_oauth_token(self) -> str:
        """
        Get OAuth token using client credentials flow.
        
        Returns:
            str: The access token
            
        Raises:
            ValueError: If OAuth credentials are missing
            RequestException: If token request fails
        """
        # Check if we already have a valid token
        if self.access_token and time.time() < self.token_expiry - 60:
            return self.access_token
            
        # Verify credentials
        if not self.client_id or not self.client_secret:
            raise ValueError("OAuth client ID and secret are required")
            
        # Prepare request
        payload = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Make request
        try:
            logger.debug("Requesting OAuth token from DataCrunch")
            response = requests.post(
                self.TOKEN_ENDPOINT, 
                json=payload, 
                headers=headers,
                timeout=10
            )
            
            # Check response
            response.raise_for_status()
            data = response.json()
            
            # Extract token and expiry
            if "access_token" not in data:
                raise ValueError("DataCrunch OAuth response missing access_token")
                
            self.access_token = data["access_token"]
            expires_in = data.get("expires_in", 600)  # Default 10 minutes
            self.token_expiry = time.time() + expires_in
            
            logger.debug(f"OAuth token obtained, expires in {expires_in} seconds")
            return self.access_token
            
        except RequestException as e:
            logger.error(f"Failed to get DataCrunch OAuth token: {str(e)}")
            raise
    
    def _get_auth_headers(self) -> Dict[str, str]:
        """
        Get authentication headers for API requests.
        Tries OAuth first, then falls back to API key if OAuth fails.
        
        Returns:
            Dict[str, str]: Headers including authentication
        """
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Try OAuth authentication first
        try:
            token = self._get_oauth_token()
            headers["Authorization"] = f"Bearer {token}"
            return headers
        except (ValueError, RequestException) as e:
            logger.warning(f"OAuth authentication failed: {str(e)}")
            
            # Fall back to API key if available
            if self.api_key:
                logger.debug("Falling back to API key authentication")
                # Try multiple header formats since we don't know which one is correct
                headers["X-API-KEY"] = self.api_key
                headers["x-api-key"] = self.api_key
                headers["Authorization"] = f"Bearer {self.api_key}"
                return headers
            else:
                # Re-raise the original exception if we can't authenticate
                raise
    
    def generate_audio(self, 
                      text: str, 
                      voice: str = DEFAULT_VOICE,
                      model: str = DEFAULT_MODEL) -> Tuple[bytes, float]:
        """
        Generate audio from text using DataCrunch TTS API.
        
        Args:
            text: The text to convert to speech
            voice: The voice ID to use (default: speaker_0)
            model: The model ID to use (default: tts1)
            
        Returns:
            Tuple[bytes, float]: Audio data as bytes and duration in seconds
            
        Raises:
            ValueError: If there's an issue with the request or response
            RequestException: If the API request fails
        """
        if not text.strip():
            raise ValueError("Text cannot be empty")
            
        # Get authentication headers
        try:
            headers = self._get_auth_headers()
        except (ValueError, RequestException) as e:
            logger.error(f"Authentication failed: {str(e)}")
            raise ValueError(f"DataCrunch authentication failed: {str(e)}")
        
        # Prepare TTS request payload
        # Try both with and without model_id
        payloads = [
            {
                "text": text,
                "voice_id": voice
            },
            {
                "text": text,
                "voice_id": voice,
                "model_id": model
            }
        ]
        
        # Generate URL
        tts_url = f"{self.api_url}{self.TTS_ENDPOINT_PATH}"
        logger.debug(f"Using TTS URL: {tts_url}")
        
        # Try each payload
        last_error = None
        for payload in payloads:
            try:
                logger.debug(f"Requesting speech synthesis with payload: {json.dumps(payload)}")
                response = requests.post(
                    tts_url,
                    json=payload,
                    headers=headers,
                    timeout=30  # Speech generation can take time
                )
                
                # Check response
                if response.status_code == 200:
                    return self._process_success_response(response)
                elif response.status_code == 401:
                    logger.warning("DataCrunch API returned 401 Unauthorized")
                    response_data = response.json() if response.content else {"error": "Unauthorized"}
                    raise ValueError(f"DataCrunch API authorization error: {response_data}")
                elif response.status_code == 404:
                    logger.warning(f"DataCrunch API endpoint not found: {tts_url}")
                    continue  # Try next payload
                else:
                    logger.warning(f"DataCrunch API returned status {response.status_code}")
                    response_data = response.json() if response.content else {"error": f"HTTP {response.status_code}"}
                    last_error = ValueError(f"DataCrunch API error: {response_data}")
                    continue  # Try next payload
                    
            except RequestException as e:
                logger.error(f"DataCrunch API request failed: {str(e)}")
                last_error = e
                continue  # Try next payload
        
        # If we get here, all payloads failed
        if last_error:
            raise last_error
        else:
            raise ValueError("DataCrunch TTS API returned no valid response")
    
    def _process_success_response(self, response: requests.Response) -> Tuple[bytes, float]:
        """
        Process a successful API response to extract audio data.
        
        Args:
            response: The API response
            
        Returns:
            Tuple[bytes, float]: Audio data as bytes and duration in seconds
            
        Raises:
            ValueError: If the response doesn't contain valid audio data
        """
        try:
            data = response.json()
            
            # Extract audio data from various possible response formats
            audio_data = None
            if isinstance(data, dict):
                # Try different key patterns
                audio_data = (
                    data.get("audio_data") or
                    data.get("audio") or
                    (data.get("data", {}) or {}).get("audio_data") or
                    (data.get("result", {}) or {}).get("audio_data")
                )
            elif isinstance(data, str) and data.startswith("data:audio"):
                # Handle data URI format
                audio_data = data.split(",")[1]
            
            if not audio_data:
                raise ValueError(f"No audio data found in response: {json.dumps(data)}")
                
            # Decode base64 audio data
            audio_bytes = base64.b64decode(audio_data)
            
            # We don't have duration info, so estimate based on audio size
            # Assuming WAV format, ~32KB per second of audio as rough estimate
            estimated_duration = len(audio_bytes) / 32000
            
            return audio_bytes, estimated_duration
            
        except (ValueError, KeyError, json.JSONDecodeError) as e:
            logger.error(f"Failed to process DataCrunch response: {str(e)}")
            raise ValueError(f"Invalid response format from DataCrunch API: {str(e)}")
    
    def is_available(self) -> bool:
        """
        Check if the DataCrunch TTS service is available.
        
        Returns:
            bool: True if the service is available, False otherwise
        """
        # We need either OAuth credentials or API key
        if not ((self.client_id and self.client_secret) or self.api_key):
            return False
            
        # Try to get auth headers as a basic check
        try:
            self._get_auth_headers()
            return True
        except (ValueError, RequestException):
            return False