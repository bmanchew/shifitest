#!/usr/bin/env python3
"""
Test script for verifying the DataCrunch and HuggingFace API integration
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path

# Import our API client generator
from datacrunch_generator import load_api_client

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("test_datacrunch")

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Test DataCrunch and HuggingFace API integration')
    
    # Optional arguments
    parser.add_argument('--text', type=str, default="Hello, this is a test of the DataCrunch API integration.",
                        help='Text to convert to speech')
    parser.add_argument('--output', type=str, default="./test_output.wav",
                        help='Output audio file path')
    parser.add_argument('--speaker', type=int, default=0, 
                        help='Speaker ID (0 for female, 1 for male)')
    parser.add_argument('--model', type=str, default='facebook/mms-tts-eng', 
                        help='Hugging Face model ID to use')
    parser.add_argument('--datacrunch-url', type=str, 
                        help='DataCrunch API URL')
    parser.add_argument('--api-key', type=str, 
                        help='API key for DataCrunch')
    parser.add_argument('--huggingface-api-key', type=str, 
                        help='API key for Hugging Face')
    parser.add_argument('--prefer', type=str, default='datacrunch', 
                        choices=['datacrunch', 'huggingface'],
                        help='Which service to try first')
    
    return parser.parse_args()

def main():
    """Test the API client with DataCrunch and HuggingFace"""
    args = parse_args()
    
    print("DataCrunch and HuggingFace API Integration Test")
    print("===============================================")
    
    # Show config (masking API keys)
    print(f"Model ID: {args.model}")
    print(f"DataCrunch URL: {args.datacrunch_url or os.environ.get('DATACRUNCH_URL') or 'Not configured'}")
    print(f"DataCrunch API Key: {'*****' if args.api_key or os.environ.get('DATACRUNCH_API_KEY') else 'Not configured'}")
    print(f"HuggingFace API Key: {'*****' if args.huggingface_api_key or os.environ.get('HUGGINGFACE_API_KEY') else 'Not configured'}")
    print(f"Preferred Service: {args.prefer}")
    print(f"Test Text: '{args.text}'")
    print(f"Output Path: {args.output}")
    print("-----------------------------------------------")
    
    # Ensure output directory exists
    output_path = Path(args.output).resolve()
    output_dir = output_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        print("Initializing API client...")
        
        # Initialize the API client
        client = load_api_client(
            model_id=args.model,
            datacrunch_url=args.datacrunch_url,
            datacrunch_api_key=args.api_key,
            huggingface_api_key=args.huggingface_api_key,
            prefer_service=args.prefer
        )
        
        # Check availability
        print(f"DataCrunch Available: {client.datacrunch_available}")
        print(f"HuggingFace Available: {client.huggingface_available}")
        print(f"Client Initialized: {client.initialized}")
        
        if not client.initialized:
            print("ERROR: Failed to initialize API client. Check connection and API keys.")
            return 1
        
        print("Generating audio...")
        
        # Generate audio
        start_time = __import__('time').time()
        result = client.generate(
            text=args.text,
            speaker=args.speaker,
            output_path=str(output_path)
        )
        end_time = __import__('time').time()
        
        # Show results
        print("Generation successful!")
        print(f"Generation time: {end_time - start_time:.2f} seconds")
        print(f"Service used: {result['service']}")
        print(f"Model used: {result['model']}")
        print(f"Output WAV: {result['path']}")
        print(f"Output MP3: {result['mp3_path'] or 'Not created'}")
        
        # File size info
        wav_size = Path(result['path']).stat().st_size / 1024  # KB
        print(f"WAV file size: {wav_size:.2f} KB")
        
        if result['mp3_path']:
            mp3_size = Path(result['mp3_path']).stat().st_size / 1024  # KB
            print(f"MP3 file size: {mp3_size:.2f} KB")
        
        print("Test completed successfully!")
        return 0
        
    except Exception as e:
        logger.error(f"Test failed with error: {str(e)}", exc_info=True)
        print(f"ERROR: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())