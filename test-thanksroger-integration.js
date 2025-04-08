/**
 * Test script to verify the Thanks Roger API integration and template creation
 * This script retrieves an existing agreement from the database and attempts to send it to the Thanks Roger API
 */

import { db, pool } from './server/db.js';
import { merchantProgramAgreements, merchantPrograms, merchants } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

/**
 * Main test function
 */
async function main() {
  console.log('Starting Thanks Roger API integration test...');

  try {
    // Check if Thanks Roger API key is configured
    const thanksRogerApiKey = process.env.THANKS_ROGER_API_KEY;
    if (!thanksRogerApiKey) {
      console.error('THANKS_ROGER_API_KEY environment variable is not set. Please set it before running this test.');
      process.exit(1);
    }

    // Get the first agreement from the database
    const [agreement] = await db.select()
      .from(merchantProgramAgreements)
      .limit(1);
    
    if (!agreement) {
      console.error('No program agreements found in the database. Please upload a document first.');
      process.exit(1);
    }

    console.log('Found agreement:', {
      id: agreement.id,
      programId: agreement.programId,
      filename: agreement.filename,
      originalFilename: agreement.originalFilename,
      mimeType: agreement.mimeType,
      fileSize: agreement.fileSize,
      uploadedAt: agreement.uploadedAt,
      hasExternalTemplateId: !!agreement.externalTemplateId
    });

    // Get the related program
    const [program] = await db.select()
      .from(merchantPrograms)
      .where(eq(merchantPrograms.id, agreement.programId));
    
    if (!program) {
      console.error(`Program with ID ${agreement.programId} not found.`);
      process.exit(1);
    }

    console.log('Related program:', {
      id: program.id,
      name: program.name,
      description: program.description,
      durationMonths: program.durationMonths,
      merchantId: program.merchantId
    });

    // Get the merchant
    const [merchant] = await db.select()
      .from(merchants)
      .where(eq(merchants.id, program.merchantId));
    
    if (!merchant) {
      console.error(`Merchant with ID ${program.merchantId} not found.`);
      process.exit(1);
    }

    console.log('Merchant:', {
      id: merchant.id,
      name: merchant.name,
      email: merchant.email
    });

    // If agreement already has a template ID, display it
    if (agreement.externalTemplateId) {
      console.log('Agreement already has a Thanks Roger template:', {
        templateId: agreement.externalTemplateId,
        templateName: agreement.externalTemplateName
      });

      // Try to fetch template details from Thanks Roger
      console.log('Fetching template details from Thanks Roger...');
      const response = await fetch(`https://api.thanksroger.com/v1/templates/${agreement.externalTemplateId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${thanksRogerApiKey}`
        }
      });

      if (response.ok) {
        const templateDetails = await response.json();
        console.log('Template details:', templateDetails);
      } else {
        console.error('Failed to fetch template details:', await response.text());
      }
    } else {
      console.log('Agreement does not have a Thanks Roger template ID yet. Creating one...');

      // Prepare template data
      const templateData = {
        name: `${merchant.name} - ${program.name} Agreement`,
        description: `Sales agreement for ${merchant.name}'s ${program.name} financing program`,
        document: agreement.data,
        documentName: agreement.originalFilename,
        documentType: agreement.mimeType,
        tags: ["program_agreement", `merchant_${merchant.id}`, `program_${program.id}`],
        metadata: {
          merchantId: merchant.id,
          merchantName: merchant.name,
          programId: program.id,
          programName: program.name,
          programDuration: program.durationMonths,
        }
      };

      // Send to Thanks Roger API
      console.log('Sending document to Thanks Roger API...');
      const response = await fetch("https://api.thanksroger.com/v1/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${thanksRogerApiKey}`
        },
        body: JSON.stringify(templateData)
      });

      if (response.ok) {
        const templateResponse = await response.json();
        console.log('Successfully created Thanks Roger template:', templateResponse);

        // Update the agreement with the template ID and name
        const [updatedAgreement] = await db.update(merchantProgramAgreements)
          .set({
            externalTemplateId: templateResponse.id,
            externalTemplateName: templateResponse.name,
            updatedAt: new Date()
          })
          .where(eq(merchantProgramAgreements.id, agreement.id))
          .returning();

        console.log('Agreement updated with template information:', {
          id: updatedAgreement.id,
          externalTemplateId: updatedAgreement.externalTemplateId,
          externalTemplateName: updatedAgreement.externalTemplateName
        });
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText || "Unknown error" };
        }
        console.error('Failed to create Thanks Roger template:', errorData);
      }
    }

    console.log('Test completed.');
  } catch (error) {
    console.error('An error occurred during the test:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the main function
main();