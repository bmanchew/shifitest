#!/usr/bin/env python3
"""
Script to convert text to speech using SesameAI's Conversational Speech Model (CSM)
This script is called from the SesameAI service in the Node.js backend.
"""

import os
import sys
import json
import argparse
import torch
import torchaudio
import numpy as np
import uuid
from pathlib import Path
from typing import List, Optional, Union

# Import the generator from the current directory
from generator import Segment, load_csm_1b

# Constants
SAMPLE_RATE = 24000  # The expected sample rate for CSM
AUDIO_DIR = os.path.join(os.getcwd(), "public", "audio")

def simulate_audio_generation(text, speaker_id=0, output_path=None):
    """
    Simulate audio generation for testing without requiring the full model
    
    Args:
        text: Text to convert to speech
        speaker_id: Speaker ID (0 for female, 1 for male)
        output_path: Path to save the audio file
    
    Returns:
        Path to the generated audio file
    """
    try:
        # Make sure the output directory exists
        os.makedirs(AUDIO_DIR, exist_ok=True)
        
        # Create a model instance
        model = load_csm_1b(device="cpu")
        
        # Generate the audio
        audio = model.generate(
            text=text,
            speaker=speaker_id,
            context=None,  # No context for initial generation
            max_audio_length_ms=90_000,  # Max 90 seconds
            temperature=0.9,
            topk=50
        )
        
        # Determine the output filename
        if output_path is None:
            filename = f"sesameai_{uuid.uuid4().hex[:8]}_{speaker_id}.wav"
            output_path = os.path.join(AUDIO_DIR, filename)
        else:
            # Ensure the path is within the audio directory for security
            base_filename = os.path.basename(output_path)
            output_path = os.path.join(AUDIO_DIR, base_filename)
        
        # Save the audio
        torchaudio.save(
            output_path,
            audio.unsqueeze(0),  # Add channel dimension
            SAMPLE_RATE
        )
        
        # Return the relative path for web serving
        # Strip the 'public' directory from the path, keeping the leading slash
        rel_path = output_path.replace(os.path.join(os.getcwd(), "public"), "")
        
        # Ensure the path starts with a slash for correct web URLs
        if not rel_path.startswith('/'):
            rel_path = '/' + rel_path
            
        return {
            "success": True,
            "path": rel_path
        }
    except Exception as e:
        print(f"Error generating audio: {str(e)}", file=sys.stderr)
        return {
            "success": False,
            "error": str(e)
        }

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Convert text to speech using SesameAI CSM')
    parser.add_argument('--text', required=True, help='Text to convert to speech')
    parser.add_argument('--speaker', type=int, default=0, help='Speaker ID (0=female, 1=male)')
    parser.add_argument('--output', help='Path to save the output audio file')
    return parser.parse_args()

def main():
    """
    Main function to handle CLI invocation
    """
    args = parse_args()
    
    result = simulate_audio_generation(
        text=args.text,
        speaker_id=args.speaker,
        output_path=args.output
    )
    
    # Print JSON result to stdout for the Node.js process to capture
    print(json.dumps(result))

if __name__ == "__main__":
    main()