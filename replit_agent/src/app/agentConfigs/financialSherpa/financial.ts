import { AgentConfig } from "@/app/types";

const financialAgent: AgentConfig = {
  name: "financialSherpa",
  publicDescription: "Financial Sherpa assistant that helps with financial inquiries and guidance.",
  instructions: `
    You are ShiFi's Financial Sherpa, a knowledgeable and friendly financial assistant.
    Your goal is to help users understand their financing options, explain contract terms,
    and provide guidance on financial decisions related to their ShiFi financing.
    
    When speaking with users:
    - Be clear and easy to understand, avoiding jargon when possible
    - If asked about specific contract details, use the lookupContract tool
    - Explain financial concepts in simple terms
    - Be supportive and non-judgmental
    - Maintain a professional but friendly tone
    - Never share sensitive information like full account numbers
    - If a user needs specific account assistance, suggest they contact customer service
    
    Remember: You should always provide accurate financial information while being helpful and supportive.
  `,
  tools: [
    {
      type: "function",
      name: "lookupContract",
      description: "Retrieves contract information for a user based on their contract ID or phone number.",
      parameters: {
        type: "object",
        properties: {
          contractId: {
            type: "string",
            description: "Contract ID to look up"
          },
          phoneNumber: {
            type: "string",
            description: "Phone number associated with the contract, format: (123) 456-7890",
            pattern: "^\\(\\d{3}\\) \\d{3}-\\d{4}$"
          }
        },
        additionalProperties: false
      }
    },
    {
      type: "function",
      name: "calculatePayment",
      description: "Calculate payment details for different financing options.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "Loan amount in dollars"
          },
          termMonths: {
            type: "number",
            description: "Loan term in months"
          },
          interestRate: {
            type: "number",
            description: "Annual interest rate as a percentage (e.g., 5.9 for 5.9%)"
          },
          downPayment: {
            type: "number",
            description: "Down payment amount in dollars (optional)"
          }
        },
        required: ["amount", "termMonths", "interestRate"],
        additionalProperties: false
      }
    },
    {
      type: "function",
      name: "explainTerm",
      description: "Provide explanation of financial terms or contract language.",
      parameters: {
        type: "object",
        properties: {
          term: {
            type: "string",
            description: "The financial term to explain"
          }
        },
        required: ["term"],
        additionalProperties: false
      }
    }
  ],
  toolLogic: {
    lookupContract: async ({ contractId, phoneNumber }: { contractId?: string, phoneNumber?: string }) => {
      console.log("[toolLogic] calling lookupContract(), contractId:", contractId, "phoneNumber:", phoneNumber);
      
      type Contract = {
        id: string;
        phoneNumber: string;
        merchant: string;
        amount: number;
        downPayment: number;
        financedAmount: number;
        termMonths: number;
        interestRate: number;
        monthlyPayment: number;
        status: string;
        nextPaymentDate: string;
        remainingPayments: number;
      };
      
      // Mock contract data - in a real implementation, this would query your database
      const contracts: Contract[] = [
        {
          id: "CONT-12345",
          phoneNumber: "(555) 123-4567",
          merchant: "TechGadget Store",
          amount: 1000,
          downPayment: 200,
          financedAmount: 800,
          termMonths: 12,
          interestRate: 5.9,
          monthlyPayment: 70.15,
          status: "active",
          nextPaymentDate: "2025-04-15",
          remainingPayments: 8
        },
        {
          id: "CONT-67890",
          phoneNumber: "(555) 987-6543",
          merchant: "Home Furnishings Inc",
          amount: 2500,
          downPayment: 500,
          financedAmount: 2000,
          termMonths: 24,
          interestRate: 4.9,
          monthlyPayment: 87.77,
          status: "active",
          nextPaymentDate: "2025-04-10",
          remainingPayments: 16
        }
      ];
      
      // Search for the contract
      const contract = contracts.find(c => 
        (contractId && c.id === contractId) || 
        (phoneNumber && c.phoneNumber === phoneNumber)
      );
      
      if (!contract) {
        return {
          found: false,
          message: "No contract found with the provided information."
        };
      }
      
      return {
        found: true,
        contract: contract
      };
    },
    
    calculatePayment: ({ amount, termMonths, interestRate, downPayment = 0 }: { amount: number, termMonths: number, interestRate: number, downPayment?: number }) => {
      console.log("[toolLogic] calling calculatePayment(), amount:", amount, "termMonths:", termMonths, "interestRate:", interestRate, "downPayment:", downPayment);
      
      const financedAmount = amount - downPayment;
      const monthlyInterestRate = interestRate / 100 / 12;
      
      // Calculate monthly payment using the loan formula
      const monthlyPayment = financedAmount * 
        (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, termMonths)) / 
        (Math.pow(1 + monthlyInterestRate, termMonths) - 1);
      
      const totalPayment = monthlyPayment * termMonths;
      const totalInterest = totalPayment - financedAmount;
      
      return {
        financedAmount: financedAmount.toFixed(2),
        monthlyPayment: monthlyPayment.toFixed(2),
        totalPayment: totalPayment.toFixed(2),
        totalInterest: totalInterest.toFixed(2),
        termMonths,
        interestRate
      };
    },
    
    explainTerm: ({ term }: { term: string }) => {
      console.log("[toolLogic] calling explainTerm(), term:", term);
      
      // Dictionary of financial terms
      const terms: Record<string, string> = {
        "apr": "Annual Percentage Rate (APR) is the yearly interest rate charged for a loan, including fees.",
        "principal": "The original amount of money borrowed in a loan, not including interest.",
        "interest": "The cost of borrowing money, typically expressed as a percentage of the loan amount.",
        "term": "The length of time over which a loan is scheduled to be repaid.",
        "down payment": "An initial payment made when something is purchased on credit.",
        "collateral": "An asset that a borrower offers as a way for a lender to secure the loan.",
        "amortization": "The process of paying off a debt over time through regular payments.",
        "delinquency": "Failure to make a payment on a debt by its due date.",
        "default": "Failure to meet the legal obligations of a loan, particularly the failure to make timely payments.",
        "refinancing": "The process of replacing an existing loan with a new loan, generally with better terms.",
        "prepayment penalty": "A fee charged to a borrower who pays off a loan before its expected completion date."
      };
      
      // Look up the term in our dictionary (case-insensitive)
      const normalizedTerm = term.toLowerCase();
      const explanation = terms[normalizedTerm] || 
        "I don't have specific information about that term. Would you like me to explain a different financial concept?";
      
      return {
        term: term,
        explanation: explanation
      };
    }
  }
};

export default financialAgent;