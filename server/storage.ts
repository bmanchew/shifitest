import {
  users, User, InsertUser,
  merchants, Merchant, InsertMerchant,
  contracts, Contract, InsertContract,
  applicationProgress, ApplicationProgress, InsertApplicationProgress,
  logs, Log, InsertLog,
  underwritingData,
  assetReports, AssetReport, InsertAssetReport,
  portfolioMonitoring, PortfolioMonitoring, InsertPortfolioMonitoring,
  complaintsData, ComplaintsData, InsertComplaintsData
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Merchant operations
  getMerchant(id: number): Promise<Merchant | undefined>;
  getMerchantByUserId(userId: number): Promise<Merchant | undefined>;
  getAllMerchants(): Promise<Merchant[]>;
  createMerchant(merchant: InsertMerchant): Promise<Merchant>;

  // Contract operations
  getContract(id: number): Promise<Contract | undefined>;
  getContractByNumber(contractNumber: string): Promise<Contract | undefined>;
  getAllContracts(): Promise<Contract[]>;
  getContractsByMerchantId(merchantId: number): Promise<Contract[]>;
  getContractsByCustomerId(customerId: number): Promise<Contract[]>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContractStatus(id: number, status: string): Promise<Contract | undefined>;
  updateContractStep(id: number, step: string): Promise<Contract | undefined>;

  // Application Progress operations
  getApplicationProgress(id: number): Promise<ApplicationProgress | undefined>;
  getApplicationProgressByContractId(contractId: number): Promise<ApplicationProgress[]>;
  createApplicationProgress(progress: InsertApplicationProgress): Promise<ApplicationProgress>;
  updateApplicationProgressCompletion(id: number, completed: boolean, data?: string): Promise<ApplicationProgress | undefined>;

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
  getAssetReportsByContractId(contractId: number): Promise<AssetReport[]>;
  getAssetReportsByAssetReportId(assetReportId: string): Promise<AssetReport[]>;
  updateAssetReportStatus(id: number, status: string, analysisData?: any): Promise<AssetReport | undefined>;
  getLatestPortfolioMonitoring(): Promise<PortfolioMonitoring | null>;
  updatePortfolioMonitoring(data: any): Promise<PortfolioMonitoring>;
  saveComplaintsData(complaints: any[]): Promise<ComplaintsData[]>;
  getComplaintsData(options?: { product?: string; company?: string; limit?: number; offset?: number }): Promise<ComplaintsData[]>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // Merchant methods
  async getMerchant(id: number): Promise<Merchant | undefined> {
    const [merchant] = await db.select().from(merchants).where(eq(merchants.id, id));
    return merchant || undefined;
  }

  async getMerchantByUserId(userId: number): Promise<Merchant | undefined> {
    const [merchant] = await db.select().from(merchants).where(eq(merchants.userId, userId));
    return merchant || undefined;
  }

  async getAllMerchants(): Promise<Merchant[]> {
    return await db.select().from(merchants);
  }

  async createMerchant(merchant: InsertMerchant): Promise<Merchant> {
    const [newMerchant] = await db.insert(merchants).values(merchant).returning();
    return newMerchant;
  }

  // Contract methods
  async getContract(id: number): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract || undefined;
  }

  async getContractByNumber(contractNumber: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.contractNumber, contractNumber));
    return contract || undefined;
  }

  async getAllContracts(): Promise<Contract[]> {
    return await db.select().from(contracts);
  }

  async getContractsByMerchantId(merchantId: number): Promise<Contract[]> {
    return await db.select().from(contracts).where(eq(contracts.merchantId, merchantId));
  }

  async getContractsByCustomerId(customerId: number): Promise<Contract[]> {
    return await db.select().from(contracts).where(eq(contracts.customerId, customerId));
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const [newContract] = await db.insert(contracts).values(contract).returning();
    return newContract;
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
    return await db.select().from(underwritingData).where(eq(underwritingData.contractId, contractId));
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

  async getContractsByStatus(status: string) {
    return await db.select().from(contracts).where(eq(contracts.status, status));
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

  async getAssetReportsByContractId(contractId: number) {
    return await db.select().from(assetReports).where(eq(assetReports.contractId, contractId)).orderBy(desc(assetReports.createdAt));
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
          currentStep: "completed" as const
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
          currentStep: "terms" as const
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
          currentStep: "kyc" as const
        }
      ];

      await Promise.all(contractsData.map(contract => this.createContract(contract)));

      console.log("Database seeded successfully");
    } catch (error) {
      console.error("Error seeding database:", error);
      throw error;
    }
  }

  // Helper method to check if data already exists
  private async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return []; // Return empty array to prevent further errors
    }
  }
}

// Initialize with DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();