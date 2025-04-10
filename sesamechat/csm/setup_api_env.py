#!/usr/bin/env python3
"""
Setup script for DataCrunch and HuggingFace API environment variables
"""

import os
import sys
import argparse
import json

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Setup API environment variables for DataCrunch and HuggingFace')
    
    parser.add_argument('--datacrunch-url', type=str, help='DataCrunch API URL')
    parser.add_argument('--datacrunch-api-key', type=str, help='API key for DataCrunch')
    parser.add_argument('--huggingface-api-key', type=str, help='API key for Hugging Face')
    parser.add_argument('--env-file', type=str, default='.env', help='Path to .env file to update')
    parser.add_argument('--check-only', action='store_true', help='Only check the environment variables, do not update')
    
    return parser.parse_args()

def update_env_file(env_file, datacrunch_url=None, datacrunch_api_key=None, huggingface_api_key=None):
    """Update .env file with API keys"""
    env_vars = {}
    
    # Read existing .env file if it exists
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    
    # Update environment variables
    if datacrunch_url:
        env_vars['DATACRUNCH_URL'] = datacrunch_url
    if datacrunch_api_key:
        env_vars['DATACRUNCH_API_KEY'] = datacrunch_api_key
    if huggingface_api_key:
        env_vars['HUGGINGFACE_API_KEY'] = huggingface_api_key
    
    # Write back to .env file
    with open(env_file, 'w') as f:
        for key, value in sorted(env_vars.items()):
            f.write(f"{key}={value}\n")
    
    return env_vars

def check_env_vars():
    """Check if environment variables are set"""
    datacrunch_url = os.environ.get('DATACRUNCH_URL')
    datacrunch_api_key = os.environ.get('DATACRUNCH_API_KEY')
    huggingface_api_key = os.environ.get('HUGGINGFACE_API_KEY')
    
    return {
        'DATACRUNCH_URL': datacrunch_url,
        'DATACRUNCH_API_KEY': datacrunch_api_key != None,
        'HUGGINGFACE_API_KEY': huggingface_api_key != None
    }

def main():
    """Main function"""
    args = parse_args()
    
    if args.check_only:
        # Check and report current environment variables
        env_vars = check_env_vars()
        result = {
            'status': 'ok',
            'message': 'Current environment variable status',
            'datacrunch_url': env_vars['DATACRUNCH_URL'],
            'datacrunch_api_key_set': env_vars['DATACRUNCH_API_KEY'],
            'huggingface_api_key_set': env_vars['HUGGINGFACE_API_KEY']
        }
        print(json.dumps(result))
        return 0
    
    try:
        # Update .env file
        updated_vars = update_env_file(
            args.env_file,
            datacrunch_url=args.datacrunch_url,
            datacrunch_api_key=args.datacrunch_api_key,
            huggingface_api_key=args.huggingface_api_key
        )
        
        # Report result
        result = {
            'status': 'ok',
            'message': 'Environment variables updated successfully',
            'updated': {
                'DATACRUNCH_URL': 'DATACRUNCH_URL' in updated_vars,
                'DATACRUNCH_API_KEY': 'DATACRUNCH_API_KEY' in updated_vars,
                'HUGGINGFACE_API_KEY': 'HUGGINGFACE_API_KEY' in updated_vars
            },
            'env_file': args.env_file
        }
        print(json.dumps(result))
        return 0
        
    except Exception as e:
        result = {
            'status': 'error',
            'message': str(e)
        }
        print(json.dumps(result))
        return 1

if __name__ == "__main__":
    sys.exit(main())