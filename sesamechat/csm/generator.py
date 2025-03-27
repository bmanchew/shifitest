"""
Simplified generator module to mock the Sesame AI CSM behavior
"""
import torch
import torchaudio
from typing import List, Tuple, Optional

class Segment:
    """
    A segment representing text or audio for the conversational speech model
    """
    def __init__(self, speaker: int, text: str, audio: Optional[torch.Tensor] = None):
        self.speaker = speaker
        self.text = text
        self.audio = audio

class Generator:
    """
    A simplified Generator class to mock the SesameAI CSM behavior
    """
    def __init__(self):
        """Initialize the generator"""
        self.sample_rate = 24000  # Standard sample rate for the model
    
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
        # Log generation request
        print(f"Generating audio for speaker {speaker}")
        print(f"Text: '{text[:100]}{'...' if len(text) > 100 else ''}'")
        print(f"Context: {len(context) if context else 0} segments")
        
        # Calculate approximately how long the audio should be based on text length
        # Rough estimate: 80ms per character with some randomness
        chars = len(text)
        audio_length_samples = int(self.sample_rate * (chars * 0.08))
        
        # Cap at max_audio_length_ms
        max_samples = int(self.sample_rate * (max_audio_length_ms / 1000))
        audio_length_samples = min(audio_length_samples, max_samples)
        
        # Create a silent audio tensor
        audio = torch.zeros(audio_length_samples)
        
        # Add a small sine wave to make it not completely silent
        time = torch.arange(0, audio_length_samples) / self.sample_rate
        frequency = 440.0  # A4 note
        audio += 0.01 * torch.sin(2 * torch.pi * frequency * time)
        
        return audio

def load_csm_1b(device: str = "cuda") -> Generator:
    """
    Mock function to load the CSM 1B model
    
    Args:
        device: The device to load the model on ("cuda" or "cpu")
        
    Returns:
        A Generator instance
    """
    print(f"Loading mock CSM-1B model on {device}")
    return Generator()