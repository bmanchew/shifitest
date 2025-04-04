import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'server', 'services', 'coveredCare.ts');

// Read the file
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Replace all occurrences of source: "external" with source: "internal"
  const updatedContent = data.replace(/source: "external"/g, 'source: "internal"');

  // Write the file back
  fs.writeFile(filePath, updatedContent, 'utf8', (err) => {
    if (err) {
      console.error('Error writing file:', err);
      return;
    }
    console.log('Successfully updated coveredCare.ts - all source: "external" replaced with source: "internal"');
  });
});