#!/usr/bin/env python3
"""
Production-ready generator module that interfaces with Hugging Face models for high-quality speech synthesis
Specifically designed to work with the sesame/csm-1b model
"""

import os
import torch
import torchaudio
import numpy as np
from typing import List, Optional, Union

# Import Hugging Face transformers and pipeline
try:
    from transformers import pipeline, AutoProcessor, AutoModel
except ImportError:
    # Log the error but don't fail completely
    print("Warning: transformers package not found. Please install with 'pip install transformers'")
    # Define dummy classes to allow the script to run (they won't be used unless specifically requested)
    class DummyAutoProcessor:
        @classmethod
        def from_pretrained(cls, *args, **kwargs):
            raise ImportError("transformers package not installed")
    
    class DummyAutoModel:
        @classmethod
        def from_pretrained(cls, *args, **kwargs):
            raise ImportError("transformers package not installed")
    
    class DummyPipeline:
        def __init__(self, *args, **kwargs):
            raise ImportError("transformers package not installed")
    
    # Assign the dummy classes    
    AutoProcessor = DummyAutoProcessor
    AutoModel = DummyAutoModel
    pipeline = DummyPipeline

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

class HuggingFaceGenerator:
    """
    A production-ready generator class using Hugging Face models
    """
    def __init__(self, model_id="sesame/csm-1b", device=None):
        """
        Initialize the generator with a specific Hugging Face model
        
        Args:
            model_id: The Hugging Face model ID to use
            device: The device to run the model on ("cuda" or "cpu")
        """
        self.model_id = model_id
        # Auto-detect device if not specified
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        
        self.sample_rate = 24000
        
        # Load the model and processor
        try:
            self.processor = AutoProcessor.from_pretrained(model_id)
            self.model = AutoModel.from_pretrained(model_id).to(self.device)
            self.initialized = True
            print(f"Successfully loaded model {model_id} on {self.device}")
        except Exception as e:
            print(f"Failed to load model {model_id}: {str(e)}")
            self.initialized = False

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
        Generate audio from text using the Hugging Face model
        
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
            raise RuntimeError("Model not initialized properly")
        
        try:
            # Process the input
            inputs = self.processor(
                text=text,
                return_tensors="pt",
                truncation=True,
                max_length=512  # Limit input length to avoid OOM
            ).to(self.device)
            
            # Set speaker ID
            if hasattr(inputs, "speaker_id"):
                inputs["speaker_id"] = torch.tensor([speaker]).to(self.device)
            
            # Generate audio
            with torch.no_grad():
                output = self.model.generate(
                    **inputs,
                    max_length=max_audio_length_ms // 20,  # Convert ms to tokens (approximation)
                    do_sample=True,
                    temperature=temperature,
                    top_k=topk
                )
                
            # Process output to get waveform
            if hasattr(self.processor, "batch_decode"):
                # Some models return tokens that need decoding
                waveform = self.processor.batch_decode(output, output_type="waveform")
                if isinstance(waveform, list):
                    waveform = waveform[0]  # Take the first item if it's a batch
            else:
                # For direct waveform output models
                waveform = output.cpu()
                
            # Ensure it's the right format
            if isinstance(waveform, torch.Tensor):
                if len(waveform.shape) > 1 and waveform.shape[0] == 1:
                    # Remove batch dimension if present
                    waveform = waveform.squeeze(0)
                    
            return waveform
        except Exception as e:
            raise RuntimeError(f"Error generating audio: {str(e)}")

def load_huggingface_model(model_id="sesame/csm-1b", device=None) -> HuggingFaceGenerator:
    """
    Load the Hugging Face model
    
    Args:
        model_id: The Hugging Face model ID to use
        device: The device to load the model on ("cuda" or "cpu")
        
    Returns:
        A HuggingFaceGenerator instance
    """
    return HuggingFaceGenerator(model_id=model_id, device=device)