"""
Simple script to test SesameAI conversational speech model (CSM)
"""
import os
import sys
import torch
import torchaudio
from generator import load_csm_1b, Segment

def simulate_audio_generation(text, speaker_id=0, output_path=None):
    """
    Simulate audio generation for testing without requiring the full model
    
    Args:
        text: Text to convert to speech
        speaker_id: Speaker ID (0-1)
        output_path: Path to save the audio file
    
    Returns:
        Path to the generated audio file
    """
    # Define default output path if not provided
    if output_path is None:
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'public', 'audio')
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f'test_audio_{speaker_id}_{hash(text) % 10000}.wav')
        
    print(f"Generating test audio for: '{text[:50]}...'")
    print(f"Speaker ID: {speaker_id}")
    print(f"Output path: {output_path}")
    
    # Select device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")
    
    # Load the model
    model = load_csm_1b(device)
    
    # Generate audio
    audio = model.generate(
        text=text,
        speaker=speaker_id,
        context=None,
        max_audio_length_ms=60_000,  # 60 seconds max
    )
    
    # Save the audio file
    torchaudio.save(
        output_path,
        audio.unsqueeze(0).cpu(),
        model.sample_rate
    )
    
    print(f"Audio saved to: {output_path}")
    return output_path

def main():
    """
    Main function to test audio generation
    """
    # Get the text argument from command line, or use default
    if len(sys.argv) > 1:
        text = sys.argv[1]
    else:
        text = "Hello, I'm the ShiFi financial assistant. How can I help you with your merchant financing today?"
    
    # Get speaker ID from command line, or use default
    speaker_id = 0
    if len(sys.argv) > 2:
        try:
            speaker_id = int(sys.argv[2])
        except ValueError:
            print(f"Invalid speaker ID: {sys.argv[2]}. Using default (0).")
    
    # Generate audio
    output_path = simulate_audio_generation(text, speaker_id)
    print(f"Test complete. Audio file saved to: {output_path}")

if __name__ == "__main__":
    main()