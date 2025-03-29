#!/usr/bin/env python3
"""
Advanced generator module using gTTS (Google Text-to-Speech) for SesameAI integration
"""

import os
import torch
import torchaudio
import tempfile
import numpy as np
from gtts import gTTS
from pydub import AudioSegment
from typing import List, Optional, Union

class Segment:
    """
    A segment representing text or audio for the conversational speech model
    """
    def __init__(self, speaker: int, text: str, audio: Optional[torch.Tensor] = None):
        """
        Initialize a segment
        
        Args:
            speaker: Speaker ID (0 for female, 1 for male)
            text: Text content
            audio: Optional audio data
        """
        self.speaker = speaker
        self.text = text
        self.audio = audio

class GTTSGenerator:
    """
    A production-ready generator class using Google Text-to-Speech
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
        Generate audio from text using Google Text-to-Speech
        
        Args:
            text: The text to convert to speech
            speaker: Speaker ID (0 for female, 1 for male)
            context: Previous conversation context
            max_audio_length_ms: Maximum length of generated audio in milliseconds
            temperature: Sampling temperature (not used with gTTS)
            topk: Top-k sampling parameter (not used with gTTS)
            
        Returns:
            A tensor containing the generated audio
        """
        # Map speaker ID to language
        # 0 = female (default), 1 = male
        # We're using different language settings to approximate gender differences
        # Female: US English, Male: UK English
        lang = "en-us" if speaker == 0 else "en-uk"
        
        # Create a temporary file to store the MP3
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_mp3:
            temp_mp3_path = temp_mp3.name
            
        # Generate the speech with gTTS
        tts = gTTS(text=text, lang=lang.split('-')[0], tld=lang.split('-')[1] if '-' in lang else None, slow=False)
        tts.save(temp_mp3_path)
        
        # Convert MP3 to WAV with the target sample rate
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_wav:
            temp_wav_path = temp_wav.name
            
        # Use pydub to convert the MP3 to WAV with the target sample rate
        audio = AudioSegment.from_mp3(temp_mp3_path)
        audio = audio.set_frame_rate(self.sample_rate)
        audio.export(temp_wav_path, format="wav")
        
        # Load the WAV file as a tensor
        waveform, sample_rate = torchaudio.load(temp_wav_path)
        
        # Clean up temporary files
        os.unlink(temp_mp3_path)
        os.unlink(temp_wav_path)
        
        # Convert to mono and return
        if waveform.shape[0] > 1:
            # Average multiple channels
            waveform = waveform.mean(dim=0, keepdim=False)
        else:
            # Remove channel dimension
            waveform = waveform.squeeze(0)
            
        return waveform

def load_gtts_model(device: str = "cpu") -> GTTSGenerator:
    """
    Load the gTTS generator model
    
    Args:
        device: The device to load the model on ("cuda" or "cpu")
        
    Returns:
        A GTTSGenerator instance
    """
    return GTTSGenerator()