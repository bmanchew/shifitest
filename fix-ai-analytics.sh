#!/bin/bash

# Replace all instances of 'ai_analytics' with 'internal' in the aiAnalytics.ts file
sed -i "s/'ai_analytics'/'internal'/g" server/services/aiAnalytics.ts