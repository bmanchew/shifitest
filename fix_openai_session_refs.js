const fs = require('fs');
const path = require('path');

const filePath = 'client/src/components/customer/RealtimeAudioSherpa.tsx';
const fileContent = fs.readFileSync(filePath, 'utf8');

// Replace all instances of openaiSessionReady with openaiSessionReadyRef.current
const updatedContent = fileContent
  .replace(/if\s*\([^)]*openaiSessionReady\s*\)/g, match => match.replace(/openaiSessionReady/g, 'openaiSessionReadyRef.current'))
  .replace(/openaiSessionReady\s*[^\.]/g, match => match.replace(/openaiSessionReady/, 'openaiSessionReadyRef.current'))
  .replace(/setOpenaiSessionReady\s*\(\s*true\s*\)/g, 'openaiSessionReadyRef.current = true')
  .replace(/setOpenaiSessionReady\s*\(\s*false\s*\)/g, 'openaiSessionReadyRef.current = false');

fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log('File updated successfully!');
