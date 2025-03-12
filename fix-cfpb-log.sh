#!/bin/bash

# Replace all instances of 'source: 'cfpb'' with 'source: 'internal'' in the cfpbService.ts file
sed -i "s/source: 'cfpb'/source: 'internal'/g" server/services/cfpbService.ts