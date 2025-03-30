import { AgentConfig } from "@/app/types";

const contractAgent: AgentConfig = {
  name: "contractReviewer",
  publicDescription: "Agent that assists with contract review, explanation, and clarification.",
  instructions: `
    You are ShiFi's Contract Reviewer, a specialist in explaining contract terms and conditions.
    Your goal is to help users understand their contract details, clarify any confusing language,
    and provide guidance on the specific obligations and rights within their financing agreement.
    
    When speaking with users:
    - Explain legal and financial contract terms in simple language
    - Be methodical in reviewing contract sections
    - Highlight important dates, payment amounts, and obligations
    - Never provide legal advice that could be construed as practicing law
    - Use the lookupContractDetails tool to retrieve specific contract clauses
    - If asked about legal implications, suggest consulting with a qualified attorney
    - Always maintain a professional, precise, and helpful tone
    
    Remember that contracts are legally binding documents, so accuracy is essential when explaining terms.
  `,
  tools: [
    {
      type: "function",
      name: "lookupContractDetails",
      description: "Retrieves specific details or sections from a user's contract.",
      parameters: {
        type: "object",
        properties: {
          contractId: {
            type: "string",
            description: "Contract ID to look up"
          },
          section: {
            type: "string",
            description: "The contract section to retrieve (e.g., 'payment terms', 'late fees', 'default')",
            enum: ["payment terms", "late fees", "default", "early repayment", "warranties", "entire contract"]
          }
        },
        required: ["contractId", "section"],
        additionalProperties: false
      }
    },
    {
      type: "function",
      name: "checkContractStatus",
      description: "Check the current status of a contract.",
      parameters: {
        type: "object",
        properties: {
          contractId: {
            type: "string",
            description: "Contract ID to check status for"
          }
        },
        required: ["contractId"],
        additionalProperties: false
      }
    }
  ],
  toolLogic: {
    lookupContractDetails: ({ contractId, section }: { contractId: string, section: string }) => {
      console.log("[toolLogic] calling lookupContractDetails(), contractId:", contractId, "section:", section);
      
      type ContractSection = {
        "payment terms": string;
        "late fees": string;
        "default": string;
        "early repayment": string;
        "warranties": string;
        "entire contract": string;
      };
      
      // Mock contract sections data
      const contractSections: Record<string, ContractSection> = {
        "CONT-12345": {
          "payment terms": "Payments of $70.15 are due on the 15th of each month. Payment may be made by automatic bank draft or through the customer portal.",
          "late fees": "A late fee of $15 will be assessed for payments received more than 5 days after the due date.",
          "default": "Default occurs when a payment is more than 30 days late. Upon default, the entire balance may become due immediately.",
          "early repayment": "This contract may be paid in full at any time with no prepayment penalty.",
          "warranties": "The merchant warrants all products for 90 days from the date of purchase.",
          "entire contract": "This financing agreement contains the entire understanding between the parties and supersedes all prior agreements."
        },
        "CONT-67890": {
          "payment terms": "Payments of $87.77 are due on the 10th of each month for 24 months. Payments should be made through the ShiFi payment portal.",
          "late fees": "A late fee of 5% of the payment amount will be assessed for payments received more than 3 days after the due date.",
          "default": "Default occurs when two consecutive payments are missed. Upon default, the remaining balance becomes due in full.",
          "early repayment": "This contract may be paid off early with no penalty. Interest will be calculated up to the payoff date.",
          "warranties": "Home Furnishings Inc. provides a 1-year warranty on all products financed under this agreement.",
          "entire contract": "This agreement constitutes the complete understanding between all parties regarding the financing arrangement."
        }
      };
      
      if (!contractSections[contractId]) {
        return {
          found: false,
          message: "No contract found with the provided ID."
        };
      }
      
      if (!contractSections[contractId][section as keyof ContractSection]) {
        return {
          found: false,
          message: "The requested section was not found in this contract."
        };
      }
      
      return {
        found: true,
        contractId,
        section,
        content: contractSections[contractId][section as keyof ContractSection]
      };
    },
    
    checkContractStatus: ({ contractId }: { contractId: string }) => {
      console.log("[toolLogic] calling checkContractStatus(), contractId:", contractId);
      
      type ContractStatus = {
        status: string;
        paymentsTotal: number;
        paymentsMade: number;
        paymentsRemaining: number;
        currentBalance: number;
        nextPaymentDate: string;
        nextPaymentAmount: number;
        onTimePayments: number;
        latePayments: number;
      };
      
      // Mock contract status data
      const statuses: Record<string, ContractStatus> = {
        "CONT-12345": {
          status: "active",
          paymentsTotal: 12,
          paymentsMade: 4,
          paymentsRemaining: 8,
          currentBalance: 561.20,
          nextPaymentDate: "2025-04-15",
          nextPaymentAmount: 70.15,
          onTimePayments: 4,
          latePayments: 0
        },
        "CONT-67890": {
          status: "active",
          paymentsTotal: 24,
          paymentsMade: 8,
          paymentsRemaining: 16,
          currentBalance: 1404.32,
          nextPaymentDate: "2025-04-10",
          nextPaymentAmount: 87.77,
          onTimePayments: 7,
          latePayments: 1
        }
      };
      
      if (!statuses[contractId]) {
        return {
          found: false,
          message: "No contract found with the provided ID."
        };
      }
      
      return {
        found: true,
        contractId,
        ...statuses[contractId]
      };
    }
  }
};

export default contractAgent;