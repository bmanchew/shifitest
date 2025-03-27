// Simple HTTP server to test Twilio SMS functionality
import http from 'http';
import url from 'url';
import pkg from 'twilio';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Twilio
const { Twilio } = pkg;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Validate Twilio configuration
const twilioConfigured = accountSid && authToken && fromNumber;
if (!twilioConfigured) {
  console.warn('⚠️ WARNING: Twilio is not fully configured. SMS will be simulated.');
  console.log('Required environment variables:');
  console.log(`- TWILIO_ACCOUNT_SID: ${accountSid ? '✅ Set' : '❌ Missing'}`);
  console.log(`- TWILIO_AUTH_TOKEN: ${authToken ? '✅ Set' : '❌ Missing'}`);
  console.log(`- TWILIO_PHONE_NUMBER: ${fromNumber ? '✅ Set' : '❌ Missing'}`);
}

// Create Twilio client if configured
const client = twilioConfigured ? new Twilio(accountSid, authToken) : null;

// Simple JSON parsing from request
function parseJsonFromRequest(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const data = JSON.parse(Buffer.concat(chunks).toString());
        resolve(data);
      } catch (err) {
        reject(new Error('Invalid JSON data'));
      }
    });
    req.on('error', reject);
  });
}

// Send SMS using Twilio
async function sendSms(to, body) {
  if (!twilioConfigured) {
    console.log(`📱 SIMULATED SMS to ${to}: ${body}`);
    return {
      success: true,
      isSimulated: true,
      messageId: 'sim_' + Date.now(),
      to,
      body
    };
  }

  try {
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to
    });

    console.log(`✅ SMS sent to ${to}, SID: ${message.sid}`);
    return {
      success: true,
      isSimulated: false, 
      messageId: message.sid,
      status: message.status,
      dateCreated: message.dateCreated
    };
  } catch (error) {
    console.error('❌ Twilio error:', error.message);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

// Format phone number for consistency
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Add + prefix if needed
  if (cleaned.length === 10) {
    // Assume US number if 10 digits
    return `+1${cleaned}`;
  } else if (cleaned.length > 10) {
    // Assume international number, add + prefix
    return `+${cleaned}`;
  }
  
  // Return original if we can't format it
  return phoneNumber;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Handle routes
  try {
    // Server status endpoint
    if (path === '/status' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        message: 'Server is running',
        twilioConfigured,
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // Twilio configuration check endpoint
    if (path === '/twilio/check' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        twilioConfigured,
        accountSid: accountSid ? '✅ Configured' : '❌ Missing',
        authToken: authToken ? '✅ Configured' : '❌ Missing',
        fromNumber: fromNumber || '❌ Missing'
      }));
      return;
    }
    
    // Send SMS endpoint
    if (path === '/twilio/send-sms' && req.method === 'POST') {
      const data = await parseJsonFromRequest(req);
      
      if (!data.phoneNumber || !data.message) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: 'Phone number and message are required'
        }));
        return;
      }
      
      // Format the phone number
      const formattedPhoneNumber = formatPhoneNumber(data.phoneNumber);
      
      // Send the SMS
      const result = await sendSms(formattedPhoneNumber, data.message);
      
      res.statusCode = result.success ? 200 : 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
      return;
    }
    
    // Default response for unknown paths
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: 'Not found'
    }));
  } catch (error) {
    console.error('Server error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }));
  }
});

// Start server on requested port, fallback to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Twilio Test Server running at http://0.0.0.0:${PORT}/`);
  console.log(`Twilio configuration: ${twilioConfigured ? '✅ Fully configured' : '⚠️ Not fully configured'}`);
  console.log('\nAvailable endpoints:');
  console.log(`- GET  http://localhost:${PORT}/status - Check server status`);
  console.log(`- GET  http://localhost:${PORT}/twilio/check - Check Twilio configuration`);
  console.log(`- POST http://localhost:${PORT}/twilio/send-sms - Send SMS message`);
  console.log('  Required body: { "phoneNumber": "+1XXXXXXXXXX", "message": "Your message" }');
});