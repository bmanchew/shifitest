import {
  users, User, InsertUser,
  merchants, Merchant, InsertMerchant,
  contracts, Contract, InsertContract,
  applicationProgress, ApplicationProgress, InsertApplicationProgress,
  logs, Log, InsertLog,
  creditProfiles, CreditProfile, InsertCreditProfile,
  underwriting, Underwriting, InsertUnderwriting
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

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
  
  // Credit Profile operations
  getCreditProfile(id: number): Promise<CreditProfile | undefined>;
  getCreditProfileByUserId(userId: number): Promise<CreditProfile | undefined>;
  getCreditProfileByContractId(contractId: number): Promise<CreditProfile | undefined>;
  createCreditProfile(profile: InsertCreditProfile): Promise<CreditProfile>;
  updateCreditProfile(id: number, data: Partial<InsertCreditProfile>): Promise<CreditProfile | undefined>;
  
  // Underwriting operations
  getUnderwriting(id: number): Promise<Underwriting | undefined>;
  getUnderwritingByContractId(contractId: number): Promise<Underwriting | undefined>;
  getUnderwritingByCreditProfileId(creditProfileId: number): Promise<Underwriting | undefined>;
  createUnderwriting(underwritingData: InsertUnderwriting): Promise<Underwriting>;
  updateUnderwriting(id: number, data: Partial<InsertUnderwriting>): Promise<Underwriting | undefined>;
  
  // Log operations
  createLog(log: InsertLog): Promise<Log>;
  getLogs(): Promise<Log[]>;
  getLogsByUserId(userId: number): Promise<Log[]>;
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
  
  // Credit Profile methods
  async getCreditProfile(id: number): Promise<CreditProfile | undefined> {
    const [profile] = await db.select().from(creditProfiles).where(eq(creditProfiles.id, id));
    return profile || undefined;
  }
  
  async getCreditProfileByUserId(userId: number): Promise<CreditProfile | undefined> {
    const [profile] = await db.select().from(creditProfiles).where(eq(creditProfiles.userId, userId));
    return profile || undefined;
  }
  
  async getCreditProfileByContractId(contractId: number): Promise<CreditProfile | undefined> {
    const [profile] = await db.select().from(creditProfiles).where(eq(creditProfiles.contractId, contractId));
    return profile || undefined;
  }
  
  async createCreditProfile(profile: InsertCreditProfile): Promise<CreditProfile> {
    const [newProfile] = await db.insert(creditProfiles).values(profile).returning();
    return newProfile;
  }
  
  async updateCreditProfile(id: number, data: Partial<InsertCreditProfile>): Promise<CreditProfile | undefined> {
    const existingProfile = await this.getCreditProfile(id);
    if (!existingProfile) return undefined;
    
    const [updatedProfile] = await db
      .update(creditProfiles)
      .set({ 
        ...data,
        updatedAt: new Date()
      })
      .where(eq(creditProfiles.id, id))
      .returning();
    
    return updatedProfile;
  }
  
  // Underwriting methods
  async getUnderwriting(id: number): Promise<Underwriting | undefined> {
    const [result] = await db.select().from(underwriting).where(eq(underwriting.id, id));
    return result || undefined;
  }
  
  async getUnderwritingByContractId(contractId: number): Promise<Underwriting | undefined> {
    const [result] = await db.select().from(underwriting).where(eq(underwriting.contractId, contractId));
    return result || undefined;
  }
  
  async getUnderwritingByCreditProfileId(creditProfileId: number): Promise<Underwriting | undefined> {
    const [result] = await db.select().from(underwriting).where(eq(underwriting.creditProfileId, creditProfileId));
    return result || undefined;
  }
  
  async createUnderwriting(underwritingData: InsertUnderwriting): Promise<Underwriting> {
    const [newUnderwriting] = await db.insert(underwriting).values(underwritingData).returning();
    return newUnderwriting;
  }
  
  async updateUnderwriting(id: number, data: Partial<InsertUnderwriting>): Promise<Underwriting | undefined> {
    const existingUnderwriting = await this.getUnderwriting(id);
    if (!existingUnderwriting) return undefined;
    
    const [updatedUnderwriting] = await db
      .update(underwriting)
      .set({ 
        ...data,
        updatedAt: new Date()
      })
      .where(eq(underwriting.id, id))
      .returning();
    
    return updatedUnderwriting;
  }
  
  // Log methods
  async createLog(log: InsertLog): Promise<Log> {
    const [newLog] = await db.insert(logs).values(log).returning();
    return newLog;
  }
  
  async getLogs(): Promise<Log[]> {
    return await db.select().from(logs).orderBy(logs.timestamp);
  }
  
  async getLogsByUserId(userId: number): Promise<Log[]> {
    return await db.select().from(logs).where(eq(logs.userId, userId)).orderBy(logs.timestamp);
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
    return await db.select().from(users);
  }
}

// Initialize with DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
