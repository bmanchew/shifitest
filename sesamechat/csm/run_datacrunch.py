"""
DataCrunch TTS Test Script

This script tests the DataCrunch generator implementation
by attempting to generate speech and saving it to a file.
"""

import os
import sys
import logging
from pathlib import Path

# Add the parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sesamechat.csm.datacrunch_generator import DataCrunchGenerator

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_datacrunch_tts():
    """
    Test the DataCrunch TTS generator by generating a sample audio file.
    """
    # Create output directory if it doesn't exist
    output_dir = Path(__file__).parent.parent.parent / "audio_test_outputs"
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / "datacrunch_test.wav"
    
    # Create DataCrunch generator with explicit API URL
    # Override the environment URL which may be pointing to an IP
    generator = DataCrunchGenerator(api_url="https://api.datacrunch.io")
    
    # Check if generator is available
    if not generator.is_available():
        logger.error("DataCrunch TTS is not available. Check your credentials.")
        return False
    
    # Test text
    test_text = (
        "Hello! This is a test of the DataCrunch text-to-speech system. "
        "If you can hear this message, the integration is working correctly."
    )
    
    # Try generating audio
    try:
        logger.info("Attempting to generate audio with DataCrunch TTS...")
        audio_data, duration = generator.generate_audio(test_text)
        
        # Save audio file
        with open(output_file, "wb") as f:
            f.write(audio_data)
            
        logger.info(f"Audio generated successfully! Duration: {duration:.2f} seconds")
        logger.info(f"Audio saved to: {output_file}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to generate audio: {str(e)}")
        
        # Check if we got a specific error message about OAuth
        if "OAuth" in str(e) and "unauthorized" in str(e).lower():
            logger.warning(
                "OAuth authentication succeeded but TTS endpoint returned unauthorized. "
                "This likely means your DataCrunch account doesn't have TTS permissions."
            )
        return False

def main():
    """Main function."""
    logger.info("Testing DataCrunch TTS integration")
    
    # Show environment status
    client_id = os.getenv("DATACRUNCH_CLIENT_ID")
    client_secret = os.getenv("DATACRUNCH_CLIENT_SECRET")
    api_key = os.getenv("DATACRUNCH_API_KEY")
    api_url = os.getenv("DATACRUNCH_URL")
    
    logger.info(f"DATACRUNCH_URL: {api_url or 'Not set'}")
    logger.info(f"DATACRUNCH_CLIENT_ID: {'Set' if client_id else 'Not set'}")
    logger.info(f"DATACRUNCH_CLIENT_SECRET: {'Set' if client_secret else 'Not set'}")
    logger.info(f"DATACRUNCH_API_KEY: {'Set' if api_key else 'Not set'}")
    
    # Run test
    success = test_datacrunch_tts()
    
    # Print result
    if success:
        logger.info("DataCrunch TTS test completed successfully!")
    else:
        logger.error(
            "DataCrunch TTS test failed. The fallback TTS engines will be used instead. "
            "To enable DataCrunch TTS, please ensure you have valid API credentials "
            "and the necessary permissions."
        )

if __name__ == "__main__":
    main()