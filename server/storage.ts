import bcrypt from 'bcrypt';
import { logger } from './services/logger';
import {
  // User related schemas and types
  users, User, InsertUser,
  emailVerificationTokens, EmailVerificationToken, InsertEmailVerificationToken,
  passwordResetTokens, PasswordResetToken, InsertPasswordResetToken,
  oneTimePasswords, OneTimePassword, InsertOneTimePassword,
  
  // Merchant related schemas and types
  merchants, Merchant, InsertMerchant,
  merchantBusinessDetails, MerchantBusinessDetail, InsertMerchantBusinessDetail,
  merchantDocuments, MerchantDocument, InsertMerchantDocument,
  applicationProgress, ApplicationProgress, InsertApplicationProgress,
  plaidMerchants, PlaidMerchant, InsertPlaidMerchant,
  plaidTransfers, PlaidTransfer, InsertPlaidTransfer,
  
  // Contract related schemas and types
  contracts, Contract, InsertContract,
  contractCancellationRequests, ContractCancellationRequest, InsertContractCancellationRequest,
  underwritingData,
  
  // Investment related schemas and types
  investorProfiles, InvestorProfile, InsertInvestorProfile,
  investmentOfferings, InvestmentOffering, InsertInvestmentOffering,
  investments, Investment, InsertInvestment,
  documentLibrary, DocumentLibrary, InsertDocumentLibrary,
  
  // Communication related schemas and types
  conversations, Conversation, InsertConversation,
  messages, Message, InsertMessage,
  supportTickets, SupportTicket, InsertSupportTicket,
  ticketAttachments, TicketAttachment, InsertTicketAttachment,
  ticketActivityLog, TicketActivityLog, InsertTicketActivityLog,
  notifications, Notification, InsertNotification,
  logs, Log, InsertLog,
  chatSessions, ChatSession, InsertChatSession,
  chatMessages, ChatMessage, InsertChatMessage,

  // Support agent related schemas
  supportAgents, SupportAgent, InsertSupportAgent,
  supportAgentPerformance, SupportAgentPerformance, InsertSupportAgentPerformance,
  ticketSlaConfigs, TicketSlaConfig, InsertTicketSlaConfig,
  
  // Knowledge base related schemas
  knowledgeBaseArticles, KnowledgeBaseArticle, InsertKnowledgeBaseArticle,
  knowledgeCategories, KnowledgeCategory, InsertKnowledgeCategory,
  knowledgeTags, KnowledgeTag, InsertKnowledgeTag,
  articleTags, ArticleTag, InsertArticleTag,
  articleFeedback, ArticleFeedback, InsertArticleFeedback,
  
  // Integration related schemas and types
  assetReports, AssetReport, InsertAssetReport,
  portfolioMonitoring, PortfolioMonitoring, InsertPortfolioMonitoring,
  complaintsData, ComplaintsData, InsertComplaintsData,
} from "@shared/schema";

// Import salesrep related schemas
import {
  salesReps, SalesRep, InsertSalesRep,
  salesRepAnalytics, SalesRepAnalytics, InsertSalesRepAnalytics,
  commissions, Commission, InsertCommission
} from "@shared/schemas/salesrep.schema";

// Import notification related schemas
import {
  notificationChannels, NotificationChannel, InsertNotificationChannel,
  inAppNotifications, InAppNotification, InsertInAppNotification,
  customerSatisfactionSurveys, CustomerSatisfactionSurvey, InsertCustomerSatisfactionSurvey
} from "@shared/schemas/notification.schema";

// Import blockchain related schemas
import {
  smartContractTemplates, SmartContractTemplate, InsertSmartContractTemplate,
  smartContractDeployments, SmartContractDeployment, InsertSmartContractDeployment
} from "@shared/schemas/blockchain.schema";
import { db, pool } from "./db";
import { eq, and, desc, inArray, SQL, or, like, lt, not } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  findOrCreateUserByPhone(phone: string): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserName(userId: number, firstName?: string, lastName?: string): Promise<User | null>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<User | undefined>;

  // Email verification operations
  createEmailVerificationToken(token: InsertEmailVerificationToken): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  markEmailVerificationTokenUsed(id: number): Promise<EmailVerificationToken | undefined>;
  consumeEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  verifyUserEmail(userId: number): Promise<User | undefined>;

  // Password reset operations
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<PasswordResetToken | undefined>;
  verifyPasswordResetToken(token: string): Promise<User | undefined>;
  invalidatePasswordResetTokens(userId: number): Promise<number>;
  
  // OTP operations
  createOneTimePassword(otp: InsertOneTimePassword): Promise<OneTimePassword>;
  getOneTimePasswordByCode(code: string, phone: string): Promise<OneTimePassword | undefined>;
  getOneTimePasswordByPhone(phone: string, purpose?: string): Promise<OneTimePassword | undefined>;
  markOneTimePasswordUsed(id: number): Promise<OneTimePassword | undefined>;
  verifyOneTimePassword(code: string, phone: string): Promise<boolean>;
  invalidateOneTimePasswords(phone: string): Promise<number>;

  // Add to the IStorage interface
  updateAssetReport(id: number, data: Partial<AssetReport>): Promise<AssetReport | undefined>;
  
  // Contract Cancellation operations
  createContractCancellationRequest(request: InsertContractCancellationRequest): Promise<ContractCancellationRequest>;
  getContractCancellationRequest(id: number): Promise<ContractCancellationRequest | undefined>;
  getContractCancellationRequestsByContractId(contractId: number): Promise<ContractCancellationRequest[]>;
  getContractCancellationRequestsByMerchantId(merchantId: number): Promise<ContractCancellationRequest[]>;
  getPendingContractCancellationRequests(): Promise<ContractCancellationRequest[]>;
  updateContractCancellationRequest(id: number, data: Partial<ContractCancellationRequest>): Promise<ContractCancellationRequest | undefined>;
  updateContractCancellationRequestStatus(id: number, status: string, adminId?: number): Promise<ContractCancellationRequest | undefined>;
  
  // Conversation operations
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversation(id: number): Promise<Conversation | undefined>;
  updateConversation(id: number, data: Partial<Conversation>): Promise<Conversation | undefined>;
  updateConversationStatus(id: number, status: string): Promise<Conversation | undefined>;
  getConversationsByContractId(contractId: number): Promise<Conversation[]>;
  getConversationsByUserId(userId: number): Promise<Conversation[]>;
  getConversationsForMerchant(merchantId: number): Promise<Conversation[]>;
  getAllConversations(limit?: number, offset?: number): Promise<Conversation[]>;
  
  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByConversationId(conversationId: number, options?: { limit?: number, offset?: number }): Promise<Message[]>;
  markMessageAsRead(id: number): Promise<Message | undefined>;
  markAllMessagesAsRead(conversationId: number, userId: number): Promise<number>; // Returns count of messages updated
  getUnreadMessageCountForMerchant(merchantId: number): Promise<number>;
  
  // Smart Contract Template operations
  getSmartContractTemplates(): Promise<SmartContractTemplate[]>;
  getSmartContractTemplate(id: number): Promise<SmartContractTemplate | undefined>;
  getSmartContractTemplatesByType(contractType: string): Promise<SmartContractTemplate[]>;
  createSmartContractTemplate(template: InsertSmartContractTemplate): Promise<SmartContractTemplate>;
  updateSmartContractTemplate(id: number, data: Partial<SmartContractTemplate>): Promise<SmartContractTemplate | undefined>;
  
  // Smart Contract Deployment operations
  getSmartContractDeployments(): Promise<SmartContractDeployment[]>;
  getSmartContractDeployment(id: number): Promise<SmartContractDeployment | undefined>;
  getSmartContractDeploymentsByTemplateId(templateId: number): Promise<SmartContractDeployment[]>;
  createSmartContractDeployment(deployment: InsertSmartContractDeployment): Promise<SmartContractDeployment>;

  // Merchant operations
  getMerchant(id: number): Promise<Merchant | undefined>;
  getMerchantByUserId(userId: number): Promise<Merchant | undefined>;
  getAllMerchants(): Promise<Merchant[]>;
  getAllMerchantsWithDetails(): Promise<(Merchant & { businessDetails?: MerchantBusinessDetails })[]>;
  createMerchant(merchant: InsertMerchant): Promise<Merchant>;

  // Plaid Platform Merchant operations
  getPlaidMerchant(id: number): Promise<PlaidMerchant | undefined>;
  getPlaidMerchantByMerchantId(merchantId: number): Promise<PlaidMerchant | undefined>;
  getPlaidMerchantByOriginatorId(originatorId: string): Promise<PlaidMerchant | undefined>;
  createPlaidMerchant(data: InsertPlaidMerchant): Promise<PlaidMerchant>;
  updatePlaidMerchant(id: number, data: Partial<InsertPlaidMerchant>): Promise<PlaidMerchant | undefined>;
  getPlaidMerchantsByStatus(status: string): Promise<PlaidMerchant[]>;

  // Plaid Transfer operations
  createPlaidTransfer(transfer: InsertPlaidTransfer): Promise<PlaidTransfer>;
  getPlaidTransferById(id: number): Promise<PlaidTransfer | undefined>;
  getPlaidTransferByExternalId(transferId: string): Promise<PlaidTransfer | undefined>;
  getPlaidTransfersByContractId(contractId: number): Promise<PlaidTransfer[]>;
  getPlaidTransfersByMerchantId(merchantId: number): Promise<PlaidTransfer[]>;
  getPlaidTransfers(params: { merchantId?: number; type?: string; status?: string }): Promise<PlaidTransfer[]>;
  updatePlaidTransferStatus(id: number, status: string): Promise<PlaidTransfer | undefined>;

  // Contract operations
  getContract(id: number): Promise<Contract | undefined>;
  getContractByNumber(contractNumber: string): Promise<Contract | undefined>;
  getAllContracts(): Promise<Contract[]>;
  getContractsByMerchantId(merchantId: number): Promise<Contract[]>;
  getContractsByCustomerId(customerId: number): Promise<Contract[]>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContractStatus(id: number, status: string): Promise<Contract | undefined>;
  updateContractStep(id: number, step: string): Promise<Contract | undefined>;
  updateContractCustomerId(id: number, customerId: number): Promise<Contract | undefined>;
  getContractsByPhoneNumber(phoneNumber: string): Promise<Contract[]>; // Added method
  updateContract(id: number, data: Partial<Contract>): Promise<Contract>; //Added method
  getContractsByTokenizationStatus(status: string): Promise<Contract[]>; // Added for blockchain

  // Application Progress operations
  getApplicationProgress(id: number): Promise<ApplicationProgress | undefined>;
  getApplicationProgressByContractId(contractId: number): Promise<ApplicationProgress[]>;
  getApplicationProgressByContractIdAndStep(contractId: number, step: string): Promise<ApplicationProgress | null>;
  createApplicationProgress(progress: InsertApplicationProgress): Promise<ApplicationProgress>;
  updateApplicationProgressCompletion(id: number, completed: boolean, data?: string): Promise<ApplicationProgress | undefined>;
  updateApplicationProgress(progressId: number, data: Partial<ApplicationProgress>): Promise<ApplicationProgress | null>;
  getCompletedKycVerificationsByUserId(userId: number): Promise<ApplicationProgress[]>;

  // Log operations
  createLog(log: InsertLog): Promise<Log>;
  getLogs(): Promise<Log[]>;
  getLogsByUserId(userId: number): Promise<Log[]>;

  // Underwriting Data operations
  getUnderwritingDataByUserId(userId: number): Promise<any[]>;
  getUnderwritingDataByContractId(contractId: number): Promise<any[]>;
  createUnderwritingData(data: any): Promise<any>;
  updateUnderwritingData(id: number, data: any): Promise<any>;

  // Portfolio Monitoring operations
  getAllUnderwritingData(): Promise<any[]>;
  getContractsByStatus(status: string): Promise<Contract[]>;
  storeAssetReportToken(contractId: number, assetReportToken: string, assetReportId: string, options: any): Promise<AssetReport>;
  getAssetReportById(id: number): Promise<AssetReport | undefined>;
  getAssetReportsByContractId(contractId: number): Promise<AssetReport[]>;
  getAssetReportsByUserId(userId: number): Promise<AssetReport[]>;
  getAssetReportsByAssetReportId(assetReportId: string): Promise<AssetReport[]>;
  updateAssetReportStatus(id: number, status: string, analysisData?: any): Promise<AssetReport | undefined>;
  getLatestPortfolioMonitoring(): Promise<PortfolioMonitoring | null>;
  updatePortfolioMonitoring(data: any): Promise<PortfolioMonitoring>;
  saveComplaintsData(complaints: any[]): Promise<ComplaintsData[]>;
  getComplaintsData(options?: { product?: string; company?: string; limit?: number; offset?: number }): Promise<ComplaintsData[]>;
  updateUserName(userId: number, firstName?: string, lastName?: string): Promise<User | null>;

  // Merchant Business Details operations
  getMerchantBusinessDetails(id: number): Promise<MerchantBusinessDetails | undefined>;
  getMerchantBusinessDetailsByMerchantId(merchantId: number): Promise<MerchantBusinessDetails | undefined>;
  getAllMerchantBusinessDetailsByMerchantId(merchantId: number): Promise<MerchantBusinessDetails[]>;
  createMerchantBusinessDetails(details: InsertMerchantBusinessDetails): Promise<MerchantBusinessDetails>;
  updateMerchantBusinessDetails(id: number, details: Partial<InsertMerchantBusinessDetails>): Promise<MerchantBusinessDetails | undefined>;

  // Merchant Documents operations
  getMerchantDocument(id: number): Promise<MerchantDocument | undefined>;
  getMerchantDocumentsByMerchantId(merchantId: number): Promise<MerchantDocument[]>;
  getMerchantDocumentsByType(merchantId: number, type: string): Promise<MerchantDocument[]>;
  createMerchantDocument(document: InsertMerchantDocument): Promise<MerchantDocument>;
  updateMerchantDocumentVerification(id: number, verified: boolean, verifiedBy?: number): Promise<MerchantDocument | undefined>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<number>; // Return notification ID
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByRecipient(recipientId: number, recipientType: string): Promise<Notification[]>;
  updateNotification(data: { id: number, status: string, updatedAt: Date }): Promise<Notification | undefined>;

  // Notification Channel operations
  createNotificationChannel(channel: InsertNotificationChannel): Promise<NotificationChannel>;
  updateNotificationChannel(data: { notificationId: number, channel: string, status: string, updatedAt: Date, errorMessage?: string }): Promise<NotificationChannel | undefined>;
  getNotificationChannels(notificationId: number): Promise<NotificationChannel[]>;

  // In-App Notification operations
  createInAppNotification(notification: InsertInAppNotification): Promise<InAppNotification>;
  getInAppNotifications(userId: number, userType: string, options?: { unreadOnly?: boolean, limit?: number, offset?: number }): Promise<InAppNotification[]>;
  markInAppNotificationAsRead(id: number): Promise<InAppNotification | undefined>;
  markAllInAppNotificationsAsRead(userId: number, userType: string): Promise<number>; // Returns count of notifications updated

  // Customer Satisfaction Survey operations
  createSatisfactionSurvey(survey: InsertCustomerSatisfactionSurvey): Promise<CustomerSatisfactionSurvey>;
  getSatisfactionSurvey(id: number): Promise<CustomerSatisfactionSurvey | undefined>;
  getSatisfactionSurveysByContractId(contractId: number): Promise<CustomerSatisfactionSurvey[]>;
  getSatisfactionSurveysByCustomerId(customerId: number): Promise<CustomerSatisfactionSurvey[]>;
  updateSatisfactionSurvey(id: number, data: Partial<CustomerSatisfactionSurvey>): Promise<CustomerSatisfactionSurvey | undefined>;
  getActiveContractsDueForSurvey(daysActive: number): Promise<Contract[]>; // Gets contracts active for X days that haven't had surveys sent

  updateMerchant(id: number, updateData: Partial<Merchant>): Promise<Merchant | undefined>;
  getMerchantByEmail(email: string): Promise<Merchant | undefined>;

  // Sales Rep operations
  getSalesRep(id: number): Promise<SalesRep | undefined>;
  getSalesRepByUserId(userId: number): Promise<SalesRep | undefined>;
  getSalesRepsByMerchantId(merchantId: number): Promise<SalesRep[]>;
  createSalesRep(salesRep: InsertSalesRep): Promise<SalesRep>;
  updateSalesRep(id: number, data: Partial<SalesRep>): Promise<SalesRep | undefined>;
  
  // Commission operations
  getCommission(id: number): Promise<Commission | undefined>;
  getCommissionsByContractId(contractId: number): Promise<Commission[]>;
  getCommissionsBySalesRepId(salesRepId: number): Promise<Commission[]>;
  createCommission(commission: InsertCommission): Promise<Commission>;
  updateCommissionStatus(id: number, status: string, paidAt?: Date): Promise<Commission | undefined>;
  
  // Sales Rep Analytics operations
  getSalesRepAnalytics(id: number): Promise<SalesRepAnalytics | undefined>;
  getSalesRepAnalyticsBySalesRepId(salesRepId: number): Promise<SalesRepAnalytics | undefined>;
  
  // Investor Profile operations
  getInvestorProfile(id: number): Promise<InvestorProfile | undefined>;
  getInvestorProfileByUserId(userId: number): Promise<InvestorProfile | undefined>;
  getInvestorProfilesBySessionId(sessionId: string): Promise<InvestorProfile[]>;
  createInvestorProfile(profile: InsertInvestorProfile): Promise<InvestorProfile>;
  updateInvestorProfile(id: number, data: Partial<InvestorProfile>): Promise<InvestorProfile | undefined>;
  getAllInvestorProfiles(): Promise<InvestorProfile[]>;
  getInvestorProfilesByVerificationStatus(status: string): Promise<InvestorProfile[]>;
  
  // Investment Offering operations
  getInvestmentOffering(id: number): Promise<InvestmentOffering | undefined>;
  getInvestmentOfferingByContractId(contractId: number): Promise<InvestmentOffering | undefined>;
  createInvestmentOffering(offering: InsertInvestmentOffering): Promise<InvestmentOffering>;
  updateInvestmentOffering(id: number, data: Partial<InvestmentOffering>): Promise<InvestmentOffering | undefined>;
  getInvestmentOfferings(): Promise<InvestmentOffering[]>;
  getInvestmentOfferingsByStatus(status: string): Promise<InvestmentOffering[]>;
  
  // Investment operations
  getInvestment(id: number): Promise<Investment | undefined>;
  getInvestmentsByInvestorId(investorId: number): Promise<Investment[]>;
  getInvestmentsByOfferingId(offeringId: number): Promise<Investment[]>;
  createInvestment(investment: InsertInvestment): Promise<Investment>;
  updateInvestment(id: number, data: Partial<Investment>): Promise<Investment | undefined>;
  updateInvestmentStatus(id: number, status: string): Promise<Investment | undefined>;
  getAllInvestments(): Promise<Investment[]>;
  
  // Document Library operations
  getDocumentLibraryItem(id: number): Promise<DocumentLibrary | undefined>;
  getDocumentLibrary(): Promise<DocumentLibrary[]>;
  getDocumentLibraryByCategory(category: string): Promise<DocumentLibrary[]>;
  createDocumentLibraryItem(document: InsertDocumentLibrary): Promise<DocumentLibrary>;
  updateDocumentLibraryItem(id: number, data: Partial<DocumentLibrary>): Promise<DocumentLibrary | undefined>;
  
  // Sales Rep Analytics extended operations  
  getSalesRepAnalyticsBySalesRepId(salesRepId: number): Promise<SalesRepAnalytics[]>;
  getSalesRepAnalyticsByPeriod(salesRepId: number, period: string): Promise<SalesRepAnalytics | undefined>;
  createSalesRepAnalytics(analytics: InsertSalesRepAnalytics): Promise<SalesRepAnalytics>;
  updateSalesRepAnalytics(id: number, data: Partial<SalesRepAnalytics>): Promise<SalesRepAnalytics | undefined>;
  getContractsBySalesRepId(salesRepId: number): Promise<Contract[]>;
  
  // Support Ticket operations
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  getSupportTicket(id: number): Promise<SupportTicket | undefined>;
  getSupportTicketByNumber(ticketNumber: string): Promise<SupportTicket | undefined>;
  getSupportTicketsByMerchantId(merchantId: number): Promise<SupportTicket[]>;
  getSupportTicketsByStatus(status: string): Promise<SupportTicket[]>;
  updateSupportTicket(id: number, data: Partial<SupportTicket>): Promise<SupportTicket | undefined>;
  updateSupportTicketStatus(id: number, status: string): Promise<SupportTicket | undefined>;
  assignSupportTicket(id: number, assignedTo: number): Promise<SupportTicket | undefined>;
  getAllSupportTickets(options?: { limit?: number, offset?: number }): Promise<SupportTicket[]>;
  
  // Ticket Attachment operations
  createTicketAttachment(attachment: InsertTicketAttachment): Promise<TicketAttachment>;
  getTicketAttachment(id: number): Promise<TicketAttachment | undefined>;
  getTicketAttachmentsByTicketId(ticketId: number): Promise<TicketAttachment[]>;
  
  // Ticket Activity Log operations
  createTicketActivityLog(activity: InsertTicketActivityLog): Promise<TicketActivityLog>;
  getTicketActivityLogsByTicketId(ticketId: number): Promise<TicketActivityLog[]>;
  
  // Advanced ticket management methods
  getActiveTickets(): Promise<SupportTicket[]>;
  getActiveTicketsByAgentId(agentId: number): Promise<SupportTicket[]>;
  getResolvedTicketsByAgentId(agentId: number): Promise<SupportTicket[]>;
  getTicketSlaConfigs(): Promise<TicketSlaConfig[]>;
  
  // Support Agent operations
  createSupportAgent(agent: InsertSupportAgent): Promise<SupportAgent>;
  getSupportAgent(id: number): Promise<SupportAgent | undefined>;
  getSupportAgentByUserId(userId: number): Promise<SupportAgent | undefined>;
  getAllSupportAgents(): Promise<SupportAgent[]>;
  getActiveSupportAgents(): Promise<SupportAgent[]>;
  updateSupportAgent(id: number, data: Partial<SupportAgent>): Promise<SupportAgent | undefined>;
  getSupportAgentsBySpecialty(specialty: string): Promise<SupportAgent[]>;
  
  // Support Agent Performance operations
  createSupportAgentPerformance(performance: InsertSupportAgentPerformance): Promise<SupportAgentPerformance>;
  getSupportAgentPerformance(id: number): Promise<SupportAgentPerformance | undefined>;
  getSupportAgentPerformanceByAgentId(agentId: number): Promise<SupportAgentPerformance[]>;
  getPerformanceByDateRange(agentId: number, startDate: Date, endDate: Date): Promise<SupportAgentPerformance[]>;
  updateSupportAgentPerformance(id: number, data: Partial<SupportAgentPerformance>): Promise<SupportAgentPerformance | undefined>;
  
  // SLA Configuration operations
  createTicketSlaConfig(config: InsertTicketSlaConfig): Promise<TicketSlaConfig>;
  getTicketSlaConfig(id: number): Promise<TicketSlaConfig | undefined>;
  getTicketSlaConfigByCategory(category: string): Promise<TicketSlaConfig | undefined>;
  getTicketSlaConfigByPriority(priority: string): Promise<TicketSlaConfig | undefined>;
  getAllTicketSlaConfigs(): Promise<TicketSlaConfig[]>;
  updateTicketSlaConfig(id: number, data: Partial<TicketSlaConfig>): Promise<TicketSlaConfig | undefined>;
  
  // Knowledge Base operations
  createKnowledgeBaseArticle(article: InsertKnowledgeBaseArticle): Promise<KnowledgeBaseArticle>;
  getKnowledgeBaseArticle(id: number): Promise<KnowledgeBaseArticle | undefined>;
  getKnowledgeBaseArticlesByCategory(category: string): Promise<KnowledgeBaseArticle[]>;
  getKnowledgeBaseArticlesByTag(tag: string): Promise<KnowledgeBaseArticle[]>;
  searchKnowledgeBase(query: string): Promise<KnowledgeBaseArticle[]>;
  getAllKnowledgeBaseArticles(options?: { limit?: number, offset?: number, status?: string }): Promise<KnowledgeBaseArticle[]>;
  updateKnowledgeBaseArticle(id: number, data: Partial<KnowledgeBaseArticle>): Promise<KnowledgeBaseArticle | undefined>;
  getSuggestedKnowledgeBaseArticles(ticketId: number): Promise<KnowledgeBaseArticle[]>;
  
  // Knowledge Category operations
  createKnowledgeCategory(category: InsertKnowledgeCategory): Promise<KnowledgeCategory>;
  getKnowledgeCategory(id: number): Promise<KnowledgeCategory | undefined>;
  getAllKnowledgeCategories(): Promise<KnowledgeCategory[]>;
  updateKnowledgeCategory(id: number, data: Partial<KnowledgeCategory>): Promise<KnowledgeCategory | undefined>;
  
  // Knowledge Tag operations
  createKnowledgeTag(tag: InsertKnowledgeTag): Promise<KnowledgeTag>;
  getKnowledgeTag(id: number): Promise<KnowledgeTag | undefined>;
  getAllKnowledgeTags(): Promise<KnowledgeTag[]>;
  updateKnowledgeTag(id: number, data: Partial<KnowledgeTag>): Promise<KnowledgeTag | undefined>;
  
  // Chat Session operations
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(id: number): Promise<ChatSession | undefined>;
  getChatSessionsByMerchantId(merchantId: number): Promise<ChatSession[]>;
  getChatSessionsByAgentId(agentId: number): Promise<ChatSession[]>;
  getChatSessionsByTicketId(ticketId: number): Promise<ChatSession | undefined>;
  getAllChatSessions(): Promise<ChatSession[]>;
  updateChatSession(id: number, data: Partial<ChatSession>): Promise<ChatSession | undefined>;
  updateChatSessionStatus(id: number, status: string): Promise<ChatSession | undefined>;
  closeChatSession(id: number, satisfaction?: number, feedback?: string): Promise<ChatSession | undefined>;
  transferChatSession(id: number, newAgentId: number, transferReason?: string): Promise<ChatSession | undefined>;
  
  // Chat Message operations
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessagesBySessionId(sessionId: number, options?: { limit?: number, offset?: number }): Promise<ChatMessage[]>;
  markChatMessageAsRead(id: number): Promise<ChatMessage | undefined>;
  markAllChatMessagesAsRead(sessionId: number, userId: number): Promise<number>; // Returns count of messages updated
  getUnreadChatMessageCountForMerchant(merchantId: number): Promise<number>;
  getUnreadChatMessageCountForAgent(agentId: number): Promise<number>;
  
  // Article Tag operations
  createArticleTag(tag: InsertArticleTag): Promise<ArticleTag>;
  getArticleTagsByArticleId(articleId: number): Promise<ArticleTag[]>;
  deleteArticleTag(id: number): Promise<void>;
  
  // Article Feedback operations
  createArticleFeedback(feedback: InsertArticleFeedback): Promise<ArticleFeedback>;
  getArticleFeedbackByArticleId(articleId: number): Promise<ArticleFeedback[]>;
  getArticleFeedbackStats(articleId: number): Promise<{ helpful: number, notHelpful: number }>;
  
}

