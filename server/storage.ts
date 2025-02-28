import {
  users, User, InsertUser,
  merchants, Merchant, InsertMerchant,
  contracts, Contract, InsertContract,
  applicationProgress, ApplicationProgress, InsertApplicationProgress,
  logs, Log, InsertLog
} from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private usersMap: Map<number, User>;
  private merchantsMap: Map<number, Merchant>;
  private contractsMap: Map<number, Contract>;
  private applicationProgressMap: Map<number, ApplicationProgress>;
  private logsMap: Map<number, Log>;
  
  private userId: number;
  private merchantId: number;
  private contractId: number;
  private applicationProgressId: number;
  private logId: number;
  
  constructor() {
    this.usersMap = new Map();
    this.merchantsMap = new Map();
    this.contractsMap = new Map();
    this.applicationProgressMap = new Map();
    this.logsMap = new Map();
    
    this.userId = 1;
    this.merchantId = 1;
    this.contractId = 1;
    this.applicationProgressId = 1;
    this.logId = 1;
    
    // Seed some initial data
    this.seedInitialData();
  }
  
  private seedInitialData() {
    // Create admin user
    const adminUser: InsertUser = {
      email: "admin@shifi.com",
      password: "admin123", // In a real app, this would be hashed
      name: "Admin User",
      role: "admin",
      phone: "123-456-7890"
    };
    this.createUser(adminUser);
    
    // Create a merchant user
    const merchantUser: InsertUser = {
      email: "merchant@techsolutions.com",
      password: "merchant123", // In a real app, this would be hashed
      name: "Merchant User",
      role: "merchant",
      phone: "987-654-3210"
    };
    const createdMerchantUser = this.createUser(merchantUser);
    
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
    this.createMerchant(merchant);
    
    // Create some customer users
    const customers = [
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
    
    const createdCustomers = customers.map(customer => this.createUser(customer));
    
    // Create some contracts
    const contracts = [
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
    
    contracts.forEach(contract => this.createContract(contract));
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.usersMap.get(id);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(user => user.email === email);
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const id = this.userId++;
    const createdAt = new Date();
    const newUser: User = { ...user, id, createdAt };
    this.usersMap.set(id, newUser);
    return newUser;
  }
  
  // Merchant methods
  async getMerchant(id: number): Promise<Merchant | undefined> {
    return this.merchantsMap.get(id);
  }
  
  async getMerchantByUserId(userId: number): Promise<Merchant | undefined> {
    return Array.from(this.merchantsMap.values()).find(merchant => merchant.userId === userId);
  }
  
  async getAllMerchants(): Promise<Merchant[]> {
    return Array.from(this.merchantsMap.values());
  }
  
  async createMerchant(merchant: InsertMerchant): Promise<Merchant> {
    const id = this.merchantId++;
    const createdAt = new Date();
    const newMerchant: Merchant = { ...merchant, id, createdAt };
    this.merchantsMap.set(id, newMerchant);
    return newMerchant;
  }
  
  // Contract methods
  async getContract(id: number): Promise<Contract | undefined> {
    return this.contractsMap.get(id);
  }
  
  async getContractByNumber(contractNumber: string): Promise<Contract | undefined> {
    return Array.from(this.contractsMap.values()).find(contract => contract.contractNumber === contractNumber);
  }
  
  async getAllContracts(): Promise<Contract[]> {
    return Array.from(this.contractsMap.values());
  }
  
  async getContractsByMerchantId(merchantId: number): Promise<Contract[]> {
    return Array.from(this.contractsMap.values()).filter(contract => contract.merchantId === merchantId);
  }
  
  async getContractsByCustomerId(customerId: number): Promise<Contract[]> {
    return Array.from(this.contractsMap.values()).filter(contract => contract.customerId === customerId);
  }
  
  async createContract(contract: InsertContract): Promise<Contract> {
    const id = this.contractId++;
    const createdAt = new Date();
    const newContract: Contract = { ...contract, id, createdAt, completedAt: null };
    this.contractsMap.set(id, newContract);
    return newContract;
  }
  
  async updateContractStatus(id: number, status: string): Promise<Contract | undefined> {
    const contract = this.contractsMap.get(id);
    if (!contract) return undefined;
    
    const updatedContract: Contract = { 
      ...contract, 
      status: status as any,
      completedAt: status === 'completed' ? new Date() : contract.completedAt
    };
    this.contractsMap.set(id, updatedContract);
    return updatedContract;
  }
  
  async updateContractStep(id: number, step: string): Promise<Contract | undefined> {
    const contract = this.contractsMap.get(id);
    if (!contract) return undefined;
    
    const updatedContract: Contract = { ...contract, currentStep: step as any };
    this.contractsMap.set(id, updatedContract);
    return updatedContract;
  }
  
  // Application Progress methods
  async getApplicationProgress(id: number): Promise<ApplicationProgress | undefined> {
    return this.applicationProgressMap.get(id);
  }
  
  async getApplicationProgressByContractId(contractId: number): Promise<ApplicationProgress[]> {
    return Array.from(this.applicationProgressMap.values()).filter(progress => progress.contractId === contractId);
  }
  
  async createApplicationProgress(progress: InsertApplicationProgress): Promise<ApplicationProgress> {
    const id = this.applicationProgressId++;
    const createdAt = new Date();
    const newProgress: ApplicationProgress = { ...progress, id, createdAt, completedAt: null };
    this.applicationProgressMap.set(id, newProgress);
    return newProgress;
  }
  
  async updateApplicationProgressCompletion(id: number, completed: boolean, data?: string): Promise<ApplicationProgress | undefined> {
    const progress = this.applicationProgressMap.get(id);
    if (!progress) return undefined;
    
    const updatedProgress: ApplicationProgress = { 
      ...progress, 
      completed,
      data: data || progress.data,
      completedAt: completed ? new Date() : null
    };
    this.applicationProgressMap.set(id, updatedProgress);
    return updatedProgress;
  }
  
  // Log methods
  async createLog(log: InsertLog): Promise<Log> {
    const id = this.logId++;
    const timestamp = new Date();
    const newLog: Log = { ...log, id, timestamp };
    this.logsMap.set(id, newLog);
    return newLog;
  }
  
  async getLogs(): Promise<Log[]> {
    return Array.from(this.logsMap.values());
  }
  
  async getLogsByUserId(userId: number): Promise<Log[]> {
    return Array.from(this.logsMap.values()).filter(log => log.userId === userId);
  }
}

export const storage = new MemStorage();
