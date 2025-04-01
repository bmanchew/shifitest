/**
 * Main schema file that imports and exports all schema components
 * This keeps the API the same for external imports while modularizing the schema definition
 */

// Import all enums
import * as enumTypes from './schemas/enums';
export * from './schemas/enums';

// Import all schema modules
import * as userSchema from './schemas/user.schema';
import * as merchantSchema from './schemas/merchant.schema';
import * as contractSchema from './schemas/contract.schema';
import * as investmentSchema from './schemas/investment.schema';
import * as communicationSchema from './schemas/communication.schema';
import * as integrationSchema from './schemas/integration.schema';

// Export all schemas
export * from './schemas/user.schema';
export * from './schemas/merchant.schema';
export * from './schemas/contract.schema';
export * from './schemas/investment.schema';
export * from './schemas/communication.schema';
export * from './schemas/integration.schema';

// Combine tables by domain for easier access
export const userTables = {
  users: userSchema.users,
  emailVerificationTokens: userSchema.emailVerificationTokens,
  passwordResetTokens: userSchema.passwordResetTokens,
  oneTimePasswords: userSchema.oneTimePasswords,
};

export const merchantTables = {
  merchants: merchantSchema.merchants,
  merchantBusinessDetails: merchantSchema.merchantBusinessDetails,
  merchantDocuments: merchantSchema.merchantDocuments,
  merchantVerifications: merchantSchema.merchantVerifications,
  applicationProgress: merchantSchema.applicationProgress,
  merchantPerformance: merchantSchema.merchantPerformance,
  plaidMerchants: merchantSchema.plaidMerchants,
  plaidTransfers: merchantSchema.plaidTransfers,
};

export const contractTables = {
  contracts: contractSchema.contracts,
  contractCancellationRequests: contractSchema.contractCancellationRequests,
  underwritingData: contractSchema.underwritingData,
  salesReps: contractSchema.salesReps,
  salesRepAnalytics: contractSchema.salesRepAnalytics,
  blockchainTransactions: contractSchema.blockchainTransactions,
  commissions: contractSchema.commissions,
};

export const investmentTables = {
  investorProfiles: investmentSchema.investorProfiles,
  investmentOfferings: investmentSchema.investmentOfferings,
  investments: investmentSchema.investments,
  documentLibrary: investmentSchema.documentLibrary,
  investorVerificationDocuments: investmentSchema.investorVerificationDocuments,
  investorVerificationProgress: investmentSchema.investorVerificationProgress,
  thirdPartyVerificationRequests: investmentSchema.thirdPartyVerificationRequests,
};

export const communicationTables = {
  conversations: communicationSchema.conversations,
  messages: communicationSchema.messages,
  supportTickets: communicationSchema.supportTickets,
  ticketAttachments: communicationSchema.ticketAttachments,
  ticketActivityLog: communicationSchema.ticketActivityLog,
  notifications: communicationSchema.notifications,
  logs: communicationSchema.logs,
};

export const integrationTables = {
  assetReports: integrationSchema.assetReports,
  portfolioMonitoring: integrationSchema.portfolioMonitoring,
  complaintsData: integrationSchema.complaintsData,
  integrationCredentials: integrationSchema.integrationCredentials,
  webhookEvents: integrationSchema.webhookEvents,
};

// Export all enum types
export const enums = enumTypes;