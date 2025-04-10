#!/usr/bin/env python3
"""
Production-ready generator module that interfaces with DataCrunch instances
to run Hugging Face models for high-quality speech synthesis
"""

import os
import json
import requests
import torch
import torchaudio
import numpy as np
from typing import List, Optional, Union

# Import Hugging Face related components if available
try:
    from transformers import pipeline, AutoProcessor, AutoModel
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("Warning: transformers package not found. Remote-only mode will be used.")

# Import the HuggingFaceGenerator for local fallback if needed
try:
    from huggingface_generator import Segment, HuggingFaceGenerator
    LOCAL_GENERATOR_AVAILABLE = True
except ImportError:
    LOCAL_GENERATOR_AVAILABLE = False
    print("Warning: huggingface_generator module not found. No local fallback available.")
    
    # Define a minimal Segment class if the import failed
    class Segment:
        def __init__(self, speaker: int, text: str, audio: Optional[torch.Tensor] = None):
            self.speaker = speaker
            self.text = text
            self.audio = audio

class DataCrunchGenerator:
    """
    A production-ready generator class using DataCrunch instances to run Hugging Face models
    """
    def __init__(
        self, 
        model_id="sesame/csm-1b", 
        datacrunch_url=None,
        api_key=None,
        use_local_fallback=True
    ):
        """
        Initialize the generator with DataCrunch connection parameters
        
        Args:
            model_id: The Hugging Face model ID to use
            datacrunch_url: The URL of the DataCrunch instance API endpoint
            api_key: API key for authentication with DataCrunch (if required)
            use_local_fallback: Whether to fall back to local execution if DataCrunch is unavailable
        """
        self.model_id = model_id
        self.datacrunch_url = datacrunch_url or os.environ.get("DATACRUNCH_URL")
        self.api_key = api_key or os.environ.get("DATACRUNCH_API_KEY")
        self.use_local_fallback = use_local_fallback
        self.local_generator = None
        self.remote_available = False
        self.local_available = False
        self.sample_rate = 24000
        
        # Validate configuration
        if not self.datacrunch_url:
            print("Warning: No DataCrunch URL provided. Set DATACRUNCH_URL environment variable or provide in constructor.")
        else:
            # Check connection to DataCrunch
            try:
                self._check_remote_connection()
                self.remote_available = True
                print(f"Successfully connected to DataCrunch instance at {self.datacrunch_url}")
            except Exception as e:
                print(f"Failed to connect to DataCrunch instance: {str(e)}")
                self.remote_available = False
                
        # Set up local fallback if enabled and remote is not available
        if use_local_fallback and LOCAL_GENERATOR_AVAILABLE and not self.remote_available:
            try:
                self.local_generator = HuggingFaceGenerator(model_id=model_id)
                self.local_available = self.local_generator.initialized
                if self.local_available:
                    print(f"Successfully initialized local fallback with model {model_id}")
                else:
                    print("Local fallback initialization failed")
            except Exception as e:
                print(f"Failed to initialize local fallback: {str(e)}")
                self.local_available = False
        
        # Set initialization status
        self.initialized = self.remote_available or self.local_available
    
    def _check_remote_connection(self):
        """
        Check if we can connect to the DataCrunch instance
        """
        if not self.datacrunch_url:
            return False
            
        # Create headers with API key if available
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            
        # Make a simple status check request
        response = requests.get(
            f"{self.datacrunch_url.rstrip('/')}/status", 
            headers=headers,
            timeout=5
        )
        
        if response.status_code != 200:
            raise ConnectionError(f"DataCrunch status check failed with code {response.status_code}: {response.text}")
            
        return True
    
    def generate(
        self,
        text: str,
        speaker: int,
        context: List[Segment] = None,
        max_audio_length_ms: float = 90_000,
        temperature: float = 0.9,
        topk: int = 50,
    ) -> torch.Tensor:
        """
        Generate audio from text using DataCrunch to run Hugging Face models
        
        Args:
            text: The text to convert to speech
            speaker: Speaker ID (0 for female, 1 for male)
            context: Previous conversation context
            max_audio_length_ms: Maximum length of generated audio in milliseconds
            temperature: Sampling temperature
            topk: Top-k sampling parameter
            
        Returns:
            A tensor containing the generated audio
        """
        if not self.initialized:
            raise RuntimeError("DataCrunch generator not initialized properly")
        
        # Try remote generation first if available
        if self.remote_available:
            try:
                return self._generate_remote(
                    text=text,
                    speaker=speaker,
                    context=context,
                    max_audio_length_ms=max_audio_length_ms,
                    temperature=temperature,
                    topk=topk
                )
            except Exception as e:
                print(f"Remote generation failed: {str(e)}")
                if not self.use_local_fallback or not self.local_available:
                    raise
                print("Falling back to local generation")
        
        # Fall back to local generation if remote failed or is unavailable
        if self.local_available:
            return self.local_generator.generate(
                text=text,
                speaker=speaker,
                context=context,
                max_audio_length_ms=max_audio_length_ms,
                temperature=temperature,
                topk=topk
            )
        
        raise RuntimeError("No available generation methods (remote or local)")
    
    def _generate_remote(
        self,
        text: str,
        speaker: int,
        context: List[Segment] = None,
        max_audio_length_ms: float = 90_000,
        temperature: float = 0.9,
        topk: int = 50,
    ) -> torch.Tensor:
        """
        Generate audio using the remote DataCrunch instance
        
        Args:
            The same parameters as the generate method
            
        Returns:
            A tensor containing the generated audio
        """
        # Prepare the request payload
        payload = {
            "text": text,
            "speaker": speaker,
            "model_id": self.model_id,
            "max_audio_length_ms": max_audio_length_ms,
            "temperature": temperature,
            "topk": topk
        }
        
        # Include context if provided
        if context:
            payload["context"] = [
                {
                    "speaker": segment.speaker,
                    "text": segment.text
                }
                for segment in context
            ]
        
        # Create headers with API key if available
        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        # Make the request to DataCrunch
        response = requests.post(
            f"{self.datacrunch_url.rstrip('/')}/generate", 
            json=payload,
            headers=headers,
            timeout=30  # Longer timeout as generation can take time
        )
        
        # Handle response
        if response.status_code != 200:
            raise RuntimeError(f"DataCrunch generation failed with code {response.status_code}: {response.text}")
        
        # Parse the response
        result = response.json()
        
        if not result.get("success", False):
            raise RuntimeError(f"DataCrunch generation failed: {result.get('error', 'Unknown error')}")
        
        # The audio data should be base64 encoded
        import base64
        from io import BytesIO
        
        # Get the audio data from the response
        audio_data = result.get("audio_data")
        if not audio_data:
            raise RuntimeError("No audio data in response")
        
        # Decode the base64 audio data
        audio_bytes = base64.b64decode(audio_data)
        
        # Load the audio data as a tensor using torchaudio
        with BytesIO(audio_bytes) as buffer:
            waveform, sample_rate = torchaudio.load(buffer)
        
        # Ensure it's a 1D tensor (remove any batch dimension)
        if len(waveform.shape) > 1 and waveform.shape[0] == 1:
            waveform = waveform.squeeze(0)
        
        return waveform

def load_datacrunch_model(
    model_id="sesame/csm-1b", 
    datacrunch_url=None,
    api_key=None,
    use_local_fallback=True
) -> DataCrunchGenerator:
    """
    Load a model using DataCrunch
    
    Args:
        model_id: The Hugging Face model ID to use
        datacrunch_url: The URL of the DataCrunch instance API endpoint
        api_key: API key for authentication with DataCrunch (if required)
        use_local_fallback: Whether to fall back to local execution if DataCrunch is unavailable
        
    Returns:
        A DataCrunchGenerator instance
    """
    return DataCrunchGenerator(
        model_id=model_id, 
        datacrunch_url=datacrunch_url,
        api_key=api_key,
        use_local_fallback=use_local_fallback
    )