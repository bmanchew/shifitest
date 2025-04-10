/**
 * This script helps fix the MerchantDetail component in the app
 * It identifies the issues with nesting and syntax
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const componentPath = path.join('client', 'src', 'components', 'admin', 'MerchantDetail.tsx');

// Read the component file
const componentContent = fs.readFileSync(componentPath, 'utf-8');

// Check for typical React nesting errors
function analyzeComponent(content) {
  const lines = content.split('\n');
  const openTags = [];
  const issues = [];
  let lineNumber = 0;

  lines.forEach((line, index) => {
    lineNumber = index + 1;
    
    // Check for opening tags
    const openMatches = line.match(/<(\w+)[^>]*>/g);
    if (openMatches) {
      openMatches.forEach(tag => {
        // Ignore self-closing tags
        if (!tag.endsWith('/>')) {
          const tagName = tag.match(/<(\w+)/)[1];
          openTags.push({ tag: tagName, line: lineNumber });
        }
      });
    }
    
    // Check for closing tags
    const closeMatches = line.match(/<\/(\w+)[^>]*>/g);
    if (closeMatches) {
      closeMatches.forEach(tag => {
        const tagName = tag.match(/<\/(\w+)/)[1];
        const lastOpen = openTags.pop();
        
        if (!lastOpen) {
          issues.push(`Line ${lineNumber}: Found closing tag ${tag} without matching opening tag`);
        } else if (lastOpen.tag !== tagName) {
          issues.push(`Line ${lineNumber}: Found closing tag ${tag} but expected ${lastOpen.tag} from line ${lastOpen.line}`);
          // Put back the tag we popped
          openTags.push(lastOpen);
        }
      });
    }
  });
  
  // Report unmatched opening tags
  openTags.forEach(tag => {
    issues.push(`Line ${tag.line}: No closing tag found for ${tag.tag}`);
  });
  
  return {
    issues,
    unclosedTags: openTags
  };
}

const analysis = analyzeComponent(componentContent);

if (analysis.issues.length > 0) {
  console.log('Found issues in MerchantDetail.tsx:');
  analysis.issues.forEach(issue => console.log(issue));
} else {
  console.log('No structural issues found in MerchantDetail.tsx');
}

if (analysis.unclosedTags.length > 0) {
  console.log('\nUnclosed tags:');
  analysis.unclosedTags.forEach(tag => console.log(`${tag.tag} at line ${tag.line}`));
}

// Create a backup of the original file
fs.copyFileSync(componentPath, `${componentPath}.bak`);
console.log(`Backup saved as ${componentPath}.bak`);