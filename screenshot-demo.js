// Simple script to render our components to HTML to visualize them
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create mock HTML representation of ContractTerms
const contractTermsHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Contract Terms Screenshot</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .alert { background-color: #ebf5ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
    .alert-title { font-weight: 600; color: #1e40af; margin-bottom: 4px; }
    .alert-desc { color: #3b82f6; }
    .bg-gray { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
    .checkbox-item { display: flex; align-items: flex-start; margin-bottom: 12px; }
    .checkbox { margin-right: 10px; margin-top: 3px; }
    .btn-container { display: flex; justify-content: space-between; }
    .btn { padding: 8px 16px; border-radius: 4px; font-weight: 500; cursor: pointer; }
    .btn-primary { background-color: #3b82f6; color: white; border: none; }
    .btn-outline { background-color: white; border: 1px solid #d1d5db; color: #374151; }
    .text-blue { color: #3b82f6; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 8px;">Pre-Qualification for Financing</h3>
    <p style="font-size: 14px; color: #4b5563; margin-bottom: 16px;">
      Before we can show you your personalized financing options for your purchase from
      <span style="font-weight: 500; color: #1f2937;">TechGadgetStore</span>, we need to check your eligibility.
    </p>

    <div class="alert">
      <div class="alert-title">What happens next?</div>
      <div class="alert-desc">
        After you provide consent, we'll guide you through the application process. Once we've verified your information and 
        connected to your bank account, we'll present your personalized financing offer.
      </div>
    </div>

    <div class="bg-gray">
      <h4 style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 8px;">FCRA Disclosure</h4>
      <div style="font-size: 14px; color: #4b5563;">
        <p>
          I am providing written instructions authorizing TechGadgetStore and affiliates to obtain my personal credit profile or other
          information from credit reporting agencies under the FCRA solely to conduct a credit pre-qualification.
        </p>
        <p>
          I further understand that this is a soft pull and will not harm my credit in any way whatsoever.
        </p>
      </div>
    </div>

    <div style="margin-bottom: 24px;">
      <div class="checkbox-item">
        <input type="checkbox" id="fcra-consent" class="checkbox" />
        <label for="fcra-consent" style="font-size: 14px; line-height: 1.4;">
          I authorize TechGadgetStore to obtain my credit information to determine what financing options I qualify for.
          This will not affect my credit score.
        </label>
      </div>

      <div class="checkbox-item">
        <input type="checkbox" id="privacy-policy" class="checkbox" />
        <label for="privacy-policy" style="font-size: 14px; line-height: 1.4;">
          I agree to the <a href="#">terms and conditions</a> and
          <a href="#">privacy policy</a>.
        </label>
      </div>
    </div>

    <div class="btn-container">
      <button class="btn btn-outline">Back</button>
      <button class="btn btn-primary">PreQualify Me!</button>
    </div>
  </div>
</body>
</html>
`;

// Create mock HTML representation of FinancingOffer
const financingOfferHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Financing Offer Screenshot</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
    .card-header { background-color: #f3f8ff; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; }
    .card-title { font-size: 18px; font-weight: 600; display: flex; align-items: center; }
    .card-desc { font-size: 14px; color: #6b7280; margin-top: 4px; }
    .card-content { padding: 24px 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px; }
    .label { color: #6b7280; }
    .value { font-weight: 500; color: #111827; }
    .highlight { font-weight: 700; color: #3b82f6; font-size: 18px; }
    .info-box { background-color: #ebf8ff; border: 1px solid #bde0fe; border-radius: 6px; padding: 16px; margin-top: 24px; }
    .info-box-title { font-weight: 500; color: #1e40af; margin-bottom: 8px; }
    .info-box-desc { font-size: 14px; color: #1e3a8a; }
    .note-box { background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 24px 0; }
    .btn-container { display: flex; justify-content: space-between; margin-top: 32px; }
    .btn { padding: 8px 16px; border-radius: 4px; font-weight: 500; cursor: pointer; }
    .btn-primary { background-color: #3b82f6; color: white; border: none; }
    .btn-outline { background-color: white; border: 1px solid #d1d5db; color: #374151; }
    .check-icon { color: #10b981; margin-right: 8px; font-size: 20px; }
  </style>
</head>
<body>
  <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 24px;">Your Financing Offer</h1>
  <p style="color: #6b7280; margin-bottom: 32px;">
    Based on your provided information and verified credit profile, we are pleased to present you with the following financing offer from ShiFi:
  </p>

  <div class="card">
    <div class="card-header">
      <div class="card-title">
        <span class="check-icon">✓</span>
        Pre-Qualified Financing Offer
      </div>
      <div class="card-desc">
        From TechGadgetStore in partnership with ShiFi
      </div>
    </div>
    <div class="card-content">
      <div class="grid">
        <div class="label">Purchase Amount:</div>
        <div class="value">$1,500.00</div>

        <div class="label">Down Payment:</div>
        <div class="value">$150.00</div>

        <div class="label">Amount Financed:</div>
        <div class="value">$1,350.00</div>

        <div class="label">Term Length:</div>
        <div class="value">24 months</div>

        <div class="label">Annual Percentage Rate (APR):</div>
        <div class="value">0%</div>

        <div class="label" style="font-weight: 600; font-size: 18px;">Monthly Payment:</div>
        <div class="highlight">$56.25</div>
      </div>

      <div class="info-box">
        <h4 class="info-box-title">ShiFi Zero-Interest Program</h4>
        <p class="info-box-desc">
          Your credit profile qualifies you for our ShiFi Zero-Interest Program, which allows you to make 
          affordable monthly payments with 0% interest for the full 24-month term.
        </p>
      </div>
    </div>
  </div>

  <div class="note-box">
    <h3 style="font-weight: 500; margin-bottom: 8px;">What happens next?</h3>
    <p style="font-size: 14px; color: #6b7280;">
      After accepting this offer, you'll set up your payment schedule and sign your financing agreement.
      Your first payment will be due 30 days after signing.
    </p>
  </div>

  <div class="btn-container">
    <button class="btn btn-outline">Back</button>
    <button class="btn btn-primary">Accept Offer & Continue</button>
  </div>
</body>
</html>
`;

// Save the HTML files
fs.writeFileSync(path.join(__dirname, 'contract-terms-screenshot.html'), contractTermsHTML);
fs.writeFileSync(path.join(__dirname, 'financing-offer-screenshot.html'), financingOfferHTML);

console.log('Generated HTML screenshot files:');
console.log('1. contract-terms-screenshot.html - Shows the Contract Terms with FCRA disclaimer');
console.log('2. financing-offer-screenshot.html - Shows the new Financing Offer step');
console.log('\nOpen these files in a browser to see how the components will look');