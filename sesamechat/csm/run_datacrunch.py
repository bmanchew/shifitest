#!/usr/bin/env python3
"""
Command-line interface for using DataCrunch and HuggingFace API services
for high-quality speech synthesis without requiring local model loading.

This script is designed to be called from Node.js as part of the SesameAI service.
"""

import os
import sys
import json
import argparse
import tempfile
import time
import logging
from pathlib import Path
import soundfile as sf

# Import our API client generator
from datacrunch_generator import Segment, load_api_client

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("run_datacrunch")

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Generate speech from text using DataCrunch API or Hugging Face API')
    
    # Required arguments
    parser.add_argument('--text', type=str, required=True, help='Text to convert to speech')
    parser.add_argument('--output', type=str, required=True, help='Output audio file path')
    
    # Optional arguments
    parser.add_argument('--speaker', type=int, default=0, help='Speaker ID (0 for female, 1 for male)')
    parser.add_argument('--model', type=str, default='facebook/mms-tts-eng', help='Hugging Face model ID to use')
    parser.add_argument('--datacrunch-url', type=str, help='DataCrunch API URL')
    parser.add_argument('--api-key', type=str, help='API key for DataCrunch')
    parser.add_argument('--huggingface-api-key', type=str, help='API key for Hugging Face')
    parser.add_argument('--prefer', type=str, default='datacrunch', choices=['datacrunch', 'huggingface'],
                        help='Which service to try first')
    parser.add_argument('--temperature', type=float, default=0.9, 
                        help='Sampling temperature (DataCrunch only)')
    parser.add_argument('--top-k', type=int, default=50, 
                        help='Top-k sampling parameter (DataCrunch only)')
    parser.add_argument('--max-length', type=float, default=90000, 
                        help='Maximum audio length in milliseconds (DataCrunch only)')
    
    return parser.parse_args()

def main():
    """Main function to generate speech using the API client"""
    args = parse_args()
    
    # Ensure output directory exists
    output_path = Path(args.output).resolve()
    output_dir = output_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Initialize the API client
        client = load_api_client(
            model_id=args.model,
            datacrunch_url=args.datacrunch_url,
            datacrunch_api_key=args.api_key,
            huggingface_api_key=args.huggingface_api_key,
            prefer_service=args.prefer
        )
        
        if not client.initialized:
            result = {
                "success": False,
                "error": "Failed to initialize API client. Check connection and API keys."
            }
            print(json.dumps(result))
            return 1
        
        # Generate audio
        result = client.generate(
            text=args.text,
            speaker=args.speaker,
            context=None,  # No context for now
            max_audio_length_ms=args.max_length,
            temperature=args.temperature,
            top_k=args.top_k,
            output_path=str(output_path)
        )
        
        # Return result as JSON for the Node.js service to parse
        output_result = {
            "success": True,
            "path": result["path"].replace(os.getcwd(), "").replace("\\", "/"),
            "mp3Path": result["mp3_path"].replace(os.getcwd(), "").replace("\\", "/") if result["mp3_path"] else None,
            "service": result["service"],
            "model": result["model"]
        }
        
        # Print JSON result for Node.js to parse
        print(json.dumps(output_result))
        return 0
        
    except Exception as e:
        logger.error(f"Error generating speech: {str(e)}", exc_info=True)
        result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(result))
        return 1

if __name__ == "__main__":
    sys.exit(main())