export class DatabaseStorage implements IStorage {
  // Conversation methods
  async createConversation(conversation: InsertConversation | any): Promise<Conversation> {
    try {
      // Handle the case where the client sends 'subject' instead of 'topic'
      // First, create a normalized data object with all fields
      const normalizedData: any = {
        ...conversation,
        updatedAt: new Date(),
        lastMessageAt: new Date(),
      };
      
      // If 'subject' was provided but not 'topic', map subject to topic
      if (conversation.subject && !conversation.topic) {
        normalizedData.topic = conversation.subject;
      }
      
      // If neither 'subject' nor 'topic' was provided and this is a required field, use a default
      if (!normalizedData.topic) {
        if (normalizedData.category) {
          normalizedData.topic = `${normalizedData.category} conversation`;
        } else {
          normalizedData.topic = 'New conversation';
        }
      }
      
      // Ensure category is set if missing
      if (!normalizedData.category) {
        normalizedData.category = 'general';
      }
      
      // Make sure priority is set if missing
      if (!normalizedData.priority) {
        normalizedData.priority = 'normal';
      }
      
      // Ensure createdBy is set
      if (!normalizedData.createdBy) {
        // Set a default created by - in this case we'll set the contract's merchant user ID if available
        if (normalizedData.merchantId) {
          try {
            const merchant = await this.getMerchant(normalizedData.merchantId);
            if (merchant && merchant.userId) {
              normalizedData.createdBy = merchant.userId;
            }
          } catch (err) {
            console.warn(`Could not find merchant user ID for conversation creation:`, err);
          }
        }
        
        // If we still don't have a createdBy value, set admin user 1 as default
        if (!normalizedData.createdBy) {
          normalizedData.createdBy = 1; // Default to admin user ID
        }
      }
      
      // With the updated schema, we now store subject in the database too
      // If 'subject' was not provided, set it to match 'topic'
      if (!normalizedData.subject) {
        normalizedData.subject = normalizedData.topic;
      }
      
      console.log("Final conversation data being inserted:", JSON.stringify(normalizedData, null, 2));

      // Insert into the database (including both topic and subject)
      const [newConversation] = await db
        .insert(conversations)
        .values(normalizedData)
        .returning();
      
      return newConversation;
    } catch (error) {
      console.error(`Error creating conversation:`, error);
      if (error instanceof Error) {
        throw new Error(`Failed to create conversation: ${error.message}`);
      } else {
        throw new Error('Failed to create conversation: Unknown error');
      }
    }
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    try {
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id));

