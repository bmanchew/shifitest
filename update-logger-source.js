const fs = require('fs');
const path = require('path');

const filePath = path.resolve('./server/services/zapier.ts');

// Read the file content
const content = fs.readFileSync(filePath, 'utf8');

// Replace all occurrences of source: 'zapier', with source: 'zapier' as LogSource,
const updatedContent = content.replace(/source: ['"]zapier['"],/g, "source: 'zapier' as LogSource,");

// Write the updated content back to the file
fs.writeFileSync(filePath, updatedContent);

console.log('Updated all occurrences of zapier source in zapier.ts');

// Now do the same for routes/webhooks/zapier.ts
const webhookFilePath = path.resolve('./server/routes/webhooks/zapier.ts');
if (fs.existsSync(webhookFilePath)) {
  const webhookContent = fs.readFileSync(webhookFilePath, 'utf8');
  const updatedWebhookContent = webhookContent.replace(/source: ['"]webhook['"],/g, "source: 'webhook' as LogSource,");
  fs.writeFileSync(webhookFilePath, updatedWebhookContent);
  console.log('Updated all occurrences of webhook source in webhooks/zapier.ts');
}

// And for merchant-zapier-settings.ts
const settingsFilePath = path.resolve('./server/routes/admin/merchant-zapier-settings.ts');
if (fs.existsSync(settingsFilePath)) {
  const settingsContent = fs.readFileSync(settingsFilePath, 'utf8');
  const updatedSettingsContent = settingsContent
    .replace(/source: ['"]internal['"],/g, "source: 'internal' as LogSource,")
    .replace(/source: ['"]zapier['"],/g, "source: 'zapier' as LogSource,");
  fs.writeFileSync(settingsFilePath, updatedSettingsContent);
  console.log('Updated all occurrences of source in merchant-zapier-settings.ts');
}
