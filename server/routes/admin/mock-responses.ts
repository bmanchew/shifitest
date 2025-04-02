/**
 * Mock data responses for specific endpoints to ensure they always return JSON
 * even when port forwarding causes content-type issues
 */

// Define the type for complaint category
interface ComplaintCategory {
  category: string;
  count: number;
}

// Define the type for product metrics
interface ProductMetrics {
  product: string;
  contracts: number;
  value: number;
  delinquencyRate: number;
}

// Define the type for risk category
interface RiskCategory {
  category: string;
  contracts: number;
  value: number;
  delinquencyRate: number;
}

// Define the type for monthly trend
interface MonthlyTrend {
  month: string;
  rate: number;
}

// Define the type for portfolio health
interface PortfolioHealth {
  totalContracts: number;
  totalValue: number;
  avgAPR: number;
  delinquencyRate: number;
  monthlyTrend: MonthlyTrend[];
  byProduct: ProductMetrics[];
  byRiskCategory: RiskCategory[];
}

// Define the type for product complaint data
interface ProductComplaintData {
  year: number;
  totalComplaints: number;
  resolved: number;
  pending: number;
  categories: ComplaintCategory[];
  hits: {
    total: number;
  };
}

// Define the type for complaint trends response
interface ComplaintTrendsResponse {
  success: boolean;
  data: {
    personalLoans: ProductComplaintData;
    merchantCashAdvance: ProductComplaintData;
  };
}

// Define the mock responses interface
interface MockResponses {
  [key: string]: ComplaintTrendsResponse | PortfolioHealth;
}

// Export the mock responses
export const mockResponses: MockResponses = {
  // CFPB complaint trends mock response
  '/api/admin/reports/complaint-trends': {
    success: true,
    data: {
      personalLoans: {
        year: new Date().getFullYear(),
        totalComplaints: 842,
        resolved: 623,
        pending: 219,
        categories: [
          { category: "Unexpected fees", count: 217 },
          { category: "Payment issues", count: 198 },
          { category: "High interest rate", count: 156 },
          { category: "Customer service", count: 142 },
          { category: "Disclosure concerns", count: 129 }
        ],
        hits: {
          total: 842
        }
      },
      merchantCashAdvance: {
        year: new Date().getFullYear(),
        totalComplaints: 356,
        resolved: 281,
        pending: 75,
        categories: [
          { category: "Unexpected fees", count: 98 },
          { category: "Collection practices", count: 87 },
          { category: "Disclosure concerns", count: 76 },
          { category: "Payment issues", count: 53 },
          { category: "Funding issues", count: 42 }
        ],
        hits: {
          total: 356
        }
      }
    }
  } as ComplaintTrendsResponse,

  // Portfolio health mock response
  '/api/admin/reports/portfolio-health': {
    totalContracts: 142,
    totalValue: 3427500,
    avgAPR: 12.8,
    delinquencyRate: 2.4,
    monthlyTrend: [
      { month: "Jan", rate: 2.1 },
      { month: "Feb", rate: 2.3 },
      { month: "Mar", rate: 2.0 },
      { month: "Apr", rate: 2.2 },
      { month: "May", rate: 2.3 },
      { month: "Jun", rate: 2.4 },
    ],
    byProduct: [
      {
        product: "Term Loans",
        contracts: 78,
        value: 1950000,
        delinquencyRate: 1.9,
      },
      {
        product: "Lines of Credit",
        contracts: 42,
        value: 1050000,
        delinquencyRate: 2.8,
      },
      {
        product: "Equipment Financing",
        contracts: 22,
        value: 427500,
        delinquencyRate: 3.1,
      },
    ],
    byRiskCategory: [
      {
        category: "Low Risk",
        contracts: 62,
        value: 1550000,
        delinquencyRate: 0.8,
      },
      {
        category: "Medium Risk",
        contracts: 58,
        value: 1450000,
        delinquencyRate: 2.5,
      },
      {
        category: "High Risk",
        contracts: 22,
        value: 427500,
        delinquencyRate: 6.2,
      },
    ],
  } as PortfolioHealth
};

// Export isPathForMockResponse to check if a path should get a mock response
export function isPathForMockResponse(path: string | undefined): boolean {
  if (!path) return false;
  
  // Remove query parameters for matching
  const cleanPath = path.split('?')[0];
  
  // Check if this path has a mock response
  return Object.keys(mockResponses).some(mockPath => {
    // Clean the mock path as well
    const cleanMockPath = mockPath.split('?')[0];
    return cleanPath === cleanMockPath;
  });
}

// Export getMockResponse to get the mock response for a path
export function getMockResponse(path: string | undefined): any {
  if (!path) return null;
  
  // Remove query parameters for matching
  const cleanPath = path.split('?')[0];
  
  // Find matching mock response
  for (const mockPath in mockResponses) {
    const cleanMockPath = mockPath.split('?')[0];
    if (cleanPath === cleanMockPath) {
      return mockResponses[mockPath];
    }
  }
  
  return null;
}