/**
 * This file provides an example Plaid Link flow implementation
 * to obtain a valid access token for a merchant
 * 
 * Note: This is meant to be integrated with your frontend application
 * and requires user interaction via the Plaid Link interface
 */

const express = require('express');
const bodyParser = require('body-parser');
const { Configuration, PlaidApi, PlaidEnvironments, Products } = require('plaid');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configure Express
const app = express();
app.use(bodyParser.json());

// Configure Plaid
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENVIRONMENT || 'production';

// Configure Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(configuration);

// Store tokens in memory for demo purposes (in production, use a database)
// To properly implement this in your app, you would update your database
const TOKENS = {};

/**
 * Create a link token - this starts the Plaid Link flow
 * This endpoint would be called from your frontend to initialize Plaid Link
 */
app.post('/api/create-link-token', async (req, res) => {
  try {
    // Extract merchant ID from request
    const { merchantId } = req.body;
    
    if (!merchantId) {
      return res.status(400).json({ error: 'Merchant ID is required' });
    }
    
    // Set up configuration for link token request
    const linkTokenConfig = {
      user: {
        client_user_id: `merchant-${merchantId}`,
      },
      client_name: 'ShiFi Finance',
      products: [Products.Assets, Products.Auth, Products.Transactions],
      language: 'en',
      webhook: process.env.PLAID_WEBHOOK_URL || 'https://shilohfinance.com/api/plaid/webhook',
      country_codes: ['US'],
    };
    
    // Create link token
    const linkTokenResponse = await plaidClient.linkTokenCreate(linkTokenConfig);
    const linkToken = linkTokenResponse.data.link_token;
    
    // Return link token to frontend
    res.json({ link_token: linkToken });
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Exchange a public token for an access token
 * This endpoint would be called from your frontend after Plaid Link completion
 */
app.post('/api/exchange-public-token', async (req, res) => {
  try {
    // Extract public token and merchant ID from request
    const { public_token, merchantId } = req.body;
    
    if (!public_token) {
      return res.status(400).json({ error: 'Public token is required' });
    }
    
    if (!merchantId) {
      return res.status(400).json({ error: 'Merchant ID is required' });
    }
    
    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });
    
    // Get the access token
    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;
    
    // Store tokens (in production, save to your database)
    TOKENS[merchantId] = {
      access_token: accessToken,
      item_id: itemId,
    };
    
    console.log(`Successfully stored access token for merchant ${merchantId}`);
    
    // In a real implementation, you would save this access token to your database:
    /*
    await db.query(
      `UPDATE plaid_merchants 
       SET access_token = $1, 
           item_id = $2,
           updated_at = NOW()
       WHERE merchant_id = $3`,
      [accessToken, itemId, merchantId]
    );
    */
    
    // Return success to frontend
    res.json({ 
      success: true,
      message: `Access token obtained and saved for merchant ${merchantId}`,
    });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate an asset report for a merchant
 * This demonstrates how to use a valid access token to create an asset report
 */
app.post('/api/generate-asset-report', async (req, res) => {
  try {
    // Extract merchant ID from request
    const { merchantId, days = 90 } = req.body;
    
    if (!merchantId) {
      return res.status(400).json({ error: 'Merchant ID is required' });
    }
    
    // Get the access token from storage
    const tokenData = TOKENS[merchantId];
    
    if (!tokenData || !tokenData.access_token) {
      return res.status(404).json({ 
        error: 'No access token found for this merchant. Please complete Plaid Link first.' 
      });
    }
    
    // Create asset report
    const assetReportResponse = await plaidClient.assetReportCreate({
      access_tokens: [tokenData.access_token],
      days_requested: days,
      options: {
        client_report_id: `merchant-${merchantId}-${Date.now()}`,
        webhook: process.env.PLAID_WEBHOOK_URL || 'https://shilohfinance.com/api/plaid/webhook',
        user: {
          client_user_id: `merchant-${merchantId}`,
        }
      }
    });
    
    const assetReportId = assetReportResponse.data.asset_report_id;
    const assetReportToken = assetReportResponse.data.asset_report_token;
    
    // In a real implementation, you would save this to your database:
    /*
    await db.query(
      `INSERT INTO asset_reports 
       (user_id, asset_report_id, asset_report_token, days_requested, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())`,
      [merchantId, assetReportId, assetReportToken, days]
    );
    */
    
    // Return success to frontend
    res.json({
      success: true,
      message: 'Asset report generation initiated',
      asset_report_id: assetReportId
    });
  } catch (error) {
    console.error('Error generating asset report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Please implement the following in your frontend application:');
  console.log('1. Call /api/create-link-token to start the Plaid Link flow');
  console.log('2. Use the returned link_token with Plaid Link in your frontend');
  console.log('3. After the user completes Plaid Link, you will receive a public_token');
  console.log('4. Call /api/exchange-public-token to exchange the public_token for an access_token');
  console.log('5. The access_token will be saved and can be used for asset report generation');
  console.log('6. Call /api/generate-asset-report to create an asset report with the valid access_token');
});