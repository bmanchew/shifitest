#!/usr/bin/env python3
"""
Script to convert text to speech using DataCrunch instances for Hugging Face CSM-1B model
This script provides advanced speech synthesis for production use with remote computation
"""

import os
import sys
import json
import argparse
import uuid
import traceback
import subprocess
from pathlib import Path

# Import required packages
try:
    import torch
    import torchaudio
    import numpy as np
    import soundfile as sf
    from scipy import signal
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"Missing Python package: {str(e)}"
    }))
    sys.exit(1)

# Import the DataCrunch generator
try:
    from datacrunch_generator import Segment, load_datacrunch_model
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"Could not import datacrunch_generator module: {str(e)}"
    }))
    sys.exit(1)

# Check for CUDA availability for local fallback
CUDA_AVAILABLE = torch.cuda.is_available()
if CUDA_AVAILABLE:
    print(f"CUDA is available for local fallback: {torch.cuda.get_device_name(0)}", file=sys.stderr)
else:
    print("CUDA is not available, using CPU mode for local fallback", file=sys.stderr)

# Check for ffmpeg (needed for format conversion)
try:
    subprocess.run(['ffmpeg', '-version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    FFMPEG_AVAILABLE = True
except (subprocess.SubprocessError, FileNotFoundError):
    FFMPEG_AVAILABLE = False
    print("Warning: ffmpeg not found, MP3 conversion will not be available", file=sys.stderr)

# Constants
SAMPLE_RATE = 24000  # The expected sample rate for CSM
PROJECT_DIR = os.getcwd()
AUDIO_DIR = os.path.join(PROJECT_DIR, "public", "audio")
INSIGHTS_DIR = os.path.join(AUDIO_DIR, "insights")
CONVERSATIONS_DIR = os.path.join(AUDIO_DIR, "conversations")

# Ensure audio directories exist
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(INSIGHTS_DIR, exist_ok=True)
os.makedirs(CONVERSATIONS_DIR, exist_ok=True)

def generate_audio(text, speaker_id=0, output_path=None, model_id="sesame/csm-1b", datacrunch_url=None, api_key=None):
    """
    Generate audio from text using the DataCrunch instance for Hugging Face models
    
    Args:
        text: Text to convert to speech
        speaker_id: Speaker ID (0 for female, 1 for male)
        output_path: Path to save the audio file
        model_id: Hugging Face model ID to use
        datacrunch_url: URL of the DataCrunch instance API endpoint
        api_key: API key for DataCrunch authentication
    
    Returns:
        Dictionary with success status and path or error
    """
    try:
        # Get DataCrunch URL and API key from environment if not provided
        if not datacrunch_url:
            datacrunch_url = os.environ.get("DATACRUNCH_URL")
        if not api_key:
            api_key = os.environ.get("DATACRUNCH_API_KEY")
        
        # Create a model instance
        model = load_datacrunch_model(
            model_id=model_id, 
            datacrunch_url=datacrunch_url,
            api_key=api_key,
            use_local_fallback=True  # Enable local fallback if DataCrunch is unavailable
        )
        
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
            filename = f"dc_{uuid.uuid4().hex[:8]}_{speaker_id}.wav"
            output_path = os.path.join(AUDIO_DIR, filename)
        else:
            # Make sure it's an absolute path
            if not os.path.isabs(output_path):
                output_path = os.path.join(PROJECT_DIR, output_path)
            
            # Ensure the output directory exists
            output_dir = os.path.dirname(output_path)
            os.makedirs(output_dir, exist_ok=True)
        
        # Save the audio
        try:
            # First attempt with torchaudio
            torchaudio.save(
                output_path,
                audio.unsqueeze(0),  # Add channel dimension
                SAMPLE_RATE
            )
        except Exception as audio_error:
            # Fallback to soundfile if torchaudio fails
            try:
                # Convert tensor to numpy
                audio_np = audio.detach().cpu().numpy()
                sf.write(output_path, audio_np, SAMPLE_RATE)
            except Exception as sf_error:
                raise Exception(f"Failed to save audio file with both methods: {str(audio_error)} and {str(sf_error)}")
        
        # Verify the file was created
        if not os.path.exists(output_path):
            raise Exception(f"Audio file was not created at {output_path}")
        
        # Also create an MP3 version for better browser compatibility
        mp3_path = output_path.replace('.wav', '.mp3')
        if FFMPEG_AVAILABLE:
            try:
                # Use FFmpeg to convert WAV to MP3
                subprocess.run([
                    'ffmpeg', 
                    '-y',  # Overwrite output files without asking
                    '-i', output_path,  # Input file
                    '-acodec', 'libmp3lame',  # MP3 codec
                    '-ab', '192k',  # Bitrate
                    '-ac', '1',  # Mono output
                    mp3_path  # Output file
                ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                
                print(f"Successfully created MP3 version at {mp3_path}", file=sys.stderr)
            except subprocess.SubprocessError as e:
                print(f"Warning: Failed to convert to MP3: {str(e)}", file=sys.stderr)
                mp3_path = None
        else:
            mp3_path = None
            print("Warning: FFmpeg not available, skipping MP3 conversion", file=sys.stderr)
        
        # Return the relative path for web serving
        # Strip the 'public' directory from the path for client-side URLs
        rel_path = output_path.replace(os.path.join(PROJECT_DIR, "public"), "")
        
        # Ensure the path starts with a slash for correct web URLs
        if not rel_path.startswith('/'):
            rel_path = '/' + rel_path
            
        # Do the same for MP3 path if available
        if mp3_path:
            mp3_rel_path = mp3_path.replace(os.path.join(PROJECT_DIR, "public"), "")
            if not mp3_rel_path.startswith('/'):
                mp3_rel_path = '/' + mp3_rel_path
        else:
            mp3_rel_path = None
            
        return {
            "success": True,
            "path": rel_path,
            "mp3Path": mp3_rel_path,
            "fullPath": output_path
        }
    except Exception as e:
        # Print the error and traceback to stderr for debugging
        traceback_str = traceback.format_exc()
        print(f"Error generating audio: {str(e)}\n{traceback_str}", file=sys.stderr)
        
        return {
            "success": False,
            "error": str(e)
        }

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Convert text to speech using DataCrunch for Hugging Face models')
    parser.add_argument('--text', required=True, help='Text to convert to speech')
    parser.add_argument('--speaker', type=int, default=0, help='Speaker ID (0=female, 1=male)')
    parser.add_argument('--output', help='Path to save the output audio file')
    parser.add_argument('--model', default='sesame/csm-1b', help='Hugging Face model ID to use')
    parser.add_argument('--datacrunch-url', help='URL of the DataCrunch instance API endpoint')
    parser.add_argument('--api-key', help='API key for DataCrunch authentication')
    return parser.parse_args()

def main():
    """
    Main function to handle CLI invocation
    """
    try:
        args = parse_args()
        
        # Generate the audio
        result = generate_audio(
            text=args.text,
            speaker_id=args.speaker,
            output_path=args.output,
            model_id=args.model,
            datacrunch_url=args.datacrunch_url,
            api_key=args.api_key
        )
        
        # Print JSON result to stdout for the Node.js process to capture
        print(json.dumps(result))
    except Exception as e:
        # Handle any unexpected errors
        print(json.dumps({
            "success": False,
            "error": f"Script execution error: {str(e)}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()