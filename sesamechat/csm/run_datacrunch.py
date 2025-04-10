#!/usr/bin/env python3.11
"""
DataCrunch TTS Engine for SesameAI

This script is the integration point between the SesameAI TypeScript service
and the DataCrunch TTS API. It converts text to speech using DataCrunch's API
and falls back to other engines if necessary.

Usage:
    python run_datacrunch.py --text "Text to convert to speech" --output /path/to/output.wav [--speaker 0] [--model model_name]

Returns:
    JSON object with success status and path to generated audio file
"""

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
import wave
import pydub
from typing import Dict, Any, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add parent directory to Python path for imports
script_dir = Path(__file__).parent
parent_dir = script_dir.parent.parent
sys.path.insert(0, str(parent_dir))

# Import the DataCrunch generator
from sesamechat.csm.datacrunch_generator import DataCrunchGenerator

# Import fallback engines
try:
    from sesamechat.csm.gtts_generator import GttsGenerator
    has_gtts = True
except ImportError:
    has_gtts = False
    logger.warning("Google TTS generator not available for fallback")

try:
    from sesamechat.csm.huggingface_generator import HuggingFaceGenerator
    has_huggingface = True
except ImportError:
    has_huggingface = False
    logger.warning("HuggingFace generator not available for fallback")


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Generate speech with DataCrunch TTS')
    parser.add_argument('--text', required=True, help='Text to convert to speech')
    parser.add_argument('--output', required=True, help='Output file path (WAV format)')
    parser.add_argument('--speaker', type=int, default=0, help='Speaker ID (0=female, 1=male)')
    parser.add_argument('--model', default=None, help='Model ID to use')
    parser.add_argument('--datacrunch-url', default=None, help='DataCrunch API URL')
    parser.add_argument('--api-key', default=None, help='DataCrunch API key')
    
    return parser.parse_args()


def convert_wav_to_mp3(wav_path: str) -> Optional[str]:
    """
    Convert WAV file to MP3 for better browser compatibility.
    
    Args:
        wav_path: Path to WAV file
        
    Returns:
        Path to MP3 file if successful, None otherwise
    """
    try:
        mp3_path = wav_path.replace('.wav', '.mp3')
        
        # Convert using pydub
        sound = pydub.AudioSegment.from_wav(wav_path)
        sound.export(mp3_path, format="mp3", bitrate="192k")
        
        logger.info(f"Converted WAV to MP3: {mp3_path}")
        return mp3_path
    except Exception as e:
        logger.error(f"Failed to convert WAV to MP3: {str(e)}")
        return None


def get_wav_duration(wav_path: str) -> float:
    """
    Get the duration of a WAV file in seconds.
    
    Args:
        wav_path: Path to WAV file
        
    Returns:
        Duration in seconds
    """
    try:
        with wave.open(wav_path, 'r') as wav_file:
            # Get the number of frames and framerate
            frames = wav_file.getnframes()
            rate = wav_file.getframerate()
            duration = frames / float(rate)
            return duration
    except Exception as e:
        logger.error(f"Failed to get WAV duration: {str(e)}")
        return 0.0


def normalize_output_paths(wav_path: str, mp3_path: Optional[str] = None) -> Tuple[str, Optional[str]]:
    """
    Normalize output paths to web-accessible paths.
    
    Args:
        wav_path: Path to WAV file
        mp3_path: Path to MP3 file (optional)
        
    Returns:
        Tuple of normalized paths
    """
    # Extract filenames and create web-accessible paths
    wav_filename = os.path.basename(wav_path)
    web_wav_path = f"/audio/{wav_filename}"
    
    web_mp3_path = None
    if mp3_path:
        mp3_filename = os.path.basename(mp3_path)
        web_mp3_path = f"/audio/{mp3_filename}"
        
    return web_wav_path, web_mp3_path