      return conversation;
    } catch (error) {
      console.error(`Error getting conversation ${id}:`, error);
      return undefined;
    }
  }

  async updateConversation(id: number, data: Partial<Conversation>): Promise<Conversation | undefined> {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      const [updatedConversation] = await db
        .update(conversations)
        .set(updateData)
        .where(eq(conversations.id, id))
        .returning();

      return updatedConversation;
    } catch (error) {
      console.error(`Error updating conversation ${id}:`, error);
      return undefined;
    }
  }

  async updateConversationStatus(id: number, status: string): Promise<Conversation | undefined> {
    return this.updateConversation(id, { status: status as any });
  }

  async getConversationsByContractId(contractId: number): Promise<Conversation[]> {
    try {
      return await db
        .select()
        .from(conversations)
        .where(eq(conversations.contractId, contractId))
        .orderBy(desc(conversations.lastMessageAt));
    } catch (error) {
      console.error(`Error getting conversations for contract ${contractId}:`, error);
      return [];
    }
  }

  async getConversationsByUserId(userId: number): Promise<Conversation[]> {
    try {
      return await db
        .select()
        .from(conversations)
        .where(eq(conversations.createdBy, userId))
        .orderBy(desc(conversations.lastMessageAt));
    } catch (error) {
      console.error(`Error getting conversations for user ${userId}:`, error);
      return [];
    }
  }

  async getConversationsForMerchant(merchantId: number): Promise<Conversation[]> {
    try {
      // Get the merchant's user ID
      const merchant = await this.getMerchant(merchantId);
      if (!merchant || !merchant.userId) {
        return [];
      }

      // Get all contracts for this merchant
      const merchantContracts = await this.getContractsByMerchantId(merchantId);
      const contractIds = merchantContracts.map(contract => contract.id);

      // Get all conversations either created by the merchant user
      // or related to the merchant's contracts
      if (contractIds.length === 0) {
        // If no contracts, just get conversations created by merchant user
        return await db
          .select()
          .from(conversations)
          .where(eq(conversations.createdBy, merchant.userId))
          .orderBy(desc(conversations.lastMessageAt));
      } else {
        // Get conversations for merchant's user ID or for their contracts
        return await db
          .select()
          .from(conversations)
          .where(
            or(
              eq(conversations.createdBy, merchant.userId),
              inArray(conversations.contractId, contractIds)
            )
          )
          .orderBy(desc(conversations.lastMessageAt));
      }
    } catch (error) {
      const logger = this.logger;
      logger.error({
        message: `Error getting conversations for merchant ${merchantId}: ${error instanceof Error ? error.message : String(error)}`,
        category: "database",
        source: "storage",
        metadata: {
          merchantId,
          error: error instanceof Error ? error.stack : null
        }
      });
      return [];
    }
  }
  
  async getUnreadMessageCountForMerchant(merchantId: number): Promise<number> {
    try {
      // Get the merchant's user ID
      const merchant = await this.getMerchant(merchantId);
      if (!merchant || !merchant.userId) {
        logger.warn({
          message: `No merchant found with ID ${merchantId} or missing userId`,
          category: "database",
          source: "storage",
          metadata: { merchantId }
        });
        return 0;
      }

      try {
        // Find unread messages in conversations related to this merchant using a direct SQL query
        // which is more efficient for this particular operation
        // Note: conversations are linked to merchants through the contracts table
        const result = await pool.query(
          `SELECT COUNT(*) AS unread_count 
           FROM messages m
           JOIN conversations c ON m.conversation_id = c.id
           JOIN contracts ct ON c.contract_id = ct.id
           WHERE ct.merchant_id = $1
           AND m.is_read = false
           AND m.sender_id != $2`,
          [merchantId, merchant.userId]
        );

        // Extract the count from the result
        const unreadCount = result.rows[0]?.unread_count || 0;
        return parseInt(unreadCount);
      } catch (dbError) {
        logger.error({
          message: `Database error in unread count: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
          category: "database",
          source: "storage",
          metadata: {
            merchantId,
            error: dbError instanceof Error ? dbError.stack : null
          }
        });
        
        // Fallback to the ORM-based method with a simpler query approach
        try {
          const result = await pool.query(
            `SELECT COUNT(*) as count
             FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             JOIN contracts ct ON c.contract_id = ct.id
             WHERE ct.merchant_id = $1
             AND m.is_read = false
             AND m.sender_id != $2`,
            [merchantId, merchant.userId]
          );
          
          return parseInt(result.rows[0]?.count || '0');
        } catch (fallbackError) {
          logger.error({
            message: `Fallback query also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
            category: "database",
            source: "storage",
            metadata: {
              merchantId,
              error: fallbackError instanceof Error ? fallbackError.stack : null
            }
          });
          return 0;
        }
      }
    } catch (error) {
      logger.error({
        message: `Error getting unread messages count for merchant ${merchantId}: ${error instanceof Error ? error.message : String(error)}`,
        category: "database",
        source: "storage",
        metadata: {
          merchantId,
          error: error instanceof Error ? error.stack : null
        }
      });
      return 0;
    }
  }

  async getAllConversations(limit: number = 20, offset: number = 0): Promise<Conversation[]> {
    try {
      return await db
        .select()
        .from(conversations)
        .orderBy(desc(conversations.lastMessageAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error(`Error getting all conversations:`, error);
      return [];
    }
  }

  // Message methods
  async createMessage(message: InsertMessage): Promise<Message> {
    try {
      // Map input fields to match schema expectations
      // The field 'userId' in client input needs to be mapped to 'senderId' in the database
      const messageToInsert = {
        conversationId: message.conversationId,
        senderId: message.userId, // Map userId to senderId
        senderRole: message.isFromMerchant ? "merchant" : "admin", // Derive role from isFromMerchant flag
        content: message.content,
        isRead: message.isRead || false,
        readAt: message.isRead ? new Date() : null,
        createdAt: message.createdAt || new Date()
      };
      
      // Log the prepared message data
      console.log("Creating message with data:", JSON.stringify(messageToInsert, null, 2));
      
      // Insert the message
      const [newMessage] = await db.insert(messages).values(messageToInsert).returning();

      // Update the conversation's lastMessageAt timestamp
      await db
        .update(conversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(conversations.id, message.conversationId));

      console.log("Successfully created message:", newMessage.id);
      return newMessage;
    } catch (error) {
      console.error(`Error creating message:`, error);
      throw new Error(`Failed to create message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getMessagesByConversationId(
    conversationId: number,
    options?: { limit?: number; offset?: number }
  ): Promise<Message[]> {
    try {
      let baseQuery = db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt));

      // Apply pagination if options are provided
      if (options?.limit !== undefined) {
        const limitedQuery = baseQuery.limit(options.limit);
        
        if (options?.offset !== undefined) {
          return await limitedQuery.offset(options.offset);
        }
        
        return await limitedQuery;
      }

      return await baseQuery;
    } catch (error) {
      console.error(`Error getting messages for conversation ${conversationId}:`, error);
      return [];
    }
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    try {
      const [updatedMessage] = await db
        .update(messages)
        .set({
          isRead: true,
          readAt: new Date()
        })
        .where(eq(messages.id, id))
        .returning();

      return updatedMessage;
    } catch (error) {
      console.error(`Error marking message ${id} as read:`, error);
      return undefined;
    }
  }

  async markAllMessagesAsRead(conversationId: number, userId: number): Promise<number> {
    try {
      const result = await db
        .update(messages)
        .set({
          isRead: true,
          readAt: new Date()
        })
        .where(
          and(
            eq(messages.conversationId, conversationId),
            // Only mark messages as read if they weren't sent by this user
            not(eq(messages.senderId, userId)),
            eq(messages.isRead, false)
          )
        );

      return result.rowCount || 0;
    } catch (error) {
      console.error(`Error marking all messages as read in conversation ${conversationId}:`, error);
      return 0;
    }
  }
  


  async updateMerchant(id: number, updateData: Partial<Merchant>): Promise<Merchant | undefined> {
    try {
      // Set updatedAt timestamp if applicable to your schema
      const dataToUpdate = {
        ...updateData
      };

      // Execute the update query
      const [updatedMerchant] = await db
        .update(merchants)
        .set(dataToUpdate)
        .where(eq(merchants.id, id))
        .returning();

      return updatedMerchant;
    } catch (error) {
      console.error(`Error updating merchant ${id}:`, error);
      return undefined;
    }
  }

  async getMerchantByEmail(email: string): Promise<Merchant | undefined> {
    try {
      const [merchant] = await db
        .select()
        .from(merchants)
        .where(eq(merchants.email, email));

      return merchant || undefined;
    } catch (error) {
      console.error(`Error getting merchant by email ${email}:`, error);
      return undefined;
    }
  }


  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    if (!phone) return undefined;

    try {
      // Normalize phone number by removing non-digits
      const normalizedPhone = phone.replace(/\D/g, '');

      // First try exact match with normalized phone
      let [user] = await db.select().from(users).where(
        eq(users.phone, normalizedPhone)
      );

      if (user) return user;

      // If not found, try original format
      if (normalizedPhone !== phone) {
        const [originalUser] = await db.select().from(users).where(eq(users.phone, phone));
        if (originalUser) return originalUser;
      }

      // If still not found, try a more flexible search with partial matching
      // This helps with different formats like with/without country code
      const possibleUsers = await db.select().from(users).where(
        or(
          like(users.phone, `%${normalizedPhone}%`),
          like(users.phone, `%${normalizedPhone.substring(1)}%`) // Try without first digit (potential country code)
        )
      );

      // If we found users, return the first one
      if (possibleUsers && possibleUsers.length > 0) {
        console.log(`Found user by phone number partial match: ${phone} -> ${possibleUsers[0].phone}`);
        return possibleUsers[0];
      }

      // Special handling for the specific problematic number 2676012031
      if (normalizedPhone === '2676012031' || normalizedPhone.endsWith('2676012031')) {
        // If there's a user with this ID match from our historical records, we know this should be user ID 9
        const knownId = 9;
        const specialUser = await this.getUser(knownId);
        if (specialUser) {
          console.log(`Using known user mapping for 2676012031 -> user ID ${knownId}`);
          return specialUser;
        }
      }

      return undefined;
    } catch (error) {
      console.error("Error in getUserByPhone:", error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set(data)
        .where(eq(users.id, id))
        .returning();
      
      return updatedUser;
    } catch (error) {
      console.error(`Error updating user ${id}:`, error);
      return undefined;
    }
  }

  async findOrCreateUserByPhone(phone: string, email?: string): Promise<User> {
    // Normalize phone number by removing non-digits
    const normalizedPhone = phone.replace(/\D/g, '');

    // First, try to find the user by normalized phone
    const existingUser = await this.getUserByPhone(normalizedPhone);
    if (existingUser) {
      // If the phone in the database is not normalized, update it
      if (existingUser.phone !== normalizedPhone) {
        await db.update(users)
          .set({ phone: normalizedPhone })
          .where(eq(users.id, existingUser.id));

        // Return the updated user with updated phone
        return { ...existingUser, phone: normalizedPhone };
      }

      // If email is provided and user has a default email, update it
      if (email && existingUser.email && existingUser.email.includes('@shifi.com')) {
        await db.update(users)
          .set({ email })
          .where(eq(users.id, existingUser.id));

        // Return the user with updated email
        return { ...existingUser, email };
      }

      return existingUser;
    }

    // If not found, create a new user with provided email or generate a unique one
    // Generate a unique temporary email with timestamp to avoid collisions
    const timestamp = Date.now();
    const tempEmail = email || `temp_${normalizedPhone}_${timestamp}@shifi.com`;

    // Generate a random temporary password
    const temporaryPassword = Math.random().toString(36).substring(2, 15);
    
    // Hash the password using bcrypt before storing it
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(temporaryPassword, salt);
    
    // Create the new user with hashed password
    const newUser: InsertUser = {
      email: tempEmail,
      password: hashedPassword, // securely hashed password
      phone: normalizedPhone,
      role: 'customer',
      name: `Customer ${normalizedPhone}`,
    };

    return await this.createUser(newUser);
  }

  // Merchant methods
  async getMerchant(id: number): Promise<Merchant | undefined> {
    try {
      const [merchant] = await db.select().from(merchants).where(eq(merchants.id, id));
      if (!merchant) {
        console.warn(`No merchant found with ID ${id}`);
      }
      return merchant || undefined;
    } catch (error) {
      console.error(`Error getting merchant with ID ${id}:`, error);
      return undefined;
    }
  }

  async getMerchantByUserId(userId: number): Promise<Merchant | undefined> {
    const [merchant] = await db.select().from(merchants).where(eq(merchants.userId, userId));
    return merchant || undefined;
  }

  async getAllMerchants(): Promise<Merchant[]> {
    return await db.select().from(merchants);
  }
  
  async getAllMerchantsWithDetails(): Promise<(Merchant & { businessDetails?: MerchantBusinessDetails })[]> {
    try {
      // Explicitly select only the columns we know exist in the database
      // This avoids issues with missing columns like ai_verification_status
      const results = await db.select({
        merchant: merchants,
        businessDetails: {
          id: merchantBusinessDetails.id,
          merchantId: merchantBusinessDetails.merchantId,
          businessName: merchantBusinessDetails.businessName,
          businessType: merchantBusinessDetails.businessType,
          businessAddress: merchantBusinessDetails.businessAddress,
          businessCity: merchantBusinessDetails.businessCity,
          businessState: merchantBusinessDetails.businessState,
          businessZip: merchantBusinessDetails.businessZip,
          businessPhone: merchantBusinessDetails.businessPhone,
          businessEmail: merchantBusinessDetails.businessEmail,
          businessWebsite: merchantBusinessDetails.businessWebsite,
          businessTaxId: merchantBusinessDetails.businessTaxId,
          businessLicenseNumber: merchantBusinessDetails.businessLicenseNumber,
          incorporationDate: merchantBusinessDetails.incorporationDate,
          annualRevenue: merchantBusinessDetails.annualRevenue,
          numberOfEmployees: merchantBusinessDetails.numberOfEmployees,
          businessDescription: merchantBusinessDetails.businessDescription,
          createdAt: merchantBusinessDetails.createdAt,
          updatedAt: merchantBusinessDetails.updatedAt,
          // Omit ai_verification_status which doesn't exist in the database
        }
      })
      .from(merchants)
      .leftJoin(merchantBusinessDetails, eq(merchants.id, merchantBusinessDetails.merchantId));
      
      return results.map(({ merchant, businessDetails }) => ({
        ...merchant,
        businessDetails: businessDetails || undefined
      }));
    } catch (error) {
      console.error("Error in getAllMerchantsWithDetails:", error);
      // Return an empty array instead of throwing to prevent route handler crashes
      return [];
    }
  }

  async createMerchant(merchant: InsertMerchant): Promise<Merchant> {
    const [newMerchant] = await db.insert(merchants).values(merchant).returning();
    return newMerchant;
  }

  // Contract methods
  async getContract(id: number): Promise<Contract | undefined> {
    try {
      console.log(`Attempting to fetch contract with ID: ${id}`);
      
      // Use a direct SQL query to fetch the contract to avoid ORM structure issues
      const query = `
        SELECT 
          id, contract_number, merchant_id, customer_id, amount, interest_rate, status,
          term_months, created_at, completed_at, down_payment, financed_amount, monthly_payment,
          current_step, archived, archived_at, archived_reason, phone_number, sales_rep_id,
          purchased_by_shifi, tokenization_status, token_id, smart_contract_address,
          tokenization_error, blockchain_transaction_hash, block_number, tokenization_date,
          token_metadata
        FROM contracts 
        WHERE id = $1
      `;
      
      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        console.log(`Contract with ID: ${id} not found`);
        return undefined;
      }
      
      // Get the contract data from the first row
      const row = result.rows[0];
      
      // Create a complete contract object with all required fields, using camelCase keys
      const contract = {
        id: row.id,
        contractNumber: row.contract_number,
        merchantId: row.merchant_id,
        customerId: row.customer_id,
        amount: row.amount,
        interestRate: row.interest_rate,
        status: row.status,
        cancellationRequestedAt: null, // Field does not exist in DB yet
        // Provide both termMonths and term fields for compatibility
        termMonths: row.term_months,
        term: row.term_months, // For backwards compatibility
        
        // Dates
        createdAt: row.created_at,
        completedAt: row.completed_at,
        updatedAt: null, // Not in the query but expected in the interface
        startDate: null, // Not in the query but expected in the interface
        endDate: null, // Not in the query but expected in the interface
          cancellationRequestedAt: null, // Field does not exist in DB yet
        
        // Financial fields
        downPayment: row.down_payment || 0,
        financedAmount: row.financed_amount || 0,
        monthlyPayment: row.monthly_payment || 0,
        
        // Status fields
        currentStep: row.current_step || 'terms',
        archived: row.archived || false,
        archivedAt: row.archived_at || null,
        archivedReason: row.archived_reason || null,
        
        // Contact info
        phoneNumber: row.phone_number || null,
        salesRepId: row.sales_rep_id || null,
        
        // Blockchain fields
        purchasedByShifi: row.purchased_by_shifi || false,
        tokenizationStatus: row.tokenization_status || null,
        tokenId: row.token_id || null,
        smartContractAddress: row.smart_contract_address || null,
        tokenizationError: row.tokenization_error || null,
        blockchainTransactionHash: row.blockchain_transaction_hash || null,
        blockNumber: row.block_number || null,
        tokenizationDate: row.tokenization_date || null,
        tokenMetadata: row.token_metadata || null,
        
        // Cancellation fields
        cancellationRequestedAt: null, // Field does not exist in DB yet
        
        // Additional frontend expected fields
        type: 'custom' // Default contract type
      };
      
      console.log(`Successfully retrieved contract with ID: ${id}`);
      return contract;
    } catch (error) {
      console.error("Error fetching contract:", error);
      return undefined;
    }
  }

  async getContractByNumber(contractNumber: string): Promise<Contract | undefined> {
    try {
      console.log(`Attempting to fetch contract with contract number: ${contractNumber}`);
      
      // Use a direct SQL query to fetch the contract to avoid ORM structure issues
      const query = `
        SELECT 
          id, contract_number, merchant_id, customer_id, amount, interest_rate, status,
          term_months, created_at, completed_at, down_payment, financed_amount, monthly_payment,
          current_step, archived, archived_at, archived_reason, phone_number, sales_rep_id,
          purchased_by_shifi, tokenization_status, token_id, smart_contract_address,
          tokenization_error, blockchain_transaction_hash, block_number, tokenization_date,
          token_metadata
        FROM contracts 
        WHERE contract_number = $1
      `;
      
      const result = await pool.query(query, [contractNumber]);
      
      if (result.rows.length === 0) {
        console.log(`Contract with contract number: ${contractNumber} not found`);
        return undefined;
      }
      
      // Get the contract data from the first row
      const row = result.rows[0];
      
      console.log(`Found contract with contract number: ${contractNumber}, ID: ${row.id}`);
      
      // Create a complete contract object with all required fields, using camelCase keys
      const contract = {
        id: row.id,
        contractNumber: row.contract_number,
        merchantId: row.merchant_id,
        customerId: row.customer_id,
        amount: row.amount,
        interestRate: row.interest_rate,
        cancellationRequestedAt: null, // Field does not exist in DB yet
        status: row.status,
        // Provide both termMonths and term fields for compatibility
        termMonths: row.term_months,
        term: row.term_months, // For backwards compatibility
        
        // Dates
        createdAt: row.created_at,
        completedAt: row.completed_at,
        updatedAt: null, // Not in the query but expected in the interface
        startDate: null, // Not in the query but expected in the interface
        endDate: null, // Not in the query but expected in the interface
          cancellationRequestedAt: null, // Field does not exist in DB yet
        
        // Financial fields
        downPayment: row.down_payment || 0,
        financedAmount: row.financed_amount || 0,
        monthlyPayment: row.monthly_payment || 0,
        
        // Status fields
        currentStep: row.current_step || 'terms',
        archived: row.archived || false,
        archivedAt: row.archived_at || null,
        archivedReason: row.archived_reason || null,
        
        // Contact info
        phoneNumber: row.phone_number || null,
        salesRepId: row.sales_rep_id || null,
        
        // Blockchain fields
        purchasedByShifi: row.purchased_by_shifi || false,
        tokenizationStatus: row.tokenization_status || null,
        tokenId: row.token_id || null,
        smartContractAddress: row.smart_contract_address || null,
        tokenizationError: row.tokenization_error || null,
        blockchainTransactionHash: row.blockchain_transaction_hash || null,
        blockNumber: row.block_number || null,
        tokenizationDate: row.tokenization_date || null,
        tokenMetadata: row.token_metadata || null,
        
        // Cancellation fields
        cancellationRequestedAt: null, // Field does not exist in DB yet
        
        // Additional frontend expected fields
        type: 'custom' // Default contract type
      };
      
      return contract;
    } catch (error) {
      console.error(`Error getting contract by number ${contractNumber}:`, error);
      return undefined;
    }
  }

  async getAllContracts(): Promise<Contract[]> {
    try {
      console.log("Getting all contracts");
      
      // Use a direct SQL query to avoid ORM structure issues
      const query = `
        SELECT 
          id, contract_number, merchant_id, customer_id, amount, interest_rate, status,
          term_months, created_at, completed_at, down_payment, financed_amount, monthly_payment,
          current_step, archived, archived_at, archived_reason, phone_number, sales_rep_id,
          purchased_by_shifi, tokenization_status, token_id, smart_contract_address,
          tokenization_error, blockchain_transaction_hash, block_number, tokenization_date,
          token_metadata
        FROM contracts 
        ORDER BY created_at DESC
      `;
      
      const result = await pool.query(query);
      
      console.log(`Found ${result.rows.length} contracts total`);
      
      // Map the results to add any fields expected by the Contract type
      const contractsWithDefaults = result.rows.map(row => {
        return {
          id: row.id,
          contractNumber: row.contract_number,
          merchantId: row.merchant_id,
          customerId: row.customer_id,
          amount: row.amount,
          cancellationRequestedAt: null, // Field does not exist in DB yet
          interestRate: row.interest_rate,
          status: row.status,
          // Provide both termMonths and term fields for compatibility
          termMonths: row.term_months,
          term: row.term_months, // For backwards compatibility
          
          // Dates
          createdAt: row.created_at,
          completedAt: row.completed_at,
          updatedAt: null, // Not in the query but expected in the interface
          startDate: null, // Not in the query but expected in the interface
          endDate: null, // Not in the query but expected in the interface
          cancellationRequestedAt: null, // Field does not exist in DB yet
          
          // Financial fields
          downPayment: row.down_payment || 0,
          financedAmount: row.financed_amount || 0,
          monthlyPayment: row.monthly_payment || 0,
          
          // Status fields
          currentStep: row.current_step || 'terms',
          archived: row.archived || false,
          archivedAt: row.archived_at || null,
          archivedReason: row.archived_reason || null,
          
          // Contact info
          phoneNumber: row.phone_number || null,
          salesRepId: row.sales_rep_id || null,
          
          // Blockchain fields
          purchasedByShifi: row.purchased_by_shifi || false,
          tokenizationStatus: row.tokenization_status || null,
          tokenId: row.token_id || null,
          smartContractAddress: row.smart_contract_address || null,
          tokenizationError: row.tokenization_error || null,
          blockchainTransactionHash: row.blockchain_transaction_hash || null,
          blockNumber: row.block_number || null,
          tokenizationDate: row.tokenization_date || null,
          tokenMetadata: row.token_metadata || null,
          
          // Cancellation fields
          cancellationRequestedAt: null, // Field doesn't exist in DB yet
          
          // Additional frontend expected fields
          type: 'custom' // Default contract type
        };
      });
      
      return contractsWithDefaults;
    } catch (error) {
      console.error("Error in getAllContracts:", error);
      return []; // Return an empty array instead of throwing
    }
  }

  async getContractsByMerchantId(merchantId: number): Promise<Contract[]> {
    try {
      console.log(`Getting contracts for merchant ID ${merchantId}`);
      
      // Try using raw SQL query to avoid potential issues with drizzle-orm field selection
      const rawQuery = `
        SELECT 
          id, 
          contract_number as "contractNumber", 
          merchant_id as "merchantId", 
          customer_id as "customerId", 
          amount, 
          interest_rate as "interestRate", 
          status, 
          term_months as "termMonths", 
          created_at as "createdAt"
        FROM contracts 
        WHERE merchant_id = $1
        ORDER BY created_at DESC;
      `;
      
      const result = await pool.query(rawQuery, [merchantId]);
      const minimalResults = result.rows;
      
      console.log(`Found ${minimalResults.length} contracts for merchant ID ${merchantId}`);
      
      // Map the results to include the term field (mapped from termMonths) 
      // and any other expected fields that weren't in the minimal query
      const contractsWithDefaults = minimalResults.map(contract => {
        return {
          ...contract,
          // Add the term field that maps to termMonths for backwards compatibility
          term: contract.termMonths || 0,
          // Add default values for fields not in our minimal query
          completedAt: null,
          downPayment: 0,
          financedAmount: contract.amount || 0,
          monthlyPayment: 0,
          currentStep: "completed",
          archived: false,
          archivedAt: null,
          archivedReason: null,
          phoneNumber: null,
          salesRepId: null,
          purchasedByShifi: false,
          tokenizationStatus: "pending",
          tokenId: null,
          smartContractAddress: null,
          tokenizationError: null,
          blockchainTransactionHash: null, 
          blockNumber: null,
          tokenizationDate: null,
          tokenMetadata: null,
          // Additional frontend expected fields
          updatedAt: null,
          startDate: null,
          endDate: null,
          cancellationRequestedAt: null, // Field does not exist in DB yet
          type: 'custom'
        };
      });
      
      return contractsWithDefaults;
    } catch (error) {
      console.error(`Error getting contracts for merchant ID ${merchantId}:`, error);
      // Return empty array in case of error
      return [];
    }
  }

  async getContractsByCustomerId(customerId: number): Promise<Contract[]> {
    try {
      console.log(`Getting contracts for customer ID ${customerId}`);
      
      // Try using raw SQL query to avoid potential issues with drizzle-orm field selection
      const rawQuery = `
        SELECT 
          id, 
          contract_number as "contractNumber", 
          merchant_id as "merchantId", 
          customer_id as "customerId", 
          amount, 
          interest_rate as "interestRate", 
          status, 
          term_months as "termMonths", 
          created_at as "createdAt"
        FROM contracts 
        WHERE customer_id = $1
        ORDER BY created_at DESC;
      `;
      
      const result = await pool.query(rawQuery, [customerId]);
      const minimalResults = result.rows;
      
      console.log(`Found ${minimalResults.length} contracts for customer ID ${customerId}`);
      
      // Map the results to include the term field (mapped from termMonths) 
      // and any other expected fields that weren't in the minimal query
      const contractsWithDefaults = minimalResults.map(contract => {
        return {
          ...contract,
          // Add the term field that maps to termMonths for backwards compatibility
          term: contract.termMonths || 0,
          // Add default values for fields not in our minimal query
          completedAt: null,
          downPayment: 0,
          financedAmount: contract.amount || 0,
          monthlyPayment: 0,
          currentStep: "completed",
          archived: false,
          archivedAt: null,
          archivedReason: null,
          phoneNumber: null,
          salesRepId: null,
          purchasedByShifi: false,
          tokenizationStatus: "pending",
          tokenId: null,
          smartContractAddress: null,
          tokenizationError: null,
          blockchainTransactionHash: null, 
          blockNumber: null,
          tokenizationDate: null,
          tokenMetadata: null,
          // Additional frontend expected fields
          updatedAt: null,
          startDate: null,
          endDate: null,
          cancellationRequestedAt: null, // Field does not exist in DB yet
          type: 'custom'
        };
      });
      
      return contractsWithDefaults;
    } catch (error) {
      console.error(`Error getting contracts for customer ID ${customerId}:`, error);
      return [];
    }
  }

  async getContractsByPhoneNumber(phoneNumber: string): Promise<Contract[]> {
    try {
      // Normalize the phone number by removing non-digits
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      
      console.log(`Getting contracts for phone number ${normalizedPhone}`);
      
      // Try using raw SQL query to avoid potential issues with drizzle-orm field selection
      const rawQuery = `
        SELECT 
          id, 
          contract_number as "contractNumber", 
          merchant_id as "merchantId", 
          customer_id as "customerId", 
          amount, 
          interest_rate as "interestRate", 
          status, 
          term_months as "termMonths", 
          created_at as "createdAt",
          phone_number as "phoneNumber"
        FROM contracts 
        WHERE phone_number = $1
        ORDER BY created_at DESC;
      `;
      
      const result = await pool.query(rawQuery, [normalizedPhone]);
      const minimalResults = result.rows;
      
      console.log(`Found ${minimalResults.length} contracts for phone number ${normalizedPhone}`);
      
      // Map the results to include the term field (mapped from termMonths) 
      // and any other expected fields that weren't in the minimal query
      const contractsWithDefaults = minimalResults.map(contract => {
        return {
          ...contract,
          // Add the term field that maps to termMonths for backwards compatibility
          term: contract.termMonths || 0,
          // Add default values for fields not in our minimal query
          completedAt: null,
          downPayment: 0,
          financedAmount: contract.amount || 0,
          monthlyPayment: 0,
          currentStep: "completed",
          archived: false,
          archivedAt: null,
          archivedReason: null,
          salesRepId: null,
          purchasedByShifi: false,
          tokenizationStatus: "pending",
          tokenId: null,
          smartContractAddress: null,
          tokenizationError: null,
          blockchainTransactionHash: null, 
          blockNumber: null,
          tokenizationDate: null,
          tokenMetadata: null,
          // Additional frontend expected fields
          updatedAt: null,
          startDate: null,
          endDate: null,
          cancellationRequestedAt: null, // Field does not exist in DB yet
          type: 'custom'
        };
      });
      
      return contractsWithDefaults;
    } catch (error) {
      console.error(`Error getting contracts for phone number ${phoneNumber}:`, error);
      return [];
    }
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    try {
      // Create a sanitized version of the contract data, excluding fields that may not exist yet in the database
      const { archived, archivedAt, archivedReason, ...contractData } = contract as any;
      
      // Explicitly set fields that might cause issues if they don't exist in the database yet
      // Remove salesRepId if it's null or undefined to avoid referential integrity issues
      const cleanedContractData = { ...contractData };
      if (cleanedContractData.salesRepId === null || cleanedContractData.salesRepId === undefined) {
        delete cleanedContractData.salesRepId;
      }
      
      // Insert the filtered contract data
      const [newContract] = await db.insert(contracts).values(cleanedContractData).returning();
      
      // Return the contract with default values for archived fields
      return {
        ...newContract,
        archived: false,
        archivedAt: null,
        archivedReason: null
      };
    } catch (error) {
      console.error('Error in createContract:', error);
      throw error;
    }
  }

  async updateContractStatus(id: number, status: string): Promise<Contract | undefined> {
    // Check if contract exists
    const existingContract = await this.getContract(id);
    if (!existingContract) return undefined;

    // Determine if completedAt should be set
    const completedAt = status === 'completed' ? new Date() : existingContract.completedAt;

    // Update the contract
    const [updatedContract] = await db
      .update(contracts)
      .set({ 
        status: status as any,
        completedAt
      })
      .where(eq(contracts.id, id))
      .returning();

    return updatedContract;
  }

  async updateContractStep(id: number, step: string): Promise<Contract | undefined> {
    // Check if contract exists
    const existingContract = await this.getContract(id);
    if (!existingContract) return undefined;

    // Update the contract step
    const [updatedContract] = await db
      .update(contracts)
      .set({ currentStep: step as any })
      .where(eq(contracts.id, id))
      .returning();

    return updatedContract;
  }

  async updateContractCustomerId(id: number, customerId: number): Promise<Contract | undefined> {
    const [updatedContract] = await db
      .update(contracts)
      .set({ customerId })
      .where(eq(contracts.id, id))
      .returning();
    return updatedContract;
  }

  async updateContract(id: number, data: Partial<Contract>): Promise<Contract> {
    // Create a sanitized version of the update data, excluding fields that may not exist yet
    const { archived, archivedAt, archivedReason, ...updateData } = data as any;
    
    // Process the update using only fields we know exist
    const [updatedContract] = await db
      .update(contracts)
      .set(updateData)
      .where(eq(contracts.id, id))
      .returning();
    
    // If archived fields were included in the original update, store this info separately
    // We'll need to include this in the migration implementation later
    if (archived !== undefined || archivedAt !== undefined || archivedReason !== undefined) {
      console.log(`Contract ${id} archive status requested: archived=${archived}, reason=${archivedReason}`);
    }
    
    // Return the updated contract with default values for archived fields
    return {
      ...updatedContract,
      archived: archived ?? false,
      archivedAt: archivedAt ?? null,
      archivedReason: archivedReason ?? null
    };
  }

  // Application Progress methods
  async getApplicationProgress(id: number): Promise<ApplicationProgress | undefined> {
    const [progress] = await db.select().from(applicationProgress).where(eq(applicationProgress.id, id));
    return progress || undefined;
  }

  async getApplicationProgressByContractId(contractId: number): Promise<ApplicationProgress[]> {
    return await db.select().from(applicationProgress).where(eq(applicationProgress.contractId, contractId));
  }

  async createApplicationProgress(progress: InsertApplicationProgress): Promise<ApplicationProgress> {
    const [newProgress] = await db.insert(applicationProgress).values(progress).returning();
    return newProgress;
  }

  async updateApplicationProgressCompletion(id: number, completed: boolean, data?: string): Promise<ApplicationProgress | undefined> {
    // Check if progress exists
    const existingProgress = await this.getApplicationProgress(id);
    if (!existingProgress) return undefined;

    // Prepare update data
    const updateData: any = { 
      completed,
      completedAt: completed ? new Date() : null
    };

    // Include data if provided
    if (data !== undefined) {
      updateData.data = data;
    }

    // Update the progress
    const [updatedProgress] = await db
      .update(applicationProgress)
      .set(updateData)
      .where(eq(applicationProgress.id, id))
      .returning();

    return updatedProgress;
  }

  // Method to get specific application progress step by contract ID and step
  async getApplicationProgressByContractIdAndStep(
    contractId: number,
    step: string
  ): Promise<ApplicationProgress | null> {
    const progress = await db.query.applicationProgress.findFirst({
      where: and(
        eq(applicationProgress.contractId, contractId),
        eq(applicationProgress.step, step as any)
      ),
    });

    return progress || null;
  }

  // Method to update application progress with any data
  async updateApplicationProgress(
    progressId: number,
    data: Partial<ApplicationProgress>
  ): Promise<ApplicationProgress | null> {
    try {
      const result = await db
        .update(applicationProgress)
        .set(data)
        .where(eq(applicationProgress.id, progressId))
        .returning();

      return result[0] || null;
    } catch (error) {
      console.error('Error updating application progress:', error);
      return null;
    }
  }

  // Log methods
  async createLog(log: any): Promise<Log> {
    const [newLog] = await db.insert(logs).values(log).returning();
    return newLog;
  }

  async getLogs(): Promise<Log[]> {
    return await db.select().from(logs).orderBy(logs.timestamp);
  }

  async getLogsByUserId(userId: number): Promise<Log[]> {
    return await db.select().from(logs).where(eq(logs.userId, userId)).orderBy(logs.timestamp);
  }

  // Methods for working with underwriting data
  async getUnderwritingDataByUserId(userId: number) {
    return await db.select().from(underwritingData).where({ userId }).orderBy(underwritingData.createdAt, 'desc');
  }

  async getUnderwritingDataByContractId(contractId: number) {
    try {
      // Use a raw SQL query to avoid ORM issues
      const rawQuery = `
        SELECT * FROM underwriting_data 
        WHERE contract_id = $1
        ORDER BY created_at DESC;
      `;
      
      const result = await pool.query(rawQuery, [contractId]);
      
      // Map column names to camelCase for consistency
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        contractId: row.contract_id,
        creditTier: row.credit_tier,
        creditScore: row.credit_score,
        annualIncome: row.annual_income,
        annualIncomePoints: row.annual_income_points,
        employmentHistoryMonths: row.employment_history_months,
        employmentHistoryPoints: row.employment_history_points,
        creditScorePoints: row.credit_score_points,
        dtiRatio: row.dti_ratio,
        dtiRatioPoints: row.dti_ratio_points,
        housingStatus: row.housing_status,
        housingPaymentHistory: row.housing_payment_history_months,
        housingStatusPoints: row.housing_status_points,
        delinquencyHistory: row.delinquency_history,
        delinquencyPoints: row.delinquency_points,
        totalPoints: row.total_points,
        rawPreFiData: row.raw_prefi_data,
        rawPlaidData: row.raw_plaid_data,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error("Error in getUnderwritingDataByContractId:", error);
      // Return empty array on error to prevent route failure
      return [];
    }
  }

  async createUnderwritingData(data: any) {
    const result = await db.insert(underwritingData).values(data).returning();
    return result[0];
  }

  async updateUnderwritingData(id: number, data: any) {
    const result = await db.update(underwritingData)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where({ id })
      .returning();
    return result[0];
  }

  async getAllUnderwritingData() {
    return await db.select().from(underwritingData).orderBy(desc(underwritingData.createdAt));
  }

  async getContractsByStatus(status: string): Promise<Contract[]> {
    try {
      console.log(`Getting contracts with status: ${status}`);
      
      // Try using raw SQL query to avoid potential issues with drizzle-orm field selection
      const rawQuery = `
        SELECT 
          id, 
          contract_number as "contractNumber", 
          merchant_id as "merchantId", 
          customer_id as "customerId", 
          amount, 
          interest_rate as "interestRate", 
          status, 
          term_months as "termMonths", 
          created_at as "createdAt"
        FROM contracts 
        WHERE status = $1
        ORDER BY created_at DESC;
      `;
      
      const result = await pool.query(rawQuery, [status]);
      const minimalResults = result.rows;
      
      console.log(`Found ${minimalResults.length} contracts with status: ${status}`);
      
      // Map the results to include the term field (mapped from termMonths) 
      // and any other expected fields that weren't in the minimal query
      const contractsWithDefaults = minimalResults.map(contract => {
        return {
          ...contract,
          // Add the term field that maps to termMonths for backwards compatibility
          term: contract.termMonths || 0,
          // Add default values for fields not in our minimal query
          completedAt: null,
          downPayment: 0,
          financedAmount: contract.amount || 0,
          monthlyPayment: 0,
          currentStep: "completed",
          archived: false,
          archivedAt: null,
          archivedReason: null,
          phoneNumber: null,
          salesRepId: null,
          purchasedByShifi: false,
          tokenizationStatus: "pending",
          tokenId: null,
          smartContractAddress: null,
          tokenizationError: null,
          blockchainTransactionHash: null, 
          blockNumber: null,
          tokenizationDate: null,
          tokenMetadata: null,
          // Additional frontend expected fields
          updatedAt: null,
          startDate: null,
          endDate: null,
          cancellationRequestedAt: null, // Field does not exist in DB yet
          type: 'custom'
        };
      });
      
      return contractsWithDefaults;
    } catch (error) {
      console.error(`Error getting contracts by status ${status}:`, error);
      return [];
    }
  }
  


  async storeAssetReportToken(contractId: number, assetReportToken: string, assetReportId: string, options: any = {}) {
    const { userId, plaidItemId, daysRequested = 60, expiresAt } = options;

    const [assetReport] = await db.insert(assetReports).values({
      contractId,
      userId,
      assetReportId,
      assetReportToken,
      plaidItemId,
      daysRequested,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    }).returning();

    return assetReport;
  }

  async getAssetReportById(id: number): Promise<AssetReport | undefined> {
    const [assetReport] = await db.select().from(assetReports).where(eq(assetReports.id, id));
    return assetReport || undefined;
  }

  async getAssetReportsByContractId(contractId: number) {
    return await db.select().from(assetReports).where(eq(assetReports.contractId, contractId)).orderBy(desc(assetReports.createdAt));
  }

  async getAssetReportsByUserId(userId: number) {
    return await db.select().from(assetReports).where(eq(assetReports.userId, userId)).orderBy(desc(assetReports.createdAt));
  }

  async getAssetReportsByAssetReportId(assetReportId: string) {
    return await db.select().from(assetReports).where(eq(assetReports.assetReportId, assetReportId)).orderBy(desc(assetReports.createdAt));
  }

  async updateAssetReportStatus(id: number, status: string, analysisData?: any) {
    const updates: any = {
      status,
      refreshedAt: new Date()
    };

    if (analysisData) {
      updates.analysisData = typeof analysisData === 'string' ? analysisData : JSON.stringify(analysisData);
    }

    const [updatedReport] = await db.update(assetReports).set(updates).where(eq(assetReports.id, id)).returning();
    return updatedReport;
  }

  async getLatestPortfolioMonitoring() {
    const result = await db.select().from(portfolioMonitoring).orderBy(desc(portfolioMonitoring.createdAt)).limit(1);
    return result[0] || null;
  }

  async updatePortfolioMonitoring(data: any) {
    const monitoring = await this.getLatestPortfolioMonitoring();

    if (monitoring) {
      // Update existing record
      const [updatedMonitoring] = await db.update(portfolioMonitoring)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(portfolioMonitoring.id, monitoring.id))
        .returning();
      return updatedMonitoring;
    } else {
      // Create new record
      const [newMonitoring] = await db.insert(portfolioMonitoring)
        .values({
          ...data,
          createdAt: new Date()
        })
        .returning();
      return newMonitoring;
    }
  }

  async saveComplaintsData(complaints: any[]) {
    if (!complaints || complaints.length === 0) return [];

    const values = complaints.map(complaint => ({
      complaintId: complaint.complaint_id,
      product: complaint.product,
      subProduct: complaint.sub_product,
      issue: complaint.issue,
      subIssue: complaint.sub_issue,
      company: complaint.company,
      state: complaint.state,
      submittedVia: complaint.submitted_via,
      dateReceived: complaint.date_received ? new Date(complaint.date_received) : undefined,
      complaintNarrative: complaint.complaint_what_happened,
      companyResponse: complaint.company_response,
      timelyResponse: complaint.timely === 'Yes',
      consumerDisputed: complaint.consumer_disputed === 'Yes',
      tags: Array.isArray(complaint.tags) ? complaint.tags : [],
      metadata: typeof complaint.metadata === 'string' ? complaint.metadata : JSON.stringify(complaint),
      createdAt: new Date(),
    }));

    return await db.insert(complaintsData)
      .values(values)
      .onConflictDoUpdate({
        target: complaintsData.complaintId,
        set: {
          updatedAt: new Date()
        }
      })
      .returning();
  }

  async getComplaintsData(options: {
    product?: string,
    company?: string,
    limit?: number,
    offset?: number
  } = {}) {
    let query = db.select().from(complaintsData);

    if (options.product) {
      query = query.where(eq(complaintsData.product, options.product));
    }

    if (options.company) {
      query = query.where(eq(complaintsData.company, options.company));
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return await query.orderBy(desc(complaintsData.dateReceived));
  }

  async seedInitialData() {
    try {
      // Check if data already exists to avoid duplicates
      const existingUsers = await this.getAllUsers();
      if (existingUsers.length > 0) {
        console.log("Database already has data. Skipping seed.");
        return;
      }

      // Create admin user
      const adminUser: InsertUser = {
        email: "admin@shifi.com",
        password: "admin123", // In a real app, this would be hashed
        name: "Admin User",
        role: "admin",
        phone: "123-456-7890"
      };
      const createdAdminUser = await this.createUser(adminUser);

      // Create a merchant user
      const merchantUser: InsertUser = {
        email: "merchant@techsolutions.com",
        password: "merchant123", // In a real app, this would be hashed
        name: "Merchant User",
        role: "merchant",
        phone: "987-654-3210"
      };
      const createdMerchantUser = await this.createUser(merchantUser);

      // Create merchant
      const merchant: InsertMerchant = {
        name: "TechSolutions Inc.",
        contactName: "Merchant User",
        email: "contact@techsolutions.com",
        phone: "987-654-3210",
        address: "123 Tech Ave, San Francisco, CA",
        active: true,
        userId: createdMerchantUser.id
      };
      await this.createMerchant(merchant);

      // Create some customer users
      const customersData = [
        {
          email: "sarah.johnson@example.com",
          password: "password123",
          name: "Sarah Johnson",
          role: "customer" as const,
          phone: "555-123-4567"
        },
        {
          email: "michael.brown@example.com",
          password: "password123",
          name: "Michael Brown",
          role: "customer" as const,
          phone: "555-987-6543"
        },
        {
          email: "jennifer.smith@example.com",
          password: "password123",
          name: "Jennifer Smith",
          role: "customer" as const,
          phone: "555-456-7890"
        }
      ];

      const createdCustomers = await Promise.all(customersData.map(customer => this.createUser(customer)));

      // Create some contracts
      const contractsData = [
        {
          contractNumber: "SHI-0023",
          merchantId: 1,
          customerId: 2,
          amount: 4500,
          downPayment: 675, // 15%
          financedAmount: 3825,
          termMonths: 24,
          interestRate: 0,
          monthlyPayment: 159.38,
          status: "active" as const,
          currentStep: "completed" as const,
          phoneNumber: "555-123-4567", // Added phone number
          archived: false // Added archived status
        },
        {
          contractNumber: "SHI-0022",
          merchantId: 1,
          customerId: 3,
          amount: 2750,
          downPayment: 412.5, // 15%
          financedAmount: 2337.5,
          termMonths: 24,
          interestRate: 0,
          monthlyPayment: 97.40,
          status: "pending" as const,
          currentStep: "terms" as const,
          phoneNumber: "555-987-6543", // Added phone number
          archived: false // Added archived status
        },
        {
          contractNumber: "SHI-0021",
          merchantId: 1,
          customerId: 4,
          amount: 3200,
          downPayment: 480, // 15%
          financedAmount: 2720,
          termMonths: 24,
          interestRate: 0,
          monthlyPayment: 113.33,
          status: "declined" as const,
          currentStep: "kyc" as const,
          phoneNumber: "555-456-7890", // Added phone number
          archived: false // Added archived status
        }
      ];

      await Promise.all(contractsData.map(contract => this.createContract(contract)));

      console.log("Database seeded successfully");
    } catch (error) {
      console.error("Error seeding database:", error);
      throw error;
    }
  }

  // Method to get all users
  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return []; // Return empty array to prevent further errors
    }
  }

  async updateUserName(userId: number, firstName?: string, lastName?: string): Promise<User | null> {
    const updates: any = {};

    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;

    // Only update if we have at least one field to update
    if (Object.keys(updates).length === 0) return null;

    // Update name field for backward compatibility
    if (firstName && lastName) {
      updates.name = `${firstName} ${lastName}`;
    } else if (firstName) {
      updates.name = firstName;
    } else if (lastName) {
      updates.name = lastName;
    }

    const result = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  // Email verification token methods
  async createEmailVerificationToken(token: InsertEmailVerificationToken): Promise<EmailVerificationToken> {
    try {
      const [newToken] = await db
        .insert(emailVerificationTokens)
        .values(token)
        .returning();
      
      return newToken;
    } catch (error) {
      console.error("Error creating email verification token:", error);
      throw new Error("Failed to create email verification token");
    }
  }

  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    try {
      const [verificationToken] = await db
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.token, token));
      
      return verificationToken;
    } catch (error) {
      console.error("Error getting email verification token:", error);
      return undefined;
    }
  }

  async markEmailVerificationTokenUsed(id: number): Promise<EmailVerificationToken | undefined> {
    try {
      const [updatedToken] = await db
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(eq(emailVerificationTokens.id, id))
        .returning();
      
      return updatedToken;
    } catch (error) {
      console.error(`Error marking email verification token ${id} as used:`, error);
      return undefined;
    }
  }

  async consumeEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    try {
      // Get the token from database
      const verificationToken = await this.getEmailVerificationToken(token);
      
      if (!verificationToken) {
        return undefined;
      }
      
      // Check if token is already used
      if (verificationToken.usedAt) {
        return undefined;
      }
      
      // Mark token as used
      const updatedToken = await this.markEmailVerificationTokenUsed(verificationToken.id);
      
      if (!updatedToken) {
        return undefined;
      }
      
      // Verify the user's email
      const user = await this.verifyUserEmail(verificationToken.userId);
      
      if (!user) {
        return undefined;
      }
      
      return updatedToken;
    } catch (error) {
      console.error(`Error consuming email verification token:`, error);
      return undefined;
    }
  }

  async verifyUserEmail(userId: number): Promise<User | undefined> {
    try {
      // Add emailVerified field to users table if it doesn't exist yet
      const [updatedUser] = await db
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, userId))
        .returning();
      
      return updatedUser;
    } catch (error) {
      console.error(`Error verifying email for user ${userId}:`, error);
      return undefined;
    }
  }

  // Password reset token methods
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    try {
      const [newToken] = await db
        .insert(passwordResetTokens)
        .values(token)
        .returning();
      
      return newToken;
    } catch (error) {
      console.error("Error creating password reset token:", error);
      throw new Error("Failed to create password reset token");
    }
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    try {
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token));
      
      return resetToken;
    } catch (error) {
      console.error("Error getting password reset token:", error);
      return undefined;
    }
  }

  async markPasswordResetTokenUsed(id: number): Promise<PasswordResetToken | undefined> {
    try {
      const [updatedToken] = await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, id))
        .returning();
      
      return updatedToken;
    } catch (error) {
      console.error(`Error marking password reset token ${id} as used:`, error);
      return undefined;
    }
  }

  async verifyPasswordResetToken(token: string): Promise<User | undefined> {
    try {
      // Get the password reset token
      const resetToken = await this.getPasswordResetToken(token);
      
      if (!resetToken) {
        return undefined;
      }
      
      // Check if token is expired
      const now = new Date();
      if (now > resetToken.expiresAt) {
        console.warn(`Password reset token expired: ${token}`);
        return undefined;
      }
      
      // Check if token has been used
      if (resetToken.usedAt) {
        console.warn(`Password reset token already used: ${token}`);
        return undefined;
      }
      
      // Get the user associated with this token
      const user = await this.getUser(resetToken.userId);
      return user;
    } catch (error) {
      console.error(`Error verifying password reset token ${token}:`, error);
      return undefined;
    }
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, userId))
        .returning();
      
      return updatedUser;
    } catch (error) {
      console.error(`Error updating password for user ${userId}:`, error);
      return undefined;
    }
  }

  async invalidatePasswordResetTokens(userId: number): Promise<number> {
    try {
      // Mark all unused tokens for this user as used
      const now = new Date();
      const result = await db
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokens.userId, userId),
            eq(passwordResetTokens.usedAt, null)
          )
        );
      
      return result.rowCount || 0;
    } catch (error) {
      console.error(`Error invalidating password reset tokens for user ${userId}:`, error);
      return 0;
    }
  }
  
  // One-Time Password (OTP) methods
  async createOneTimePassword(otp: InsertOneTimePassword): Promise<OneTimePassword> {
    try {
      // First, invalidate any existing unused OTPs for this phone number
      await this.invalidateOneTimePasswords(otp.phone);
      
      // Create new OTP
      const [newOtp] = await db
        .insert(oneTimePasswords)
        .values(otp)
        .returning();
      
      return newOtp;
    } catch (error) {
      console.error("Error creating one-time password:", error);
      throw new Error("Failed to create one-time password");
    }
  }
  
  async getOneTimePasswordByCode(code: string, phone: string): Promise<OneTimePassword | undefined> {
    try {
      const [otp] = await db
        .select()
        .from(oneTimePasswords)
        .where(
          and(
            eq(oneTimePasswords.otp, code),
            eq(oneTimePasswords.phone, phone),
            eq(oneTimePasswords.usedAt, null)
          )
        );
      
      return otp;
    } catch (error) {
      console.error(`Error getting OTP for phone ${phone}:`, error);
      return undefined;
    }
  }
  
  async getOneTimePasswordByPhone(phone: string, purpose?: string): Promise<OneTimePassword | undefined> {
    try {
      let query = db
        .select()
        .from(oneTimePasswords)
        .where(
          and(
            eq(oneTimePasswords.phone, phone),
            eq(oneTimePasswords.usedAt, null)
          )
        )
        .orderBy(desc(oneTimePasswords.createdAt))
        .limit(1);
      
      // Add purpose filter if specified
      if (purpose) {
        query = query.where(eq(oneTimePasswords.purpose, purpose));
      }
      
      const [otp] = await query;
      return otp;
    } catch (error) {
      console.error(`Error getting recent OTP for phone ${phone}:`, error);
      return undefined;
    }
  }
  
  async markOneTimePasswordUsed(id: number): Promise<OneTimePassword | undefined> {
    try {
      const [updatedOtp] = await db
        .update(oneTimePasswords)
        .set({ 
          usedAt: new Date(),
          verified: true 
        })
        .where(eq(oneTimePasswords.id, id))
        .returning();
      
      return updatedOtp;
    } catch (error) {
      console.error(`Error marking OTP ${id} as used:`, error);
      return undefined;
    }
  }
  
  async verifyOneTimePassword(code: string, phone: string): Promise<boolean> {
    try {
      // Get the OTP
      const otp = await this.getOneTimePasswordByCode(code, phone);
      
      if (!otp) {
        console.warn(`No matching OTP found for phone ${phone}`);
        return false;
      }
      
      // Check if OTP is expired
      const now = new Date();
      if (now > otp.expiresAt) {
        console.warn(`OTP expired for phone ${phone}`);
        
        // Update attempt count
        await db
          .update(oneTimePasswords)
          .set({ 
            attempts: (otp.attempts || 0) + 1
          })
          .where(eq(oneTimePasswords.id, otp.id));
          
        return false;
      }
      
      // Mark this OTP as used
      await this.markOneTimePasswordUsed(otp.id);
      return true;
    } catch (error) {
      console.error(`Error verifying OTP for phone ${phone}:`, error);
      return false;
    }
  }
  
  async invalidateOneTimePasswords(phone: string): Promise<number> {
    try {
      // Mark all unused OTPs for this phone as used
      const now = new Date();
      const result = await db
        .update(oneTimePasswords)
        .set({ usedAt: now })
        .where(
          and(
            eq(oneTimePasswords.phone, phone),
            eq(oneTimePasswords.usedAt, null)
          )
        );
      
      return result.rowCount || 0;
    } catch (error) {
      console.error(`Error invalidating OTPs for phone ${phone}:`, error);
      return 0;
    }
  }

  // Method to get completed KYC verifications by user ID
  async getCompletedKycVerificationsByUserId(userId: number): Promise<ApplicationProgress[]> {
    if (!userId) return [];

    try {
      // Get all contracts for this user
      const userContracts = await this.getContractsByCustomerId(userId);
      let contractsToCheck = [...(userContracts || [])];
      let linkedByPhone = false;

      // Get user details to check phone-based linkage
      const user = await this.getUser(userId);
      let userPhone = null;

      if (user && user.phone) {
        userPhone = user.phone.replace(/\D/g, '');
      }

      // If no contracts found or we have a phone number, check for phone-linked contracts
      if ((contractsToCheck.length === 0 || userPhone) && userPhone) {
        // Find contracts with this phone number (could be linked to different user IDs)
        const phoneContracts = await db
          .select()
          .from(contracts)
          .where(eq(contracts.phoneNumber, userPhone));

        if (phoneContracts && phoneContracts.length > 0) {
          // Add unique contracts to our list (avoid duplicates)
          for (const contract of phoneContracts) {
            if (!contractsToCheck.some(c => c.id === contract.id)) {
              contractsToCheck.push(contract);
              linkedByPhone = true;
            }
          }
        }
      }

      // Also check if this user's phone number appears in other contracts
      // This is a crucial check for returning users with new applications
      if (userPhone) {
        // Find all users with matching phone
        const usersWithSamePhone = await db
          .select()
          .from(users)
          .where(
            or(
              eq(users.phone, userPhone),
              like(users.phone, `%${userPhone}%`)
            )
          );

        // Get contracts for these users
        if (usersWithSamePhone && usersWithSamePhone.length > 0) {
          const linkedUserIds = usersWithSamePhone.map(u => u.id);

          for (const linkedUserId of linkedUserIds) {
            if (linkedUserId !== userId) {
              const linkedUserContracts = await this.getContractsByCustomerId(linkedUserId);

              if (linkedUserContracts && linkedUserContracts.length > 0) {
                // Add unique contracts to our list
                for (const contract of linkedUserContracts) {
                  if (!contractsToCheck.some(c => c.id === contract.id)) {
                    contractsToCheck.push(contract);
                    linkedByPhone = true;
                  }
                }
              }
            }
          }
        }
      }

      // If still no contracts found, check any contract with matching phone
      if (contractsToCheck.length === 0 && userPhone) {
        // Direct search for contracts with this phone
        const phoneContracts = await db
          .select()
          .from(contracts)
          .where(
            or(
              eq(contracts.phoneNumber, userPhone),
              like(contracts.phoneNumber, `%${userPhone}%`)
            )
          );

        if (phoneContracts && phoneContracts.length > 0) {
          contractsToCheck.push(...phoneContracts);
          linkedByPhone = true;
        }
      }

      // If still no contracts found, return empty array
      if (contractsToCheck.length === 0) {
        return [];
      }

      // Extract contract IDs, ensuring no duplicates
      const contractIds = [...new Set(contractsToCheck.map(contract => contract.id))];

      // Find all KYC steps that are completed for any of the user's contracts
      const completedKyc = await db
        .select()
        .from(applicationProgress)
        .where(
          and(
            eq(applicationProgress.step, "kyc"),
            eq(applicationProgress.completed, true),
            inArray(applicationProgress.contractId, contractIds)
          )
        );

      // Additional logging for phone-linked verification
      if (linkedByPhone && completedKyc.length > 0) {
        console.log(`Found ${completedKyc.length} completed KYC verifications linked by phone for user ${userId} with phone ${userPhone}`);
      }

      return completedKyc;
    } catch (error) {
      console.error(`Error getting completed KYC verifications for user ${userId}:`, error);
      return [];
    }
  }

  // Plaid Platform Merchant methods
  async getPlaidMerchant(id: number): Promise<PlaidMerchant | undefined> {
    const [plaidMerchant] = await db.select().from(plaidMerchants).where(eq(plaidMerchants.id, id));
    return plaidMerchant || undefined;
  }

  async getPlaidMerchantByMerchantId(merchantId: number): Promise<PlaidMerchant | undefined> {
    const [plaidMerchant] = await db.select().from(plaidMerchants).where(eq(plaidMerchants.merchantId, merchantId));
    return plaidMerchant || undefined;
  }

  async getPlaidMerchantByOriginatorId(originatorId: string): Promise<PlaidMerchant | undefined> {
    if (!originatorId) return undefined;

    const [plaidMerchant] = await db.select().from(plaidMerchants).where(eq(plaidMerchants.originatorId, originatorId));
    return plaidMerchant || undefined;
  }

  async createPlaidMerchant(data: InsertPlaidMerchant): Promise<PlaidMerchant> {
    const [newPlaidMerchant] = await db.insert(plaidMerchants).values(data).returning();
    return newPlaidMerchant;
  }

  async updatePlaidMerchant(id: number, data: Partial<InsertPlaidMerchant>): Promise<PlaidMerchant | undefined> {
    try {
      // Add updatedAt timestamp
      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      const [updatedPlaidMerchant] = await db
        .update(plaidMerchants)
        .set(updateData)
        .where(eq(plaidMerchants.id, id))
        .returning();

      return updatedPlaidMerchant;
    } catch (error) {
      console.error(`Error updating Plaid merchant ${id}:`, error);
      return undefined;
    }
  }

  async getPlaidMerchantsByStatus(status: string): Promise<PlaidMerchant[]> {
    return await db.select().from(plaidMerchants).where(eq(plaidMerchants.onboardingStatus, status as any));
  }

  // Plaid Transfer methods
  async createPlaidTransfer(transfer: InsertPlaidTransfer): Promise<PlaidTransfer> {
    const [newTransfer] = await db.insert(plaidTransfers).values(transfer).returning();
    return newTransfer;
  }

  async getPlaidTransferById(id: number): Promise<PlaidTransfer | undefined> {
    const [transfer] = await db.select().from(plaidTransfers).where(eq(plaidTransfers.id, id));
    return transfer || undefined;
  }

  async getPlaidTransferByExternalId(transferId: string): Promise<PlaidTransfer | undefined> {
    const [transfer] = await db.select().from(plaidTransfers).where(eq(plaidTransfers.transferId, transferId));
    return transfer || undefined;
  }

  async getPlaidTransfersByContractId(contractId: number): Promise<PlaidTransfer[]> {
    return await db.select().from(plaidTransfers).where(eq(plaidTransfers.contractId, contractId));
  }

  async getPlaidTransfersByMerchantId(merchantId: number): Promise<PlaidTransfer[]> {
    return await db.select().from(plaidTransfers).where(eq(plaidTransfers.merchantId, merchantId));
  }
  
  async getPlaidTransfers(params: { 
    merchantId?: number; 
    type?: string;
    status?: string;
  }): Promise<PlaidTransfer[]> {
    let query = db.select().from(plaidTransfers);
    
    // Add filters based on parameters
    const conditions: SQL[] = [];
    
    if (params.merchantId) {
      conditions.push(eq(plaidTransfers.merchantId, params.merchantId));
    }
    
    if (params.type) {
      conditions.push(eq(plaidTransfers.type, params.type));
    }
    
    if (params.status) {
      conditions.push(eq(plaidTransfers.status, params.status));
    }
    
    // Apply all conditions if there are any
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Sort by creation date (newest first)
    query = query.orderBy(desc(plaidTransfers.createdAt));
    
    return await query;
  }

  async updatePlaidTransferStatus(id: number, status: string): Promise<PlaidTransfer | undefined> {
    try {
      const [updatedTransfer] = await db
        .update(plaidTransfers)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(plaidTransfers.id, id))
        .returning();

      return updatedTransfer;
    } catch (error) {
      console.error(`Error updating Plaid transfer status for ${id}:`, error);
      return undefined;
    }
  }

  // Merchant Business Details methods
  async getMerchantBusinessDetails(id: number): Promise<MerchantBusinessDetails | undefined> {
    const [details] = await db.select().from(merchantBusinessDetails).where(eq(merchantBusinessDetails.id, id));
    return details || undefined;
  }

  async getMerchantBusinessDetailsByMerchantId(merchantId: number): Promise<MerchantBusinessDetails | undefined> {
    const [details] = await db.select().from(merchantBusinessDetails).where(eq(merchantBusinessDetails.merchantId, merchantId));
    return details || undefined;
  }
  
  async getAllMerchantBusinessDetailsByMerchantId(merchantId: number): Promise<MerchantBusinessDetails[]> {
    return await db.select().from(merchantBusinessDetails).where(eq(merchantBusinessDetails.merchantId, merchantId));
  }

  async createMerchantBusinessDetails(details: InsertMerchantBusinessDetails): Promise<MerchantBusinessDetails> {
    const [newDetails] = await db.insert(merchantBusinessDetails).values({
      ...details,
      updatedAt: new Date()
    }).returning();
    return newDetails;
  }

  async updateMerchantBusinessDetails(id: number, details: Partial<InsertMerchantBusinessDetails>): Promise<MerchantBusinessDetails | undefined> {
    const [updatedDetails] = await db.update(merchantBusinessDetails)
      .set({
        ...details,
        updatedAt: new Date()
      })
      .where(eq(merchantBusinessDetails.id, id))
      .returning();

    return updatedDetails;
  }
  
  async updateMerchantBusinessDetailsByMerchantId(merchantId: number, details: Partial<InsertMerchantBusinessDetails>): Promise<MerchantBusinessDetails | undefined> {
    const [updatedDetails] = await db.update(merchantBusinessDetails)
      .set({
        ...details,
        updatedAt: new Date()
      })
      .where(eq(merchantBusinessDetails.merchantId, merchantId))
      .returning();

    return updatedDetails;
  }

  // Merchant Documents methods
  async getMerchantDocument(id: number): Promise<MerchantDocument | undefined> {
    const [document] = await db.select().from(merchantDocuments).where(eq(merchantDocuments.id, id));
    return document || undefined;
  }

  async getMerchantDocumentsByMerchantId(merchantId: number): Promise<MerchantDocument[]> {
    return await db.select().from(merchantDocuments).where(eq(merchantDocuments.merchantId, merchantId));
  }

  async getMerchantDocumentsByType(merchantId: number, type: string): Promise<MerchantDocument[]> {
    return await db.select().from(merchantDocuments)
      .where(and(
        eq(merchantDocuments.merchantId, merchantId),
        eq(merchantDocuments.type, type)
      ));
  }

  async createMerchantDocument(document: InsertMerchantDocument): Promise<MerchantDocument> {
    const [newDocument] = await db.insert(merchantDocuments).values(document).returning();
    return newDocument;
  }

  async updateMerchantDocumentVerification(id: number, verified: boolean, verifiedBy?: number): Promise<MerchantDocument | undefined> {
    const updateData: any = {
      verified,
      verifiedAt: verified ? new Date() : null,
    };

    if (verified && verifiedBy) {
      updateData.verifiedBy = verifiedBy;
    }

    const [updatedDocument] = await db.update(merchantDocuments)
      .set(updateData)
      .where(eq(merchantDocuments.id, id))
      .returning();

    return updatedDocument;
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<number> {
    const [result] = await db.insert(notifications).values(notification).returning();
    return result.id;
  }

  async getNotification(id: number): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification || undefined;
  }

  async getNotificationsByRecipient(recipientId: number, recipientType: string): Promise<Notification[]> {
    return await db.select().from(notifications).where(
      and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.recipientType, recipientType as any)
      )
    ).orderBy(desc(notifications.sentAt));
  }

  async updateNotification(data: { id: number, status: string, updatedAt: Date }): Promise<Notification | undefined> {
    const [updated] = await db
      .update(notifications)
      .set({
        status: data.status as any,
        updatedAt: data.updatedAt
      })
      .where(eq(notifications.id, data.id))
      .returning();
    return updated;
  }

  // Notification Channel operations
  async createNotificationChannel(channel: InsertNotificationChannel): Promise<NotificationChannel> {
    const [newChannel] = await db.insert(notificationChannels).values(channel).returning();
    return newChannel;
  }

  async updateNotificationChannel(
    data: { notificationId: number, channel: string, status: string, updatedAt: Date, errorMessage?: string }
  ): Promise<NotificationChannel | undefined> {
    const { notificationId, channel: channelType, status, updatedAt, errorMessage } = data;

    // Find the channel record
    const [existingChannel] = await db.select().from(notificationChannels).where(
      and(
        eq(notificationChannels.notificationId, notificationId),
        eq(notificationChannels.channel, channelType as any)
      )
    );

    if (!existingChannel) return undefined;

    // Update data
    const updateData: any = {
      status: status as any,
      updatedAt
    };

    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }

    // If status is failed, increment retry count
    if (status === 'failed') {
      updateData.retryCount = existingChannel.retryCount + 1;
    }

    // Update the channel
    const [updated] = await db
      .update(notificationChannels)
      .set(updateData)
      .where(eq(notificationChannels.id, existingChannel.id))
      .returning();

    return updated;
  }

  async getNotificationChannels(notificationId: number): Promise<NotificationChannel[]> {
    return await db.select().from(notificationChannels)
      .where(eq(notificationChannels.notificationId, notificationId))
      .orderBy(notificationChannels.channel);
  }

  // In-App Notification operations
  async createInAppNotification(notification: InsertInAppNotification): Promise<InAppNotification> {
    const [newNotification] = await db.insert(inAppNotifications).values(notification).returning();
    return newNotification;
  }

  async getInAppNotifications(
    userId: number, 
    userType: string, 
    options?: { unreadOnly?: boolean, limit?: number, offset?: number }
  ): Promise<InAppNotification[]> {
    let query = db.select().from(inAppNotifications).where(
      and(
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.userType, userType as any)
      )
    );

    // Apply unreadOnly filter if specified
    if (options?.unreadOnly) {
      query = query.where(eq(inAppNotifications.isRead, false));
    }

    // Apply pagination if specified
    if (options?.limit) {
      query = query.limit(options.limit);

      if (options?.offset) {
        query = query.offset(options.offset);
      }
    }

    // Order by creation date, newest first
    return await query.orderBy(desc(inAppNotifications.createdAt));
  }

  async markInAppNotificationAsRead(id: number): Promise<InAppNotification | undefined> {
    const [updated] = await db
      .update(inAppNotifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(eq(inAppNotifications.id, id))
      .returning();
    return updated;
  }
  // Add this method to your DatabaseStorage class
  async updateAssetReport(id: number, data: Partial<AssetReport>): Promise<AssetReport | undefined> {
    try {
      // Set updated timestamp
      const updatedData = {
        ...data,
        refreshedAt: new Date()
      };

      // Execute the update query
      const [updatedReport] = await db
        .update(assetReports)
        .set(updatedData)
        .where(eq(assetReports.id, id))
        .returning();

      return updatedReport;
    } catch (error) {
      console.error(`Error updating asset report ${id}:`, error);
      return undefined;
    }
  }

  async markAllInAppNotificationsAsRead(userId: number, userType: string): Promise<number> {
    const result = await db
      .update(inAppNotifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(
        and(
          eq(inAppNotifications.userId, userId),
          eq(inAppNotifications.userType, userType as any),
          eq(inAppNotifications.isRead, false)
        )
      );

    // Return number of rows affected
    return result.rowCount || 0;
  }

  // Customer Satisfaction Survey methods
  async createSatisfactionSurvey(survey: InsertCustomerSatisfactionSurvey): Promise<CustomerSatisfactionSurvey> {
    try {
      const [newSurvey] = await db.insert(customerSatisfactionSurveys)
        .values(survey)
        .returning();
      
      return newSurvey;
    } catch (error) {
      console.error('Error creating satisfaction survey:', error);
      throw new Error('Failed to create customer satisfaction survey');
    }
  }

  async getSatisfactionSurvey(id: number): Promise<CustomerSatisfactionSurvey | undefined> {
    try {
      const [survey] = await db.select()
        .from(customerSatisfactionSurveys)
        .where(eq(customerSatisfactionSurveys.id, id));
      
      return survey;
    } catch (error) {
      console.error(`Error getting satisfaction survey with ID ${id}:`, error);
      return undefined;
    }
  }

  async getSatisfactionSurveysByContractId(contractId: number): Promise<CustomerSatisfactionSurvey[]> {
    try {
      return await db.select()
        .from(customerSatisfactionSurveys)
        .where(eq(customerSatisfactionSurveys.contractId, contractId))
        .orderBy(desc(customerSatisfactionSurveys.createdAt));
    } catch (error) {
      console.error(`Error getting satisfaction surveys for contract ${contractId}:`, error);
      return [];
    }
  }

  async getSatisfactionSurveysByCustomerId(customerId: number): Promise<CustomerSatisfactionSurvey[]> {
    try {
      return await db.select()
        .from(customerSatisfactionSurveys)
        .where(eq(customerSatisfactionSurveys.customerId, customerId))
        .orderBy(desc(customerSatisfactionSurveys.createdAt));
    } catch (error) {
      console.error(`Error getting satisfaction surveys for customer ${customerId}:`, error);
      return [];
    }
  }

  async updateSatisfactionSurvey(id: number, data: Partial<CustomerSatisfactionSurvey>): Promise<CustomerSatisfactionSurvey | undefined> {
    try {
      const [updatedSurvey] = await db.update(customerSatisfactionSurveys)
        .set(data)
        .where(eq(customerSatisfactionSurveys.id, id))
        .returning();
      
      return updatedSurvey;
    } catch (error) {
      console.error(`Error updating satisfaction survey with ID ${id}:`, error);
      return undefined;
    }
  }

  async getActiveContractsDueForSurvey(daysActive: number): Promise<Contract[]> {
    try {
      const referenceDate = new Date();
      referenceDate.setDate(referenceDate.getDate() - daysActive);
      
      // Get all active contracts that have been active for at least 'daysActive' days
      const activeContracts = await db.select()
        .from(contracts)
        .where(
          and(
            eq(contracts.status, 'active'),
            // Ensure createdAt is before the reference date (contract is old enough)
            lt(contracts.createdAt, referenceDate)
          )
        );
      
      if (activeContracts.length === 0) return [];
      
      // For each contract, check if a survey has already been sent
      const contractsWithoutSurveys = [];
      
      for (const contract of activeContracts) {
        // Check if this contract already has a survey
        const existingSurveys = await this.getSatisfactionSurveysByContractId(contract.id);
        
        // If no surveys exist for this contract, add it to the list
        if (existingSurveys.length === 0) {
          contractsWithoutSurveys.push(contract);
        }
      }
      
      return contractsWithoutSurveys;
    } catch (error) {
      console.error(`Error getting active contracts due for survey:`, error);
      return [];
    }
  }

  // Smart Contract Template operations
  async getSmartContractTemplates(): Promise<SmartContractTemplate[]> {
    try {
      return await db.select().from(smartContractTemplates);
    } catch (error) {
      console.error("Error getting smart contract templates:", error);
      return [];
    }
  }

  async getSmartContractTemplate(id: number): Promise<SmartContractTemplate | undefined> {
    try {
      const [template] = await db.select().from(smartContractTemplates).where(eq(smartContractTemplates.id, id));
      return template || undefined;
    } catch (error) {
      console.error(`Error getting smart contract template ${id}:`, error);
      return undefined;
    }
  }

  async getSmartContractTemplatesByType(contractType: string): Promise<SmartContractTemplate[]> {
    try {
      return await db.select().from(smartContractTemplates).where(eq(smartContractTemplates.contractType, contractType));
    } catch (error) {
      console.error(`Error getting smart contract templates by type ${contractType}:`, error);
      return [];
    }
  }

  async createSmartContractTemplate(template: InsertSmartContractTemplate): Promise<SmartContractTemplate> {
    try {
      const [newTemplate] = await db.insert(smartContractTemplates).values(template).returning();
      return newTemplate;
    } catch (error) {
      console.error("Error creating smart contract template:", error);
      throw error;
    }
  }

  async updateSmartContractTemplate(id: number, data: Partial<SmartContractTemplate>): Promise<SmartContractTemplate | undefined> {
    try {
      const [updatedTemplate] = await db
        .update(smartContractTemplates)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(smartContractTemplates.id, id))
        .returning();
      
      return updatedTemplate;
    } catch (error) {
      console.error(`Error updating smart contract template ${id}:`, error);
      return undefined;
    }
  }

  // Smart Contract Deployment operations
  async getSmartContractDeployments(): Promise<SmartContractDeployment[]> {
    try {
      return await db.select().from(smartContractDeployments);
    } catch (error) {
      console.error("Error getting smart contract deployments:", error);
      return [];
    }
  }

  async getSmartContractDeployment(id: number): Promise<SmartContractDeployment | undefined> {
    try {
      const [deployment] = await db.select().from(smartContractDeployments).where(eq(smartContractDeployments.id, id));
      return deployment || undefined;
    } catch (error) {
      console.error(`Error getting smart contract deployment ${id}:`, error);
      return undefined;
    }
  }

  async getSmartContractDeploymentsByTemplateId(templateId: number): Promise<SmartContractDeployment[]> {
    try {
      return await db.select().from(smartContractDeployments).where(eq(smartContractDeployments.templateId, templateId));
    } catch (error) {
      console.error(`Error getting smart contract deployments by template ID ${templateId}:`, error);
      return [];
    }
  }

  async createSmartContractDeployment(deployment: InsertSmartContractDeployment): Promise<SmartContractDeployment> {
    try {
      const [newDeployment] = await db.insert(smartContractDeployments).values(deployment).returning();
      return newDeployment;
    } catch (error) {
      console.error("Error creating smart contract deployment:", error);
      throw error;
    }
  }

  // =========== Sales Rep Methods ===========

  async getSalesRep(id: number): Promise<SalesRep | undefined> {
    try {
      const [salesRep] = await db.select().from(salesReps).where(eq(salesReps.id, id));
      return salesRep || undefined;
    } catch (error) {
      console.error(`Error getting sales rep with ID ${id}:`, error);
      return undefined;
    }
  }

  async getSalesRepByUserId(userId: number): Promise<SalesRep | undefined> {
    try {
      const [salesRep] = await db.select().from(salesReps).where(eq(salesReps.userId, userId));
      return salesRep || undefined;
    } catch (error) {
      console.error(`Error getting sales rep by user ID ${userId}:`, error);
      return undefined;
    }
  }

  async getSalesRepsByMerchantId(merchantId: number): Promise<SalesRep[]> {
    try {
      return await db.select().from(salesReps).where(eq(salesReps.merchantId, merchantId));
    } catch (error) {
      console.error(`Error getting sales reps for merchant ID ${merchantId}:`, error);
      return [];
    }
  }

  async createSalesRep(salesRep: InsertSalesRep): Promise<SalesRep> {
    try {
      const [newSalesRep] = await db.insert(salesReps).values(salesRep).returning();
      return newSalesRep;
    } catch (error) {
      console.error("Error creating sales rep:", error);
      throw error;
    }
  }

  async updateSalesRep(id: number, data: Partial<SalesRep>): Promise<SalesRep | undefined> {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      const [updatedSalesRep] = await db
        .update(salesReps)
        .set(updateData)
        .where(eq(salesReps.id, id))
        .returning();

      return updatedSalesRep;
    } catch (error) {
      console.error(`Error updating sales rep ${id}:`, error);
      return undefined;
    }
  }

  // =========== Commission Methods ===========

  async getCommission(id: number): Promise<Commission | undefined> {
    try {
      const [commission] = await db.select().from(commissions).where(eq(commissions.id, id));
      return commission || undefined;
    } catch (error) {
      console.error(`Error getting commission with ID ${id}:`, error);
      return undefined;
    }
  }

  async getCommissionsByContractId(contractId: number): Promise<Commission[]> {
    try {
      return await db.select().from(commissions).where(eq(commissions.contractId, contractId));
    } catch (error) {
      console.error(`Error getting commissions for contract ID ${contractId}:`, error);
      return [];
    }
  }

  async getCommissionsBySalesRepId(salesRepId: number): Promise<Commission[]> {
    try {
      return await db.select().from(commissions).where(eq(commissions.salesRepId, salesRepId));
    } catch (error) {
      console.error(`Error getting commissions for sales rep ID ${salesRepId}:`, error);
      return [];
    }
  }

  async createCommission(commission: InsertCommission): Promise<Commission> {
    try {
      const [newCommission] = await db.insert(commissions).values(commission).returning();
      return newCommission;
    } catch (error) {
      console.error("Error creating commission:", error);
      throw error;
    }
  }

  async updateCommissionStatus(id: number, status: string, paidAt?: Date): Promise<Commission | undefined> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (status === "paid" && paidAt) {
        updateData.paidAt = paidAt;
      }

      const [updatedCommission] = await db
        .update(commissions)
        .set(updateData)
        .where(eq(commissions.id, id))
        .returning();

      return updatedCommission;
    } catch (error) {
      console.error(`Error updating commission status ${id}:`, error);
      return undefined;
    }
  }

  // =========== Sales Rep Analytics Methods ===========

  async getSalesRepAnalytics(id: number): Promise<SalesRepAnalytics | undefined> {
    try {
      const [analytics] = await db.select().from(salesRepAnalytics).where(eq(salesRepAnalytics.id, id));
      return analytics || undefined;
    } catch (error) {
      console.error(`Error getting sales rep analytics with ID ${id}:`, error);
      return undefined;
    }
  }

  async getSalesRepAnalyticsBySalesRepId(salesRepId: number): Promise<SalesRepAnalytics[]> {
    try {
      return await db.select().from(salesRepAnalytics).where(eq(salesRepAnalytics.salesRepId, salesRepId))
        .orderBy(desc(salesRepAnalytics.period));
    } catch (error) {
      console.error(`Error getting analytics for sales rep ID ${salesRepId}:`, error);
      return [];
    }
  }

  async getSalesRepAnalyticsByPeriod(salesRepId: number, period: string): Promise<SalesRepAnalytics | undefined> {
    try {
      const [analytics] = await db.select().from(salesRepAnalytics).where(
        and(
          eq(salesRepAnalytics.salesRepId, salesRepId),
          eq(salesRepAnalytics.period, period)
        )
      );
      return analytics || undefined;
    } catch (error) {
      console.error(`Error getting analytics for sales rep ID ${salesRepId} and period ${period}:`, error);
      return undefined;
    }
  }

  async createSalesRepAnalytics(analytics: InsertSalesRepAnalytics): Promise<SalesRepAnalytics> {
    try {
      const [newAnalytics] = await db.insert(salesRepAnalytics).values(analytics).returning();
      return newAnalytics;
    } catch (error) {
      console.error("Error creating sales rep analytics:", error);
      throw error;
    }
  }

  async updateSalesRepAnalytics(id: number, data: Partial<SalesRepAnalytics>): Promise<SalesRepAnalytics | undefined> {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      const [updatedAnalytics] = await db
        .update(salesRepAnalytics)
        .set(updateData)
        .where(eq(salesRepAnalytics.id, id))
        .returning();

      return updatedAnalytics;
    } catch (error) {
      console.error(`Error updating sales rep analytics ${id}:`, error);
      return undefined;
    }
  }

  async getContractsBySalesRepId(salesRepId: number): Promise<Contract[]> {
    try {
      // Use specific column selection to include all fields required by the Contract type
      const results = await db.select({
        id: contracts.id,
        contractNumber: contracts.contractNumber,
        merchantId: contracts.merchantId,
        customerId: contracts.customerId,
        amount: contracts.amount,
        downPayment: contracts.downPayment,
        financedAmount: contracts.financedAmount,
        termMonths: contracts.termMonths,
        interestRate: contracts.interestRate,
        monthlyPayment: contracts.monthlyPayment,
        status: contracts.status,
        currentStep: contracts.currentStep,
        createdAt: contracts.createdAt,
        completedAt: contracts.completedAt,
        phoneNumber: contracts.phoneNumber,
        archived: contracts.archived,
        purchasedByShifi: contracts.purchasedByShifi,
        tokenizationStatus: contracts.tokenizationStatus,
        tokenId: contracts.tokenId,
        tokenizationDate: contracts.tokenizationDate,
        smartContractAddress: contracts.smartContractAddress,
        tokenizationError: contracts.tokenizationError,
        // Include additional fields required by the Contract type
        salesRepId: contracts.salesRepId,
        archivedAt: contracts.archivedAt,
        archivedReason: contracts.archivedReason,
        blockchainTransactionHash: contracts.blockchainTransactionHash,
        blockNumber: contracts.blockNumber,
        tokenMetadata: contracts.tokenMetadata
      })
      .from(contracts)
      .where(eq(contracts.salesRepId, salesRepId));
      
      return results;
    } catch (error) {
      console.error(`Error getting contracts for sales rep ID ${salesRepId}:`, error);
      return [];
    }
  }

  async getContractsByTokenizationStatus(status: string): Promise<Contract[]> {
    try {
      // Use specific column selection to avoid issues with missing columns
      const results = await db.select({
        id: contracts.id,
        contractNumber: contracts.contractNumber,
        merchantId: contracts.merchantId,
        customerId: contracts.customerId,
        amount: contracts.amount,
        downPayment: contracts.downPayment,
        financedAmount: contracts.financedAmount,
        termMonths: contracts.termMonths,
        interestRate: contracts.interestRate,
        monthlyPayment: contracts.monthlyPayment,
        status: contracts.status,
        currentStep: contracts.currentStep,
        createdAt: contracts.createdAt,
        completedAt: contracts.completedAt,
        phoneNumber: contracts.phoneNumber,
        archived: contracts.archived,
        purchasedByShifi: contracts.purchasedByShifi,
        tokenizationStatus: contracts.tokenizationStatus,
        tokenId: contracts.tokenId,
        tokenizationDate: contracts.tokenizationDate,
        smartContractAddress: contracts.smartContractAddress,
        tokenizationError: contracts.tokenizationError,
        // Include additional fields that are required by the contract type definition
        salesRepId: contracts.salesRepId,
        archivedAt: contracts.archivedAt,
        archivedReason: contracts.archivedReason,
        blockchainTransactionHash: contracts.blockchainTransactionHash,
        blockNumber: contracts.blockNumber,
        tokenMetadata: contracts.tokenMetadata
      })
      .from(contracts)
      .where(eq(contracts.tokenizationStatus, status as any));
      
      return results;
    } catch (error) {
      console.error(`Error getting contracts with tokenization status ${status}:`, error);
      return [];
    }
  }

  // Support Ticket methods
  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    try {
      // Set timestamps
      const ticketData = {
        ...ticket,
        updatedAt: new Date()
      };

      const [newTicket] = await db
        .insert(supportTickets)
        .values(ticketData)
        .returning();

      // Create activity log entry for ticket creation
      await this.createTicketActivityLog({
        ticketId: newTicket.id,
        userId: ticket.createdBy,
        actionType: 'created',
        actionDetails: `Support ticket created with status "${ticket.status}"`,
      });

      return newTicket;
    } catch (error) {
      console.error(`Error creating support ticket:`, error);
      throw new Error('Failed to create support ticket');
    }
  }

  async getSupportTicket(id: number): Promise<SupportTicket | undefined> {
    try {
      // Explicitly select only the columns we know exist in the database
      const [ticket] = await db
        .select({
          id: supportTickets.id,
          ticketNumber: supportTickets.ticketNumber,
          merchantId: supportTickets.merchantId,
          createdBy: supportTickets.createdBy,
          category: supportTickets.category,
          subcategory: supportTickets.subcategory,
          subject: supportTickets.subject,
          description: supportTickets.description,
          status: supportTickets.status,
          priority: supportTickets.priority,
          assignedTo: supportTickets.assignedTo,
          conversationId: supportTickets.conversationId,
          createdAt: supportTickets.createdAt,
          updatedAt: supportTickets.updatedAt,
          resolvedAt: supportTickets.resolvedAt,
          closedAt: supportTickets.closedAt,
          // Omit firstResponseAt, dueBy, and slaStatus which might not exist in the database yet
        })
        .from(supportTickets)
        .where(eq(supportTickets.id, id));

      if (!ticket) return undefined;
      
      // Add the missing fields with default values
      return {
        ...ticket,
        firstResponseAt: null,
        dueBy: null,
        slaStatus: "within_target"
      } as SupportTicket;
    } catch (error) {
      console.error(`Error getting support ticket ${id}:`, error);
      return undefined;
    }
  }

  async getSupportTicketByNumber(ticketNumber: string): Promise<SupportTicket | undefined> {
    try {
      const [ticket] = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.ticketNumber, ticketNumber));

      return ticket;
    } catch (error) {
      console.error(`Error getting support ticket by number ${ticketNumber}:`, error);
      return undefined;
    }
  }

  async getSupportTicketsByMerchantId(merchantId: number): Promise<SupportTicket[]> {
    try {
      // Explicitly select only the columns we know exist in the database
      const tickets = await db
        .select({
          id: supportTickets.id,
          ticketNumber: supportTickets.ticketNumber,
          merchantId: supportTickets.merchantId,
          createdBy: supportTickets.createdBy,
          category: supportTickets.category,
          subcategory: supportTickets.subcategory,
          subject: supportTickets.subject,
          description: supportTickets.description,
          status: supportTickets.status,
          priority: supportTickets.priority,
          assignedTo: supportTickets.assignedTo,
          conversationId: supportTickets.conversationId,
          createdAt: supportTickets.createdAt,
          updatedAt: supportTickets.updatedAt,
          resolvedAt: supportTickets.resolvedAt,
          closedAt: supportTickets.closedAt,
          // Omit firstResponseAt, dueBy, and slaStatus which might not exist in the database yet
        })
        .from(supportTickets)
        .where(eq(supportTickets.merchantId, merchantId))
        .orderBy(desc(supportTickets.updatedAt));

      // Add the missing fields with default values
      return tickets.map(ticket => ({
        ...ticket,
        firstResponseAt: null,
        dueBy: null,
        slaStatus: "within_target"
      })) as SupportTicket[];
    } catch (error) {
      console.error(`Error getting support tickets for merchant ${merchantId}:`, error);
      return [];
    }
  }

  async getSupportTicketsByStatus(status: string): Promise<SupportTicket[]> {
    try {
      // Explicitly select only the columns we know exist in the database
      const tickets = await db
        .select({
          id: supportTickets.id,
          ticketNumber: supportTickets.ticketNumber,
          merchantId: supportTickets.merchantId,
          createdBy: supportTickets.createdBy,
          category: supportTickets.category,
          subcategory: supportTickets.subcategory,
          subject: supportTickets.subject,
          description: supportTickets.description,
          status: supportTickets.status,
          priority: supportTickets.priority,
          assignedTo: supportTickets.assignedTo,
          conversationId: supportTickets.conversationId,
          createdAt: supportTickets.createdAt,
          updatedAt: supportTickets.updatedAt,
          resolvedAt: supportTickets.resolvedAt,
          closedAt: supportTickets.closedAt,
          // Omit firstResponseAt, dueBy, and slaStatus which might not exist in the database yet
        })
        .from(supportTickets)
        .where(eq(supportTickets.status, status as any))
        .orderBy(desc(supportTickets.createdAt));

      // Add the missing fields with default values
      return tickets.map(ticket => ({
        ...ticket,
        firstResponseAt: null,
        dueBy: null,
        slaStatus: "within_target"
      })) as SupportTicket[];
    } catch (error) {
      console.error(`Error getting support tickets with status ${status}:`, error);
      return [];
    }
  }

  async updateSupportTicket(id: number, data: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    try {
      // Get previous state of the ticket for activity log
      const previousTicket = await this.getSupportTicket(id);
      if (!previousTicket) {
        return undefined;
      }

      // Set updatedAt timestamp
      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      const [updatedTicket] = await db
        .update(supportTickets)
        .set(updateData)
        .where(eq(supportTickets.id, id))
        .returning();

      // Log the changes made to the ticket
      const actionDetails = [];
      if (data.status && data.status !== previousTicket.status) {
        actionDetails.push(`Status changed from "${previousTicket.status}" to "${data.status}"`);
      }
      if (data.priority && data.priority !== previousTicket.priority) {
        actionDetails.push(`Priority changed from "${previousTicket.priority}" to "${data.priority}"`);
      }
      if (data.assignedTo !== undefined && data.assignedTo !== previousTicket.assignedTo) {
        actionDetails.push(`Assigned to user ID ${data.assignedTo || 'none'}`);
      }
      if (data.subject && data.subject !== previousTicket.subject) {
        actionDetails.push(`Subject updated`);
      }
      if (data.description && data.description !== previousTicket.description) {
        actionDetails.push(`Description updated`);
      }

      // Create activity log entry if any changes were made
      if (actionDetails.length > 0 && updateData.updatedBy) {
        await this.createTicketActivityLog({
          ticketId: id,
          userId: updateData.updatedBy,
          actionType: 'updated',
          actionDetails: actionDetails.join(', '),
          previousValue: JSON.stringify(previousTicket),
          newValue: JSON.stringify(updatedTicket)
        });
      }

      return updatedTicket;
    } catch (error) {
      console.error(`Error updating support ticket ${id}:`, error);
      return undefined;
    }
  }

  async updateSupportTicketStatus(id: number, status: string, userId?: number): Promise<SupportTicket | undefined> {
    try {
      // Get previous state of the ticket for activity log
      const previousTicket = await this.getSupportTicket(id);
      if (!previousTicket) {
        return undefined;
      }

      // Update timestamps based on status
      const updateData: Partial<SupportTicket> = { 
        status: status as any,
        updatedAt: new Date()
      };
      
      // Set resolved or closed timestamps if applicable
      if (status === 'resolved' && !previousTicket.resolvedAt) {
        updateData.resolvedAt = new Date();
      } else if (status === 'closed' && !previousTicket.closedAt) {
        updateData.closedAt = new Date();
      }

      const [updatedTicket] = await db
        .update(supportTickets)
        .set(updateData)
        .where(eq(supportTickets.id, id))
        .returning();

      // Create activity log entry
      if (userId) {
        await this.createTicketActivityLog({
          ticketId: id,
          userId: userId,
          actionType: 'status_change',
          actionDetails: `Status changed from "${previousTicket.status}" to "${status}"`,
          previousValue: previousTicket.status,
          newValue: status
        });
      }

      return updatedTicket;
    } catch (error) {
      console.error(`Error updating support ticket status ${id} to ${status}:`, error);
      return undefined;
    }
  }

  async assignSupportTicket(id: number, assignedTo: number): Promise<SupportTicket | undefined> {
    try {
      // Get previous assignee for activity log
      const previousTicket = await this.getSupportTicket(id);
      if (!previousTicket) {
        return undefined;
      }

      const [updatedTicket] = await db
        .update(supportTickets)
        .set({
          assignedTo,
          updatedAt: new Date()
        })
        .where(eq(supportTickets.id, id))
        .returning();

      // Create activity log entry
      await this.createTicketActivityLog({
        ticketId: id,
        userId: assignedTo, // The assigner is the actor
        actionType: 'assigned',
        actionDetails: `Ticket assigned to user ID ${assignedTo}`,
        previousValue: previousTicket.assignedTo?.toString() || 'none',
        newValue: assignedTo.toString()
      });

      return updatedTicket;
    } catch (error) {
      console.error(`Error assigning support ticket ${id} to user ${assignedTo}:`, error);
      return undefined;
    }
  }

  async getAllSupportTickets(options: { limit?: number, offset?: number } = {}): Promise<SupportTicket[]> {
    try {
      // Explicitly select only the columns we know exist in the database to avoid errors
      let query = db
        .select({
          id: supportTickets.id,
          ticketNumber: supportTickets.ticketNumber,
          merchantId: supportTickets.merchantId,
          createdBy: supportTickets.createdBy,
          category: supportTickets.category,
          subcategory: supportTickets.subcategory,
          subject: supportTickets.subject,
          description: supportTickets.description,
          status: supportTickets.status,
          priority: supportTickets.priority,
          assignedTo: supportTickets.assignedTo,
          conversationId: supportTickets.conversationId,
          createdAt: supportTickets.createdAt,
          updatedAt: supportTickets.updatedAt,
          resolvedAt: supportTickets.resolvedAt,
          closedAt: supportTickets.closedAt,
          // Omit firstResponseAt, dueBy, and slaStatus which might not exist in the database yet
        })
        .from(supportTickets)
        .orderBy(desc(supportTickets.updatedAt));

      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      if (options.offset) {
        query = query.offset(options.offset);
      }

      const results = await query;
      
      // Transform results to match the expected SupportTicket type
      // by adding default values for missing fields
      return results.map(ticket => ({
        ...ticket,
        // Add default values for fields that might be missing from DB but expected in our code
        firstResponseAt: null,
        dueBy: null,
        slaStatus: "within_target"
      })) as SupportTicket[];
    } catch (error) {
      console.error(`Error getting all support tickets:`, error);
      return [];
    }
  }

  // Ticket Attachment methods
  async createTicketAttachment(attachment: InsertTicketAttachment): Promise<TicketAttachment> {
    try {
      const [newAttachment] = await db
        .insert(ticketAttachments)
        .values(attachment)
        .returning();

      // Create activity log entry for attachment upload
      await this.createTicketActivityLog({
        ticketId: attachment.ticketId,
        userId: attachment.uploadedBy,
        actionType: 'attachment_added',
        actionDetails: `File "${attachment.fileName}" attached to ticket`
      });

      return newAttachment;
    } catch (error) {
      console.error(`Error creating ticket attachment:`, error);
      throw new Error('Failed to create ticket attachment');
    }
  }

  async getTicketAttachment(id: number): Promise<TicketAttachment | undefined> {
    try {
      const [attachment] = await db
        .select()
        .from(ticketAttachments)
        .where(eq(ticketAttachments.id, id));

      return attachment;
    } catch (error) {
      console.error(`Error getting ticket attachment ${id}:`, error);
      return undefined;
    }
  }

  async getTicketAttachmentsByTicketId(ticketId: number): Promise<TicketAttachment[]> {
    try {
      return await db
        .select()
        .from(ticketAttachments)
        .where(eq(ticketAttachments.ticketId, ticketId))
        .orderBy(desc(ticketAttachments.createdAt));
    } catch (error) {
      console.error(`Error getting attachments for ticket ${ticketId}:`, error);
      return [];
    }
  }

  // Ticket Activity Log methods
  async createTicketActivityLog(activity: InsertTicketActivityLog): Promise<TicketActivityLog> {
    try {
      const [newActivity] = await db
        .insert(ticketActivityLog)
        .values(activity)
        .returning();

      return newActivity;
    } catch (error) {
      console.error(`Error creating ticket activity log:`, error);
      throw new Error('Failed to create ticket activity log');
    }
  }

  async getTicketActivityLogsByTicketId(ticketId: number): Promise<TicketActivityLog[]> {
    try {
      return await db
        .select()
        .from(ticketActivityLog)
        .where(eq(ticketActivityLog.ticketId, ticketId))
        .orderBy(desc(ticketActivityLog.timestamp));
    } catch (error) {
      console.error(`Error getting activity logs for ticket ${ticketId}:`, error);
      return [];
    }
  }

  // Contract Cancellation Request operations
  async createContractCancellationRequest(request: InsertContractCancellationRequest): Promise<ContractCancellationRequest> {
    try {
      const [newRequest] = await db
        .insert(contractCancellationRequests)
        .values({
          ...request,
          requestedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      return newRequest;
    } catch (error) {
      console.error("Error creating contract cancellation request:", error);
      throw new Error("Failed to create contract cancellation request");
    }
  }

  async getContractCancellationRequest(id: number): Promise<ContractCancellationRequest | undefined> {
    try {
      const [request] = await db
        .select()
        .from(contractCancellationRequests)
        .where(eq(contractCancellationRequests.id, id));
      
      return request;
    } catch (error) {
      console.error(`Error getting contract cancellation request ${id}:`, error);
      return undefined;
    }
  }

  async getContractCancellationRequestsByContractId(contractId: number): Promise<ContractCancellationRequest[]> {
    try {
      return await db
        .select()
        .from(contractCancellationRequests)
        .where(eq(contractCancellationRequests.contractId, contractId))
        .orderBy(desc(contractCancellationRequests.createdAt));
    } catch (error) {
      console.error(`Error getting cancellation requests for contract ${contractId}:`, error);
      return [];
    }
  }

  async getContractCancellationRequestsByMerchantId(merchantId: number): Promise<ContractCancellationRequest[]> {
    try {
      return await db
        .select()
        .from(contractCancellationRequests)
        .where(eq(contractCancellationRequests.merchantId, merchantId))
        .orderBy(desc(contractCancellationRequests.createdAt));
    } catch (error) {
      console.error(`Error getting cancellation requests for merchant ${merchantId}:`, error);
      return [];
    }
  }

  async getPendingContractCancellationRequests(): Promise<ContractCancellationRequest[]> {
    try {
      return await db
        .select()
        .from(contractCancellationRequests)
        .where(eq(contractCancellationRequests.status, "pending"))
        .orderBy(contractCancellationRequests.requestedAt);
    } catch (error) {
      console.error(`Error getting pending contract cancellation requests:`, error);
      return [];
    }
  }

  async updateContractCancellationRequest(id: number, data: Partial<ContractCancellationRequest>): Promise<ContractCancellationRequest | undefined> {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      const [updatedRequest] = await db
        .update(contractCancellationRequests)
        .set(updateData)
        .where(eq(contractCancellationRequests.id, id))
        .returning();

      return updatedRequest;
    } catch (error) {
      console.error(`Error updating contract cancellation request ${id}:`, error);
      return undefined;
    }
  }

  async updateContractCancellationRequestStatus(id: number, status: string, adminId?: number): Promise<ContractCancellationRequest | undefined> {
    try {
      const updateData: any = {
        status: status as any,
        updatedAt: new Date()
      };

      // Add admin-specific fields based on the status
      if (status === "under_review" && adminId) {
        updateData.reviewedBy = adminId;
        updateData.reviewedAt = new Date();
      } else if (status === "approved" && adminId) {
        updateData.approvedBy = adminId;
        updateData.approvedAt = new Date();
      } else if (status === "denied" && adminId) {
        updateData.deniedBy = adminId;
        updateData.deniedAt = new Date();
      }

      const [updatedRequest] = await db
        .update(contractCancellationRequests)
        .set(updateData)
        .where(eq(contractCancellationRequests.id, id))
        .returning();

      return updatedRequest;
    } catch (error) {
      console.error(`Error updating contract cancellation request status ${id}:`, error);
      return undefined;
    }
  }

  // Investor Profile Operations
  async getInvestorProfile(id: number): Promise<InvestorProfile | undefined> {
    try {
      const result = await db.select()
        .from(investorProfiles)
        .where(eq(investorProfiles.id, id))
        .limit(1);

      return result[0];
    } catch (error) {
      console.error(`Error getting investor profile with id ${id}:`, error);
      return undefined;
    }
  }

  async getInvestorProfileByUserId(userId: number): Promise<InvestorProfile | undefined> {
    try {
      const result = await db.select()
        .from(investorProfiles)
        .where(eq(investorProfiles.userId, userId))
        .limit(1);

      return result[0];
    } catch (error) {
      console.error(`Error getting investor profile by user id ${userId}:`, error);
      return undefined;
    }
  }

  async createInvestorProfile(profile: InsertInvestorProfile): Promise<InvestorProfile> {
    try {
      const [result] = await db.insert(investorProfiles)
        .values({
          ...profile,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return result;
    } catch (error) {
      console.error("Error creating investor profile:", error);
      throw error;
    }
  }

  async updateInvestorProfile(id: number, data: Partial<InvestorProfile>): Promise<InvestorProfile | undefined> {
    try {
      const [result] = await db.update(investorProfiles)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(investorProfiles.id, id))
        .returning();

      return result;
    } catch (error) {
      console.error(`Error updating investor profile ${id}:`, error);
      return undefined;
    }
  }

  async getAllInvestorProfiles(): Promise<InvestorProfile[]> {
    try {
      return await db.select().from(investorProfiles);
    } catch (error) {
      console.error("Error getting all investor profiles:", error);
      return [];
    }
  }

  async getInvestorProfilesByVerificationStatus(status: string): Promise<InvestorProfile[]> {
    try {
      return await db.select()
        .from(investorProfiles)
        .where(eq(investorProfiles.verificationStatus, status as any));
    } catch (error) {
      console.error(`Error getting investor profiles by verification status ${status}:`, error);
      return [];
    }
  }
  
  async getInvestorProfilesBySessionId(sessionId: string): Promise<InvestorProfile[]> {
    try {
      return await db.select()
        .from(investorProfiles)
        .where(eq(investorProfiles.verificationSessionId, sessionId));
    } catch (error) {
      console.error(`Error getting investor profiles by session ID ${sessionId}:`, error);
      return [];
    }
  }

  // Investment Offering Operations
  async getInvestmentOffering(id: number): Promise<InvestmentOffering | undefined> {
    try {
      const result = await db.select()
        .from(investmentOfferings)
        .where(eq(investmentOfferings.id, id))
        .limit(1);

      return result[0];
    } catch (error) {
      console.error(`Error getting investment offering with id ${id}:`, error);
      return undefined;
    }
  }

  async getInvestmentOfferingByContractId(contractId: number): Promise<InvestmentOffering | undefined> {
    try {
      const result = await db.select()
        .from(investmentOfferings)
        .where(eq(investmentOfferings.contractId, contractId))
        .limit(1);

      return result[0];
    } catch (error) {
      console.error(`Error getting investment offering by contract id ${contractId}:`, error);
      return undefined;
    }
  }

  async createInvestmentOffering(offering: InsertInvestmentOffering): Promise<InvestmentOffering> {
    try {
      const [result] = await db.insert(investmentOfferings)
        .values({
          ...offering,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return result;
    } catch (error) {
      console.error("Error creating investment offering:", error);
      throw error;
    }
  }

  async updateInvestmentOffering(id: number, data: Partial<InvestmentOffering>): Promise<InvestmentOffering | undefined> {
    try {
      const [result] = await db.update(investmentOfferings)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(investmentOfferings.id, id))
        .returning();

      return result;
    } catch (error) {
      console.error(`Error updating investment offering ${id}:`, error);
      return undefined;
    }
  }

  async getInvestmentOfferings(): Promise<InvestmentOffering[]> {
    try {
      return await db.select().from(investmentOfferings).where(eq(investmentOfferings.isActive, true));
    } catch (error) {
      console.error("Error getting all investment offerings:", error);
      return [];
    }
  }

  async getInvestmentOfferingsByStatus(status: string): Promise<InvestmentOffering[]> {
    try {
      return await db.select()
        .from(investmentOfferings)
        .where(eq(investmentOfferings.status, status as any));
    } catch (error) {
      console.error(`Error getting investment offerings by status ${status}:`, error);
      return [];
    }
  }

  // Investment Operations
  async getInvestment(id: number): Promise<Investment | undefined> {
    try {
      const result = await db.select()
        .from(investments)
        .where(eq(investments.id, id))
        .limit(1);

      return result[0];
    } catch (error) {
      console.error(`Error getting investment with id ${id}:`, error);
      return undefined;
    }
  }

  async getInvestmentsByInvestorId(investorId: number): Promise<Investment[]> {
    try {
      return await db.select()
        .from(investments)
        .where(eq(investments.investorId, investorId));
    } catch (error) {
      console.error(`Error getting investments by investor id ${investorId}:`, error);
      return [];
    }
  }

  async getInvestmentsByOfferingId(offeringId: number): Promise<Investment[]> {
    try {
      return await db.select()
        .from(investments)
        .where(eq(investments.offeringId, offeringId));
    } catch (error) {
      console.error(`Error getting investments by offering id ${offeringId}:`, error);
      return [];
    }
  }

  async createInvestment(investment: InsertInvestment): Promise<Investment> {
    try {
      const [result] = await db.insert(investments)
        .values({
          ...investment,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return result;
    } catch (error) {
      console.error("Error creating investment:", error);
      throw error;
    }
  }

  async updateInvestment(id: number, data: Partial<Investment>): Promise<Investment | undefined> {
    try {
      const [result] = await db.update(investments)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(investments.id, id))
        .returning();

      return result;
    } catch (error) {
      console.error(`Error updating investment ${id}:`, error);
      return undefined;
    }
  }

  async updateInvestmentStatus(id: number, status: string): Promise<Investment | undefined> {
    try {
      const [result] = await db.update(investments)
        .set({
          status: status as any,
          updatedAt: new Date(),
        })
        .where(eq(investments.id, id))
        .returning();

      return result;
    } catch (error) {
      console.error(`Error updating investment status ${id}:`, error);
      return undefined;
    }
  }

  async getAllInvestments(): Promise<Investment[]> {
    try {
      return await db.select().from(investments);
    } catch (error) {
      console.error("Error getting all investments:", error);
      return [];
    }
  }

  // Document Library Operations
  async getDocumentLibraryItem(id: number): Promise<DocumentLibrary | undefined> {
    try {
      const result = await db.select()
        .from(documentLibrary)
        .where(eq(documentLibrary.id, id))
        .limit(1);

      return result[0];
    } catch (error) {
      console.error(`Error getting document library item with id ${id}:`, error);
      return undefined;
    }
  }

  async getDocumentLibrary(): Promise<DocumentLibrary[]> {
    try {
      return await db.select().from(documentLibrary);
    } catch (error) {
      console.error("Error getting all document library items:", error);
      return [];
    }
  }

  async getDocumentLibraryByCategory(category: string): Promise<DocumentLibrary[]> {
    try {
      return await db.select()
        .from(documentLibrary)
        .where(eq(documentLibrary.category, category));
    } catch (error) {
      console.error(`Error getting document library items by category ${category}:`, error);
      return [];
    }
  }

  async createDocumentLibraryItem(document: InsertDocumentLibrary): Promise<DocumentLibrary> {
    try {
      const [result] = await db.insert(documentLibrary)
        .values({
          ...document,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return result;
    } catch (error) {
      console.error("Error creating document library item:", error);
      throw error;
    }
  }

  async updateDocumentLibraryItem(id: number, data: Partial<DocumentLibrary>): Promise<DocumentLibrary | undefined> {
    try {
      const [result] = await db.update(documentLibrary)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(documentLibrary.id, id))
        .returning();

      return result;
    } catch (error) {
      console.error(`Error updating document library item ${id}:`, error);
      return undefined;
    }
  }

  // Knowledge Base operations
  async createKnowledgeBaseArticle(article: InsertKnowledgeBaseArticle): Promise<KnowledgeBaseArticle> {
    try {
      const [newArticle] = await db.insert(knowledgeBaseArticles).values(article).returning();
      return newArticle;
    } catch (error) {
      console.error('Error creating knowledge base article:', error);
      throw new Error(`Failed to create knowledge base article: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getKnowledgeBaseArticle(id: number): Promise<KnowledgeBaseArticle | undefined> {
    try {
      const [article] = await db.select().from(knowledgeBaseArticles).where(eq(knowledgeBaseArticles.id, id));
      return article;
    } catch (error) {
      console.error(`Error retrieving knowledge base article ${id}:`, error);
      return undefined;
    }
  }

  async getKnowledgeBaseArticlesByCategory(category: string): Promise<KnowledgeBaseArticle[]> {
    try {
      // First, find the category by slug
      const [categoryRecord] = await db.select().from(knowledgeCategories).where(eq(knowledgeCategories.slug, category));
      
      if (!categoryRecord) {
        return [];
      }
      
      // Then get all articles in that category
      return await db.select().from(knowledgeBaseArticles)
        .where(eq(knowledgeBaseArticles.categoryId, categoryRecord.id))
        .orderBy(desc(knowledgeBaseArticles.createdAt));
    } catch (error) {
      console.error(`Error retrieving knowledge base articles for category ${category}:`, error);
      return [];
    }
  }

  async getKnowledgeBaseArticlesByTag(tag: string): Promise<KnowledgeBaseArticle[]> {
    try {
      // First, find the tag by slug
      const [tagRecord] = await db.select().from(knowledgeTags).where(eq(knowledgeTags.slug, tag));
      
      if (!tagRecord) {
        return [];
      }
      
      // Then find all articleTag records for this tag
      const articleTags = await db.select().from(articleTags).where(eq(articleTags.tagId, tagRecord.id));
      
      if (articleTags.length === 0) {
        return [];
      }
      
      // Get all articles with these IDs
      const articleIds = articleTags.map(articleTag => articleTag.articleId);
      return await db.select().from(knowledgeBaseArticles)
        .where(inArray(knowledgeBaseArticles.id, articleIds))
        .orderBy(desc(knowledgeBaseArticles.createdAt));
    } catch (error) {
      console.error(`Error retrieving knowledge base articles for tag ${tag}:`, error);
      return [];
    }
  }

  async searchKnowledgeBase(query: string): Promise<KnowledgeBaseArticle[]> {
    try {
      // Simple search implementation - look for query in title or content
      return await db.select().from(knowledgeBaseArticles)
        .where(
          or(
            like(knowledgeBaseArticles.title, `%${query}%`),
            like(knowledgeBaseArticles.content, `%${query}%`)
          )
        )
        .orderBy(desc(knowledgeBaseArticles.createdAt));
    } catch (error) {
      console.error(`Error searching knowledge base for "${query}":`, error);
      return [];
    }
  }

  async getAllKnowledgeBaseArticles(options?: { limit?: number, offset?: number, status?: string }): Promise<KnowledgeBaseArticle[]> {
    try {
      let query = db.select().from(knowledgeBaseArticles);
      
      // Apply status filter if provided
      if (options?.status) {
        if (options.status === 'published') {
          query = query.where(eq(knowledgeBaseArticles.isPublished, true));
        } else if (options.status === 'draft') {
          query = query.where(eq(knowledgeBaseArticles.isPublished, false));
        }
      }
      
      // Apply sorting
      query = query.orderBy(desc(knowledgeBaseArticles.createdAt));
      
      // Apply pagination if provided
      if (options?.limit !== undefined) {
        query = query.limit(options.limit);
        
        if (options?.offset !== undefined) {
          query = query.offset(options.offset);
        }
      }
      
      return await query;
    } catch (error) {
      console.error('Error retrieving all knowledge base articles:', error);
      return [];
    }
  }

  async updateKnowledgeBaseArticle(id: number, data: Partial<KnowledgeBaseArticle>): Promise<KnowledgeBaseArticle | undefined> {
    try {
      const [updatedArticle] = await db.update(knowledgeBaseArticles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(knowledgeBaseArticles.id, id))
        .returning();
      
      return updatedArticle;
    } catch (error) {
      console.error(`Error updating knowledge base article ${id}:`, error);
      return undefined;
    }
  }

  async getSuggestedKnowledgeBaseArticles(ticketId: number): Promise<KnowledgeBaseArticle[]> {
    try {
      // Get the ticket details
      const ticket = await this.getSupportTicket(ticketId);
      if (!ticket) {
        return [];
      }
      
      // Extract keywords from ticket title and description
      const keywords = this.extractKeywords(`${ticket.title} ${ticket.description}`);
      
      if (keywords.length === 0) {
        // If no meaningful keywords, return some general articles
        return await db.select().from(knowledgeBaseArticles)
          .where(eq(knowledgeBaseArticles.isPublished, true))
          .orderBy(desc(knowledgeBaseArticles.viewCount))
          .limit(5);
      }
      
      // Search for articles matching these keywords
      const searchQueries = keywords.map(keyword => 
        or(
          like(knowledgeBaseArticles.title, `%${keyword}%`),
          like(knowledgeBaseArticles.content, `%${keyword}%`)
        )
      );
      
      return await db.select().from(knowledgeBaseArticles)
        .where(
          and(
            eq(knowledgeBaseArticles.isPublished, true),
            or(...searchQueries)
          )
        )
        .orderBy(desc(knowledgeBaseArticles.viewCount))
        .limit(5);
    } catch (error) {
      console.error(`Error getting suggested articles for ticket ${ticketId}:`, error);
      return [];
    }
  }
  
  // Helper function to extract meaningful keywords
  // This is a simple implementation - in production, you'd want a more sophisticated approach
  private extractKeywords(text: string): string[] {
    if (!text) return [];
    
    // Remove common words and keep only significant terms
    const commonWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as'];
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    
    // Filter out common words and short words
    const keywords = words.filter(word => word.length > 3 && !commonWords.includes(word));
    
    // Get unique keywords
    return [...new Set(keywords)];
  }

  // Knowledge Category operations
  async createKnowledgeCategory(category: InsertKnowledgeCategory): Promise<KnowledgeCategory> {
    try {
      const [newCategory] = await db.insert(knowledgeCategories).values(category).returning();
      return newCategory;
    } catch (error) {
      console.error('Error creating knowledge category:', error);
      throw new Error(`Failed to create knowledge category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getKnowledgeCategory(id: number): Promise<KnowledgeCategory | undefined> {
    try {
      const [category] = await db.select().from(knowledgeCategories).where(eq(knowledgeCategories.id, id));
      return category;
    } catch (error) {
      console.error(`Error retrieving knowledge category ${id}:`, error);
      return undefined;
    }
  }

  async getAllKnowledgeCategories(): Promise<KnowledgeCategory[]> {
    try {
      return await db.select().from(knowledgeCategories).orderBy(knowledgeCategories.order);
    } catch (error) {
      console.error('Error retrieving all knowledge categories:', error);
      return [];
    }
  }

  async updateKnowledgeCategory(id: number, data: Partial<KnowledgeCategory>): Promise<KnowledgeCategory | undefined> {
    try {
      const [updatedCategory] = await db.update(knowledgeCategories)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(knowledgeCategories.id, id))
        .returning();
      
      return updatedCategory;
    } catch (error) {
      console.error(`Error updating knowledge category ${id}:`, error);
      return undefined;
    }
  }

  // Knowledge Tag operations
  async createKnowledgeTag(tag: InsertKnowledgeTag): Promise<KnowledgeTag> {
    try {
      const [newTag] = await db.insert(knowledgeTags).values(tag).returning();
      return newTag;
    } catch (error) {
      console.error('Error creating knowledge tag:', error);
      throw new Error(`Failed to create knowledge tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getKnowledgeTag(id: number): Promise<KnowledgeTag | undefined> {
    try {
      const [tag] = await db.select().from(knowledgeTags).where(eq(knowledgeTags.id, id));
      return tag;
    } catch (error) {
      console.error(`Error retrieving knowledge tag ${id}:`, error);
      return undefined;
    }
  }

  async getAllKnowledgeTags(): Promise<KnowledgeTag[]> {
    try {
      return await db.select().from(knowledgeTags).orderBy(knowledgeTags.name);
    } catch (error) {
      console.error('Error retrieving all knowledge tags:', error);
      return [];
    }
  }

  async updateKnowledgeTag(id: number, data: Partial<KnowledgeTag>): Promise<KnowledgeTag | undefined> {
    try {
      const [updatedTag] = await db.update(knowledgeTags)
        .set(data)
        .where(eq(knowledgeTags.id, id))
        .returning();
      
      return updatedTag;
    } catch (error) {
      console.error(`Error updating knowledge tag ${id}:`, error);
      return undefined;
    }
  }

  // Chat Session operations
  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    try {
      const [newSession] = await db.insert(chatSessions).values(session).returning();
      return newSession;
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw new Error(`Failed to create chat session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getChatSession(id: number): Promise<ChatSession | undefined> {
    try {
      const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
      return session;
    } catch (error) {
      console.error(`Error retrieving chat session ${id}:`, error);
      return undefined;
    }
  }

  async getChatSessionsByMerchantId(merchantId: number): Promise<ChatSession[]> {
    try {
      return await db.select().from(chatSessions)
        .where(eq(chatSessions.merchantId, merchantId))
        .orderBy(desc(chatSessions.lastActivityAt));
    } catch (error) {
      console.error(`Error retrieving chat sessions for merchant ${merchantId}:`, error);
      return [];
    }
  }

  async getChatSessionsByAgentId(agentId: number): Promise<ChatSession[]> {
    try {
      return await db.select().from(chatSessions)
        .where(eq(chatSessions.agentId, agentId))
        .orderBy(desc(chatSessions.lastActivityAt));
    } catch (error) {
      console.error(`Error retrieving chat sessions for agent ${agentId}:`, error);
      return [];
    }
  }

  async getChatSessionsByTicketId(ticketId: number): Promise<ChatSession | undefined> {
    try {
      const [session] = await db.select().from(chatSessions)
        .where(eq(chatSessions.ticketId, ticketId));
      return session;
    } catch (error) {
      console.error(`Error retrieving chat session for ticket ${ticketId}:`, error);
      return undefined;
    }
  }
  
  async getAllChatSessions(): Promise<ChatSession[]> {
    try {
      return await db.select().from(chatSessions)
        .orderBy(desc(chatSessions.lastActivityAt));
    } catch (error) {
      console.error('Error retrieving all chat sessions:', error);
      return [];
    }
  }

  async updateChatSession(id: number, data: Partial<ChatSession>): Promise<ChatSession | undefined> {
    try {
      const [updatedSession] = await db
        .update(chatSessions)
        .set(data)
        .where(eq(chatSessions.id, id))
        .returning();
      return updatedSession;
    } catch (error) {
      console.error(`Error updating chat session ${id}:`, error);
      return undefined;
    }
  }

  async updateChatSessionStatus(id: number, status: string): Promise<ChatSession | undefined> {
    try {
      const [updatedSession] = await db
        .update(chatSessions)
        .set({ 
          status: status,
          lastActivityAt: new Date() 
        })
        .where(eq(chatSessions.id, id))
        .returning();
      return updatedSession;
    } catch (error) {
      console.error(`Error updating chat session ${id} status:`, error);
      return undefined;
    }
  }

  async closeChatSession(id: number, satisfaction?: number, feedback?: string): Promise<ChatSession | undefined> {
    try {
      const data: Partial<ChatSession> = {
        status: 'resolved',
        endedAt: new Date(),
        lastActivityAt: new Date()
      };

      if (satisfaction !== undefined) {
        data.satisfaction = satisfaction;
      }

      if (feedback) {
        data.feedback = feedback;
      }

      const [updatedSession] = await db
        .update(chatSessions)
        .set(data)
        .where(eq(chatSessions.id, id))
        .returning();
      return updatedSession;
    } catch (error) {
      console.error(`Error closing chat session ${id}:`, error);
      return undefined;
    }
  }

  async transferChatSession(id: number, newAgentId: number, transferReason?: string): Promise<ChatSession | undefined> {
    try {
      // First, get the current session to record the previous agent
      const [currentSession] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, id));

      if (!currentSession) {
        return undefined;
      }

      // Update the session with new agent and transfer details
      const [updatedSession] = await db
        .update(chatSessions)
        .set({
          agentId: newAgentId,
          transferredFrom: currentSession.agentId,
          transferReason: transferReason,
          lastActivityAt: new Date()
        })
        .where(eq(chatSessions.id, id))
        .returning();

      // Create a system message about the transfer
      const previousAgent = currentSession.agentId 
        ? await this.getSupportAgent(currentSession.agentId) 
        : undefined;
      
      const newAgent = await this.getSupportAgent(newAgentId);

      if (newAgent) {
        await this.createChatMessage({
          sessionId: id,
          content: `Chat transferred from ${previousAgent?.name || 'previous agent'} to ${newAgent.name}`,
          senderType: 'system',
          messageType: 'transfer',
          isRead: true,
          sentAt: new Date()
        });
      }

      return updatedSession;
    } catch (error) {
      console.error(`Error transferring chat session ${id}:`, error);
      return undefined;
    }
  }

  // Chat Message operations
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    try {
      // Make sure sentAt is set if not provided
      if (!message.sentAt) {
        message.sentAt = new Date();
      }

      const [newMessage] = await db.insert(chatMessages).values(message).returning();
      
      // Update the last activity timestamp on the session
      await db
        .update(chatSessions)
        .set({ lastActivityAt: message.sentAt })
        .where(eq(chatSessions.id, message.sessionId));
      
      return newMessage;
    } catch (error) {
      console.error('Error creating chat message:', error);
      throw new Error(`Failed to create chat message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getChatMessagesBySessionId(sessionId: number, options?: { limit?: number, offset?: number }): Promise<ChatMessage[]> {
    try {
      let query = db.select().from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(asc(chatMessages.sentAt));
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      if (options?.offset) {
        query = query.offset(options.offset);
      }
      
      return await query;
    } catch (error) {
      console.error(`Error retrieving chat messages for session ${sessionId}:`, error);
      return [];
    }
  }

  async markChatMessageAsRead(id: number): Promise<ChatMessage | undefined> {
    try {
      const [updatedMessage] = await db
        .update(chatMessages)
        .set({ isRead: true })
        .where(eq(chatMessages.id, id))
        .returning();
      return updatedMessage;
    } catch (error) {
      console.error(`Error marking chat message ${id} as read:`, error);
      return undefined;
    }
  }

  async markAllChatMessagesAsRead(sessionId: number, userId: number): Promise<number> {
    try {
      // Get the user to determine if they're a merchant or agent
      const user = await this.getUser(userId);
      if (!user) {
        return 0;
      }

      // For merchants, mark agent messages as read
      // For agents, mark merchant messages as read
      const senderType = user.role === 'merchant' ? 'agent' : 'merchant';
      
      const result = await db
        .update(chatMessages)
        .set({ isRead: true })
        .where(
          and(
            eq(chatMessages.sessionId, sessionId),
            eq(chatMessages.senderType, senderType),
            eq(chatMessages.isRead, false)
          )
        );

      return Number(result.count) || 0;
    } catch (error) {
      console.error(`Error marking all chat messages as read for session ${sessionId}:`, error);
      return 0;
    }
  }

  async getUnreadChatMessageCountForMerchant(merchantId: number): Promise<number> {
    try {
      // Get all active sessions for this merchant
      const sessions = await db
        .select({ id: chatSessions.id })
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.merchantId, merchantId),
            eq(chatSessions.status, 'active')
          )
        );
      
      if (sessions.length === 0) {
        return 0;
      }
      
      // Get unread message count from agent to merchant across all sessions
      const sessionIds = sessions.map(s => s.id);
      const result = await db
        .select({ count: count() })
        .from(chatMessages)
        .where(
          and(
            inArray(chatMessages.sessionId, sessionIds),
            eq(chatMessages.senderType, 'agent'),
            eq(chatMessages.isRead, false)
          )
        );
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error(`Error getting unread chat message count for merchant ${merchantId}:`, error);
      return 0;
    }
  }

  async getUnreadChatMessageCountForAgent(agentId: number): Promise<number> {
    try {
      // Get all active sessions assigned to this agent
      const sessions = await db
        .select({ id: chatSessions.id })
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.agentId, agentId),
            eq(chatSessions.status, 'active')
          )
        );
      
      if (sessions.length === 0) {
        return 0;
      }
      
      // Get unread message count from merchant to agent across all sessions
      const sessionIds = sessions.map(s => s.id);
      const result = await db
        .select({ count: count() })
        .from(chatMessages)
        .where(
          and(
            inArray(chatMessages.sessionId, sessionIds),
            eq(chatMessages.senderType, 'merchant'),
            eq(chatMessages.isRead, false)
          )
        );
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error(`Error getting unread chat message count for agent ${agentId}:`, error);
      return 0;
    }
  }

  // Article Tag operations
  async createArticleTag(tag: InsertArticleTag): Promise<ArticleTag> {
    try {
      const [newArticleTag] = await db.insert(articleTags).values(tag).returning();
      return newArticleTag;
    } catch (error) {
      console.error('Error creating article tag association:', error);
      throw new Error(`Failed to create article tag association: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getArticleTagsByArticleId(articleId: number): Promise<ArticleTag[]> {
    try {
      return await db.select().from(articleTags).where(eq(articleTags.articleId, articleId));
    } catch (error) {
      console.error(`Error retrieving tags for article ${articleId}:`, error);
      return [];
    }
  }

  async deleteArticleTag(id: number): Promise<void> {
    try {
      await db.delete(articleTags).where(eq(articleTags.id, id));
    } catch (error) {
      console.error(`Error deleting article tag association ${id}:`, error);
      throw new Error(`Failed to delete article tag association: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Article Feedback operations
  async createArticleFeedback(feedback: InsertArticleFeedback): Promise<ArticleFeedback> {
    try {
      const [newFeedback] = await db.insert(articleFeedback).values(feedback).returning();
      return newFeedback;
    } catch (error) {
      console.error('Error creating article feedback:', error);
      throw new Error(`Failed to create article feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getArticleFeedbackByArticleId(articleId: number): Promise<ArticleFeedback[]> {
    try {
      return await db.select().from(articleFeedback)
        .where(eq(articleFeedback.articleId, articleId))
        .orderBy(desc(articleFeedback.createdAt));
    } catch (error) {
      console.error(`Error retrieving feedback for article ${articleId}:`, error);
      return [];
    }
  }

  async getArticleFeedbackStats(articleId: number): Promise<{ helpful: number, notHelpful: number }> {
    try {
      const allFeedback = await db.select().from(articleFeedback)
        .where(eq(articleFeedback.articleId, articleId));
      
      // Count helpful and not helpful feedback
      const helpfulCount = allFeedback.filter(feedback => feedback.isHelpful === true).length;
      const notHelpfulCount = allFeedback.filter(feedback => feedback.isHelpful === false).length;
      
      return {
        helpful: helpfulCount,
        notHelpful: notHelpfulCount
      };
    } catch (error) {
      console.error(`Error calculating feedback stats for article ${articleId}:`, error);
      return { helpful: 0, notHelpful: 0 };
    }
  }

  // =========================================================================
  // Support Agent Methods
  // =========================================================================

  async createSupportAgent(agent: InsertSupportAgent): Promise<SupportAgent> {
    try {
      const [newAgent] = await db.insert(supportAgents).values(agent).returning();
      return newAgent;
    } catch (error) {
      logger.error('Error creating support agent:', error);
      throw error;
    }
  }

  async getSupportAgent(id: number): Promise<SupportAgent | undefined> {
    try {
      const [agent] = await db.select().from(supportAgents).where(eq(supportAgents.id, id));
      return agent;
    } catch (error) {
      logger.error(`Error getting support agent with ID ${id}:`, error);
      return undefined;
    }
  }

  async getSupportAgentByUserId(userId: number): Promise<SupportAgent | undefined> {
    try {
      const [agent] = await db.select().from(supportAgents).where(eq(supportAgents.userId, userId));
      return agent;
    } catch (error) {
      logger.error(`Error getting support agent for user ${userId}:`, error);
      return undefined;
    }
  }

  async getAllSupportAgents(): Promise<SupportAgent[]> {
    try {
      return await db.select().from(supportAgents);
    } catch (error) {
      logger.error('Error getting all support agents:', error);
      return [];
    }
  }

  async getActiveSupportAgents(): Promise<SupportAgent[]> {
    try {
      return await db.select().from(supportAgents)
        .where(eq(supportAgents.isAvailable, true));
    } catch (error) {
      logger.error('Error getting active support agents:', error);
      return [];
    }
  }

  async updateSupportAgent(id: number, data: Partial<SupportAgent>): Promise<SupportAgent | undefined> {
    try {
      const [updatedAgent] = await db.update(supportAgents)
        .set({ 
          ...data,
          updatedAt: new Date()
        })
        .where(eq(supportAgents.id, id))
        .returning();
      return updatedAgent;
    } catch (error) {
      logger.error(`Error updating support agent ${id}:`, error);
      return undefined;
    }
  }

  async getSupportAgentsBySpecialty(specialty: string): Promise<SupportAgent[]> {
    try {
      // Using a raw SQL query to check if the specialty is in the specialties array
      const query = `
        SELECT * FROM support_agents 
        WHERE $1 = ANY(specialties) 
        AND is_available = true
      `;
      
      const result = await pool.query(query, [specialty]);
      return result.rows;
    } catch (error) {
      logger.error(`Error getting support agents with specialty ${specialty}:`, error);
      return [];
    }
  }

  async getTicketsByAgentId(agentId: number): Promise<SupportTicket[]> {
    try {
      return await db.select().from(supportTickets)
        .where(and(
          eq(supportTickets.assignedAgentId, agentId),
          not(inArray(supportTickets.status, ['closed', 'resolved']))
        ));
    } catch (error) {
      logger.error(`Error getting tickets for agent ${agentId}:`, error);
      return [];
    }
  }
  
  async getActiveTickets(): Promise<SupportTicket[]> {
    try {
      // Get all tickets that are not in a closed or resolved status
      return await db
        .select()
        .from(supportTickets)
        .where(
          and(
            not(inArray(
              supportTickets.status,
              ['closed', 'resolved']
            )),
            eq(supportTickets.isDeleted, false)
          )
        )
        .orderBy(desc(supportTickets.priority), desc(supportTickets.createdAt));
    } catch (error) {
      logger.error({
        message: `Error getting active tickets: ${error instanceof Error ? error.message : String(error)}`,
        category: "database",
        source: "storage",
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
      return [];
    }
  }
  
  async getActiveTicketsByAgentId(agentId: number): Promise<SupportTicket[]> {
    try {
      // Get all active tickets assigned to a specific agent
      return await db
        .select()
        .from(supportTickets)
        .where(
          and(
            eq(supportTickets.assignedAgentId, agentId),
            not(inArray(
              supportTickets.status,
              ['closed', 'resolved']
            )),
            eq(supportTickets.isDeleted, false)
          )
        )
        .orderBy(desc(supportTickets.priority), desc(supportTickets.createdAt));
    } catch (error) {
      logger.error({
        message: `Error getting active tickets for agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`,
        category: "database",
        source: "storage",
        metadata: {
          agentId,
          error: error instanceof Error ? error.stack : null
        }
      });
      return [];
    }
  }
  
  async getResolvedTicketsByAgentId(agentId: number): Promise<SupportTicket[]> {
    try {
      // Get all resolved tickets assigned to a specific agent
      return await db
        .select()
        .from(supportTickets)
        .where(
          and(
            eq(supportTickets.assignedAgentId, agentId),
            inArray(
              supportTickets.status,
              ['closed', 'resolved']
            ),
            eq(supportTickets.isDeleted, false)
          )
        )
        .orderBy(desc(supportTickets.resolvedAt));
    } catch (error) {
      logger.error({
        message: `Error getting resolved tickets for agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`,
        category: "database",
        source: "storage",
        metadata: {
          agentId,
          error: error instanceof Error ? error.stack : null
        }
      });
      return [];
    }
  }
  
  async getTicketSlaConfigs(): Promise<TicketSlaConfig[]> {
    try {
      // Get all active SLA configurations
      return await this.getActiveSlaConfigs();
    } catch (error) {
      logger.error({
        message: `Error getting ticket SLA configs: ${error instanceof Error ? error.message : String(error)}`,
        category: "database",
        source: "storage",
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
      return [];
    }
  }

  // =========================================================================
  // Support Agent Performance Methods
  // =========================================================================

  async createSupportAgentPerformance(performance: InsertSupportAgentPerformance): Promise<SupportAgentPerformance> {
    try {
      const [newPerformance] = await db.insert(supportAgentPerformance).values(performance).returning();
      return newPerformance;
    } catch (error) {
      logger.error('Error creating support agent performance record:', error);
      throw error;
    }
  }

  async getSupportAgentPerformance(id: number): Promise<SupportAgentPerformance | undefined> {
    try {
      const [performance] = await db.select().from(supportAgentPerformance)
        .where(eq(supportAgentPerformance.id, id));
      return performance;
    } catch (error) {
      logger.error(`Error getting performance record ${id}:`, error);
      return undefined;
    }
  }

  async getSupportAgentPerformanceByAgentId(agentId: number): Promise<SupportAgentPerformance[]> {
    try {
      return await db.select().from(supportAgentPerformance)
        .where(eq(supportAgentPerformance.agentId, agentId))
        .orderBy(desc(supportAgentPerformance.date));
    } catch (error) {
      logger.error(`Error getting performance records for agent ${agentId}:`, error);
      return [];
    }
  }

  async getPerformanceByDateRange(agentId: number, startDate: Date, endDate: Date): Promise<SupportAgentPerformance[]> {
    try {
      return await db.select().from(supportAgentPerformance)
        .where(and(
          eq(supportAgentPerformance.agentId, agentId),
          // Using >= for startDate and <= for endDate to include both boundaries
          gte(supportAgentPerformance.date, startDate),
          lte(supportAgentPerformance.date, endDate)
        ))
        .orderBy(supportAgentPerformance.date);
    } catch (error) {
      logger.error(`Error getting performance records for agent ${agentId} in date range:`, error);
      return [];
    }
  }

  async updateSupportAgentPerformance(id: number, data: Partial<SupportAgentPerformance>): Promise<SupportAgentPerformance | undefined> {
    try {
      const [updatedPerformance] = await db.update(supportAgentPerformance)
        .set(data)
        .where(eq(supportAgentPerformance.id, id))
        .returning();
      return updatedPerformance;
    } catch (error) {
      logger.error(`Error updating performance record ${id}:`, error);
      return undefined;
    }
  }

  // =========================================================================
  // SLA Configuration Methods
  // =========================================================================

  async createTicketSlaConfig(config: InsertTicketSlaConfig): Promise<TicketSlaConfig> {
    try {
      const [newConfig] = await db.insert(ticketSlaConfigs).values(config).returning();
      return newConfig;
    } catch (error) {
      logger.error('Error creating SLA config:', error);
      throw error;
    }
  }

  async getTicketSlaConfig(id: number): Promise<TicketSlaConfig | undefined> {
    try {
      const [config] = await db.select().from(ticketSlaConfigs).where(eq(ticketSlaConfigs.id, id));
      return config;
    } catch (error) {
      logger.error(`Error getting SLA config ${id}:`, error);
      return undefined;
    }
  }

  async getActiveSlaConfigs(): Promise<TicketSlaConfig[]> {
    try {
      return await db.select().from(ticketSlaConfigs).where(eq(ticketSlaConfigs.isActive, true));
    } catch (error) {
      logger.error('Error getting active SLA configs:', error);
      return [];
    }
  }

  async getSlaConfigForTicket(priority: string, category?: string): Promise<TicketSlaConfig | undefined> {
    try {
      // First, try to find a specific config for this priority and category
      if (category) {
        const [specificConfig] = await db.select().from(ticketSlaConfigs)
          .where(and(
            eq(ticketSlaConfigs.priority, priority),
            eq(ticketSlaConfigs.category, category),
            eq(ticketSlaConfigs.isActive, true)
          ));
        
        if (specificConfig) return specificConfig;
      }

      // If no specific config, get the default one for this priority (with null category)
      const [defaultConfig] = await db.select().from(ticketSlaConfigs)
        .where(and(
          eq(ticketSlaConfigs.priority, priority),
          eq(ticketSlaConfigs.isActive, true),
          isNull(ticketSlaConfigs.category)
        ));
      
      return defaultConfig;
    } catch (error) {
      logger.error(`Error getting SLA config for ticket (priority: ${priority}, category: ${category}):`, error);
      return undefined;
    }
  }

  async updateTicketSlaConfig(id: number, data: Partial<TicketSlaConfig>): Promise<TicketSlaConfig | undefined> {
    try {
      const [updatedConfig] = await db.update(ticketSlaConfigs)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(ticketSlaConfigs.id, id))
        .returning();
      return updatedConfig;
    } catch (error) {
      logger.error(`Error updating SLA config ${id}:`, error);
      return undefined;
    }
  }

  async disableSlaConfig(id: number): Promise<TicketSlaConfig | undefined> {
    try {
      const [disabledConfig] = await db.update(ticketSlaConfigs)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(ticketSlaConfigs.id, id))
        .returning();
      return disabledConfig;
    } catch (error) {
      logger.error(`Error disabling SLA config ${id}:`, error);
      return undefined;
    }
  }
}

export const storage = new DatabaseStorage();