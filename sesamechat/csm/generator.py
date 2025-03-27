#!/usr/bin/env python3
"""
Simplified generator module to mock the Sesame AI CSM behavior
"""

import os
import torch
import torchaudio
import numpy as np
from typing import List, Optional, Union

class Segment:
    """
    A segment representing text or audio for the conversational speech model
    """
    def __init__(self, speaker: int, text: str, audio: Optional[torch.Tensor] = None):
        """
        Initialize a segment
        
        Args:
            speaker: Speaker ID (0 or 1)
            text: Text content
            audio: Optional audio data
        """
        self.speaker = speaker
        self.text = text
        self.audio = audio

class Generator:
    """
    A simplified Generator class to mock the SesameAI CSM behavior
    """
    def __init__(self):
        """Initialize the generator"""
        self.sample_rate = 24000

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
        Generate simulated audio from text
        
        Args:
            text: The text to convert to speech
            speaker: Speaker ID (0 or 1)
            context: Previous conversation context
            max_audio_length_ms: Maximum length of generated audio in milliseconds
            temperature: Sampling temperature
            topk: Top-k sampling parameter
            
        Returns:
            A tensor containing the generated audio
        """
        # For testing purposes, just generate a simple sine wave
        # Different frequencies for different speakers
        freq = 440 if speaker == 0 else 220  # Hz (A4 for female, A3 for male)
        
        # Calculate duration based on text length (avg reading speed)
        # Approximately 150 words per minute, or 2.5 words per second
        # Average English word is 5 characters
        words = len(text) / 5
        duration_s = words / 2.5
        
        # Ensure minimum and maximum duration
        duration_s = max(1.0, min(duration_s, max_audio_length_ms / 1000))
        
        # Generate a simple sine wave
        t = torch.linspace(0, duration_s, int(self.sample_rate * duration_s))
        audio = torch.sin(2 * np.pi * freq * t)
        
        # Add some noise to make it sound more natural
        noise = torch.randn_like(audio) * 0.01
        audio = audio + noise
        
        # Normalize audio to be between -1 and 1
        audio = audio / torch.max(torch.abs(audio))
        
        return audio

def load_csm_1b(device: str = "cuda") -> Generator:
    """
    Mock function to load the CSM 1B model
    
    Args:
        device: The device to load the model on ("cuda" or "cpu")
        
    Returns:
        A Generator instance
    """
    return Generator()