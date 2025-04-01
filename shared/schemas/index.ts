/**
 * Schema Index - Exports all schema modules
 */

// Export everything from each schema file
export * from './user.schema';
export * from './merchant.schema';
export * from './contract.schema';
export * from './investment.schema';
export * from './communication.schema';
export * from './integration.schema';
export * from './notification.schema';
export * from './blockchain.schema';
export * from './salesrep.schema';
export * from './enums';

// Export tables organized by domain
import * as userSchemas from './user.schema';
import * as merchantSchemas from './merchant.schema';
import * as contractSchemas from './contract.schema';
import * as investmentSchemas from './investment.schema';
import * as communicationSchemas from './communication.schema';
import * as integrationSchemas from './integration.schema';
import * as notificationSchemas from './notification.schema';
import * as blockchainSchemas from './blockchain.schema';
import * as salesrepSchemas from './salesrep.schema';
import * as enumTypes from './enums';

// Organize tables by domain for easier reference
export const userTables = {
  users: userSchemas.users,
  userProfiles: userSchemas.userProfiles,
  userDevices: userSchemas.userDevices,
  userSessions: userSchemas.userSessions,
  userPermissions: userSchemas.userPermissions,
  userRoles: userSchemas.userRoles,
  userPreferences: userSchemas.userPreferences,
  passwordResetTokens: userSchemas.passwordResetTokens,
  magicLinkTokens: userSchemas.magicLinkTokens,
  otpTokens: userSchemas.otpTokens
};

export const merchantTables = {
  merchants: merchantSchemas.merchants,
  merchantProfiles: merchantSchemas.merchantProfiles,
  merchantBusinessDetails: merchantSchemas.merchantBusinessDetails,
  merchantBankAccounts: merchantSchemas.merchantBankAccounts,
  merchantVerifications: merchantSchemas.merchantVerifications,
  merchantAnalytics: merchantSchemas.merchantAnalytics,
  merchantLocationHours: merchantSchemas.merchantLocationHours,
  merchantOnboardingProgress: merchantSchemas.merchantOnboardingProgress
};

export const contractTables = {
  contracts: contractSchemas.contracts,
  contractTerms: contractSchemas.contractTerms,
  contractPayments: contractSchemas.contractPayments,
  contractSignatures: contractSchemas.contractSignatures,
  contractCustomers: contractSchemas.contractCustomers,
  contractDocuments: contractSchemas.contractDocuments,
  contractCancellationRequests: contractSchemas.contractCancellationRequests,
  contractTransactions: contractSchemas.contractTransactions,
  contractHistory: contractSchemas.contractHistory,
  blockchainTransactions: contractSchemas.blockchainTransactions
};

export const investmentTables = {
  investorProfiles: investmentSchemas.investorProfiles,
  investmentOfferings: investmentSchemas.investmentOfferings,
  investments: investmentSchemas.investments,
  investmentTransactions: investmentSchemas.investmentTransactions,
  investorDocuments: investmentSchemas.investorDocuments,
  investorVerificationProgress: investmentSchemas.investorVerificationProgress
};

export const communicationTables = {
  conversations: communicationSchemas.conversations,
  messages: communicationSchemas.messages,
  notifications: communicationSchemas.notifications,
  smsVerifications: communicationSchemas.smsVerifications,
  emailTemplates: communicationSchemas.emailTemplates,
  emailLogs: communicationSchemas.emailLogs
};

export const integrationTables = {
  assetReports: integrationSchemas.assetReports,
  portfolioMonitoring: integrationSchemas.portfolioMonitoring,
  complaintsData: integrationSchemas.complaintsData,
  integrationCredentials: integrationSchemas.integrationCredentials,
  webhookEvents: integrationSchemas.webhookEvents
};

export const notificationTables = {
  notificationChannels: notificationSchemas.notificationChannels,
  inAppNotifications: notificationSchemas.inAppNotifications,
  customerSatisfactionSurveys: notificationSchemas.customerSatisfactionSurveys
};

export const blockchainTables = {
  smartContractTemplates: blockchainSchemas.smartContractTemplates,
  smartContractDeployments: blockchainSchemas.smartContractDeployments
};

export const salesRepTables = {
  salesReps: salesrepSchemas.salesReps,
  salesRepAnalytics: salesrepSchemas.salesRepAnalytics,
  commissions: salesrepSchemas.commissions
};

export const enums = enumTypes;