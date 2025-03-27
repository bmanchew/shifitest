#!/bin/bash

# Script to set up Sesame AI CSM dependencies
echo "Starting Sesame AI CSM setup..."

# Make sure we have Python 3.10
if ! command -v python3.10 &> /dev/null; then
    echo "Python 3.10 is required but not found."
    echo "Please install Python 3.10 first."
    exit 1
fi

# Create a virtual environment for CSM
echo "Creating Python virtual environment..."
cd sesamechat/csm
python3.10 -m venv .venv
source .venv/bin/activate

# Disable Triton compilation
export NO_TORCH_COMPILE=1

# Install dependencies
echo "Installing CSM dependencies..."
pip install -r requirements.txt

# Login to Hugging Face (if credentials provided)
if [ -n "$HUGGINGFACE_TOKEN" ]; then
    echo "Logging in to Hugging Face..."
    huggingface-cli login --token $HUGGINGFACE_TOKEN
else
    echo "Warning: HUGGINGFACE_TOKEN not set. You will need to log in to access model files."
    echo "Run: huggingface-cli login"
fi

echo "Setup complete!"
echo "To use Sesame AI CSM, make sure to set the following environment variables:"
echo "- SESAME_USE_REAL_MODEL=true (for production)"
echo "- HUGGINGFACE_TOKEN=your_token (for accessing model files)"

# Deactivate the virtual environment
deactivate

echo "You may need to install ffmpeg for audio operations:"
echo "apt-get update && apt-get install -y ffmpeg"