def generate_speech_with_datacrunch(
    text: str, 
    output_path: str,
    speaker_id: int = 0,
    model_id: Optional[str] = None,
    api_url: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate speech using DataCrunch TTS API.
    Falls back to other engines if DataCrunch is unavailable.
    
    Args:
        text: Text to convert to speech
        output_path: Path to save the output WAV file
        speaker_id: Speaker ID (0=female, 1=male)
        model_id: Model ID to use
        api_url: DataCrunch API URL
        api_key: DataCrunch API key
        
    Returns:
        Dict with generation results
    """
    start_time = time.time()
    logger.info(f"Generating speech for text: '{text[:50]}...' (length: {len(text)})")
    
    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)
    
    # Map the speaker ID to a voice ID
    # 0 = female, 1 = male
    # Currently DataCrunch only has speaker_0, so we'll use it for both
    voice_id = "speaker_0"
    
    # Try DataCrunch first
    try:
        # Create generator with provided credentials if available
        generator = DataCrunchGenerator(
            api_url=api_url,
            api_key=api_key
        )
        
        # Check if DataCrunch is available
        if generator.is_available():
            logger.info("Using DataCrunch for speech generation")
            
            # Generate audio
            audio_data, duration = generator.generate_audio(
                text=text,
                voice=voice_id,
                model=model_id or "tts1"
            )
            
            # Save audio to file
            with open(output_path, "wb") as f:
                f.write(audio_data)
                
            logger.info(f"DataCrunch audio generated successfully! Duration: {duration:.2f} seconds")
            
            # Convert to MP3 for better browser compatibility
            mp3_path = convert_wav_to_mp3(output_path)
            
            # Normalize paths for web access
            web_wav_path, web_mp3_path = normalize_output_paths(output_path, mp3_path)
            
            # Return success
            elapsed_time = time.time() - start_time
            return {
                "success": True,
                "engine": "datacrunch",
                "path": web_wav_path,
                "mp3Path": web_mp3_path,
                "duration": duration,
                "elapsed": elapsed_time
            }
    except Exception as e:
        logger.error(f"Failed to generate audio with DataCrunch: {str(e)}")
        logger.info("Falling back to alternative engines")
    
    # Try Hugging Face as first fallback
    if has_huggingface:
        try:
            logger.info("Falling back to Hugging Face for speech generation")
            from sesamechat.csm.huggingface_generator import HuggingFaceGenerator
            
            # Create HuggingFace generator
            hf_generator = HuggingFaceGenerator()
            
            # Generate audio
            audio_data, duration = hf_generator.generate_audio(
                text=text,
                voice=voice_id if speaker_id == 0 else "speaker_1",
                model=model_id
            )
            
            # Save audio to file
            with open(output_path, "wb") as f:
                f.write(audio_data)
                
            logger.info(f"Hugging Face audio generated successfully! Duration: {duration:.2f} seconds")
            
            # Convert to MP3 for better browser compatibility
            mp3_path = convert_wav_to_mp3(output_path)
            
            # Normalize paths for web access
            web_wav_path, web_mp3_path = normalize_output_paths(output_path, mp3_path)
            
            # Return success
            elapsed_time = time.time() - start_time
            return {
                "success": True,
                "engine": "huggingface",
                "path": web_wav_path,
                "mp3Path": web_mp3_path,
                "duration": duration,
                "elapsed": elapsed_time
            }
        except Exception as e:
            logger.error(f"Failed to generate audio with Hugging Face: {str(e)}")
            logger.info("Falling back to Google TTS")
    
    # Try Google TTS as final fallback
    if has_gtts:
        try:
            logger.info("Falling back to Google TTS for speech generation")
            from sesamechat.csm.gtts_generator import GttsGenerator
            
            # Create Google TTS generator
            gtts_generator = GttsGenerator()
            
            # Generate audio
            gtts_generator.generate_speech(
                text=text,
                output_path=output_path,
                slow=False
            )
            
            # Get the duration of the generated audio
            duration = get_wav_duration(output_path)
            logger.info(f"Google TTS audio generated successfully! Duration: {duration:.2f} seconds")
            
            # Convert to MP3 for better browser compatibility
            mp3_path = convert_wav_to_mp3(output_path)
            
            # Normalize paths for web access
            web_wav_path, web_mp3_path = normalize_output_paths(output_path, mp3_path)
            
            # Return success
            elapsed_time = time.time() - start_time
            return {
                "success": True,
                "engine": "gtts",
                "path": web_wav_path,
                "mp3Path": web_mp3_path,
                "duration": duration,
                "elapsed": elapsed_time
            }
        except Exception as e:
            logger.error(f"Failed to generate audio with Google TTS: {str(e)}")
    
    # If all engines failed, return error
    return {
        "success": False,
        "error": "All speech engines failed. Check logs for details."
    }


def main():
    """Main function."""
    args = parse_args()
    
    try:
        # Generate speech with DataCrunch (with fallbacks)
        result = generate_speech_with_datacrunch(
            text=args.text,
            output_path=args.output,
            speaker_id=args.speaker,
            model_id=args.model,
            api_url=args.datacrunch_url,
            api_key=args.api_key
        )
        
        # Print result as JSON for the TypeScript service to parse
        print(json.dumps(result))
        
        # Exit with appropriate code
        sys.exit(0 if result["success"] else 1)
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()