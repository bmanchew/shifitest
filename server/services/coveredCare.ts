import axios from "axios";
import { logger } from "./logger";

/**
 * Service for interacting with the CoveredCare API
 * This service handles all CoveredCare API calls for merchant funding
 */
export class CoveredCareService {
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly partnerGUID: string;
  private readonly sandboxMode: boolean;
  private readonly developmentMode: boolean;

  constructor() {
    this.apiKey = process.env.COVERED_CARE_API_KEY || "";
    this.partnerGUID = process.env.COVERED_CARE_PARTNER_GUID || "";
    this.sandboxMode = process.env.NODE_ENV !== "production";
    // Enable development mode when credentials are missing
    this.developmentMode = !this.apiKey || !this.partnerGUID;
    
    // Set base URL based on environment
    if (this.sandboxMode) {
      this.apiBaseUrl = "https://uat.api.coveredcare.io";
    } else {
      this.apiBaseUrl = "https://api.coveredcare.io";
    }

    if (this.developmentMode) {
      logger.warn({
        message: "CoveredCare service running in development mode - API calls will be simulated",
        category: "api",
        source: "internal",
        metadata: {
          hasApiKey: !!this.apiKey,
          hasPartnerGUID: !!this.partnerGUID,
          developmentMode: true,
          environment: this.sandboxMode ? "sandbox" : "production"
        },
      });
    } else {
      logger.info({
        message: "CoveredCare service initialized successfully",
        category: "api",
        source: "internal",
        metadata: {
          environment: this.sandboxMode ? "sandbox" : "production",
          developmentMode: false
        }
      });
    }
  }

  /**
   * Check if the service is properly initialized with required credentials
   * @returns {boolean} True if the service is properly initialized with credentials, false otherwise
   */
  isInitialized(): boolean {
    return !!(this.apiKey && this.partnerGUID);
  }
  
  /**
   * Check if the service is in development mode (simulated responses)
   * @returns {boolean} True if development mode is active
   */
  isDevelopmentMode(): boolean {
    return this.developmentMode;
  }

  /**
   * Get headers for API requests including the API key
   */
  private getHeaders() {
    return {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Ocp-Apim-Subscription-Key": this.apiKey
    };
  }

  /**
   * Submit a lead offer request to CoveredCare
   * @param leadData Information about the lead/customer
   * @param merchantData Information about the merchant/partner
   * @param loanData Information about the requested loan
   * @returns API response from CoveredCare
   */
  async submitLeadOffer(leadData: any, merchantData: any, loanData: any) {
    try {
      // If in development mode, return a simulated successful response
      if (this.developmentMode) {
        const trackingGUID = crypto.randomUUID();
        
        logger.info({
          message: "Simulating lead offer submission to CoveredCare API (development mode)",
          category: "api",
          source: "internal",
          metadata: {
            trackingGUID,
            leadFirstName: leadData.firstName,
            leadLastName: leadData.lastName,
            requestedAmount: loanData.amount,
            developmentMode: true
          }
        });
        
        // Return a simulated successful response
        return {
          success: true,
          trackingGUID,
          leadOfferId: crypto.randomUUID(),
          statusCode: 200,
          offers: [
            {
              offerId: crypto.randomUUID(),
              loanAmount: loanData.amount,
              loanTerm: 36,
              interestRate: 9.99,
              monthlyPayment: loanData.amount / 36 * 1.12, // Simple approximation of monthly payment
              provider: "CoveredCare Development",
              productType: "Medical Loan"
            }
          ]
        };
      }
      
      // Regular API flow when not in development mode
      if (!this.isInitialized()) {
        throw new Error("CoveredCare service not initialized");
      }

      const trackingGUID = crypto.randomUUID();
      
      // Build request payload according to CoveredCare API format
      const payload = {
        leadInformation: {
          partnerGUID: this.partnerGUID,
          partnerState: merchantData.state || "NY",
          partnerName: merchantData.name || "Merchant",
          partnerVertical: merchantData.businessType || "Medical",
          partnerAddress1: merchantData.address || "",
          partnerAddress2: merchantData.address2 || "",
          partnerCity: merchantData.city || "",
          partnerZipCode: merchantData.zip || "",
          branchLocationGUID: merchantData.coveredCareBranchGUID || "",
          trackingGUID: trackingGUID,
          offerProductTypeGuid: merchantData.coveredCareProductTypeGuid || "",
          leadPatientID: leadData.patientId || leadData.customerId || "",
          requestDate: new Date().toLocaleDateString(),
          leadContactInfo: {
            leadGuid: leadData.leadGuid || crypto.randomUUID(),
            leadFirstName: leadData.firstName,
            leadLastName: leadData.lastName,
            leadDateOfBirth: leadData.dateOfBirth,
            leadCustomerId: leadData.customerId || "",
            leadPatientId: leadData.patientId || "",
            leadAddress: leadData.address,
            leadAddress2: leadData.address2 || "",
            leadCity: leadData.city,
            leadState: leadData.state,
            leadZip: leadData.zip,
            leadEmailAddress: leadData.email,
            leadPhone: leadData.phone,
            leadSSN: leadData.ssn,
            salaryAnnual: leadData.annualIncome || "",
            salaryMonthly: ""
          },
          loanRequest: {
            loanType: "I", // Installment Loan
            procedures: {
              procedureService: [{
                procedureAmount: loanData.amount,
                procedureDate: loanData.serviceDate || new Date().toLocaleDateString(),
                procedureId: "1",
                procedureName: loanData.procedureName || "Medical Service",
                doctor: loanData.doctor || "",
                procedureSKU: ""
              }]
            },
            requestedAmount: loanData.amount
          },
          patientInformation: {
            patientGuid: leadData.patientGuid || leadData.leadGuid || crypto.randomUUID(),
            isPatientSameAsLead: "True",
            patientFirstName: leadData.firstName,
            patientLastName: leadData.lastName,
            patientRelationship: "Self",
            patientDateOfBirth: "",
            patientAddress: "",
            patientAddress2: "",
            patientCity: "",
            patientState: "",
            patientZip: "",
            patientEmailAddress: "",
            patientPhone: "",
            patientSSN: ""
          },
          returnOffers: "true",
          sendEmail: "false",
          sendSMS: "false",
          language: "EN",
          assignTo: "",
          leadSource: "",
          marketingCampaign: "",
          agreeToEsignConsent: "true",
          agreeToPrivacyPolicy: "true",
          agreeToServicingComms: "true",
          agreeToCreditCheckAuthorization: "true",
          agreeToBankPrivacyPolicy: "",
          agreeToPatriotAct: "",
          agreeDateTime: new Date().toLocaleDateString()
        }
      };

      logger.info({
        message: "Submitting lead offer to CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          trackingGUID,
          leadFirstName: leadData.firstName,
          leadLastName: leadData.lastName,
          requestedAmount: loanData.amount
        }
      });

      const response = await axios({
        method: "post",
        url: `${this.apiBaseUrl}/vendor/lead-offer-request`,
        headers: this.getHeaders(),
        data: payload
      });

      logger.info({
        message: "Received response from CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          trackingGUID,
          status: response.status,
          statusText: response.statusText
        }
      });

      return response.data;
    } catch (error) {
      logger.error({
        message: `Error submitting lead offer to CoveredCare: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }

  /**
   * Adjust a loan amount with CoveredCare
   * @param providerGuid The provider GUID
   * @param branchGuid The branch GUID
   * @param loanNumber The loan number to adjust
   * @param updatedAmount The new amount for the loan
   * @param serviceDate Optional service date to update
   * @returns API response from CoveredCare
   */
  async adjustLoan(
    providerGuid: string,
    branchGuid: string,
    loanNumber: string,
    updatedAmount: number,
    serviceDate?: string
  ) {
    try {
      // If in development mode, return a simulated successful response
      if (this.developmentMode) {
        logger.info({
          message: "Simulating loan adjustment with CoveredCare API (development mode)",
          category: "api",
          source: "internal",
          metadata: {
            loanNumber,
            providerGuid,
            branchGuid,
            updatedAmount,
            serviceDate,
            developmentMode: true
          }
        });
        
        // Return a simulated successful response
        return {
          success: true,
          statusCode: 200,
          message: "Loan amount adjusted successfully",
          loanNumber,
          newAmount: updatedAmount
        };
      }
      
      // Regular API flow when not in development mode
      if (!this.isInitialized()) {
        throw new Error("CoveredCare service not initialized");
      }

      const payload = {
        providerGuid,
        branchGuid,
        loanNumber,
        updatedRequestAmt: updatedAmount,
        serviceDate: serviceDate || "",
        doctorName: "",
        loggedUserEmail: ""
      };

      logger.info({
        message: "Adjusting loan with CoveredCare API",
        category: "api",
        source: "internal", // Change from external to internal to fix type error
        metadata: {
          loanNumber,
          updatedAmount,
          serviceDate
        }
      });

      const response = await axios({
        method: "post",
        url: `${this.apiBaseUrl}/loan/adjust`,
        headers: this.getHeaders(),
        data: payload
      });

      logger.info({
        message: "Received loan adjustment response from CoveredCare API",
        category: "api",
        source: "internal", // Change from external to internal to fix type error
        metadata: {
          loanNumber,
          status: response.status,
          statusText: response.statusText
        }
      });

      return response.data;
    } catch (error) {
      logger.error({
        message: `Error adjusting loan with CoveredCare: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal", // Change from external to internal to fix type error
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }

  /**
   * Cancel a loan with CoveredCare
   * @param providerGuid The provider GUID
   * @param branchGuid The branch GUID
   * @param loanNumber The loan number to cancel
   * @returns API response from CoveredCare
   */
  async cancelLoan(
    providerGuid: string,
    branchGuid: string,
    loanNumber: string
  ) {
    try {
      // If in development mode, return a simulated successful response
      if (this.developmentMode) {
        logger.info({
          message: "Simulating loan cancellation with CoveredCare API (development mode)",
          category: "api",
          source: "internal",
          metadata: {
            loanNumber,
            providerGuid,
            branchGuid,
            developmentMode: true
          }
        });
        
        // Return a simulated successful response
        return {
          success: true,
          statusCode: 200,
          message: "Loan cancelled successfully",
          loanNumber
        };
      }
      
      // Regular API flow when not in development mode
      if (!this.isInitialized()) {
        throw new Error("CoveredCare service not initialized");
      }

      const payload = {
        providerGuid,
        branchGuid,
        loanNumber,
        loggedUserEmail: ""
      };

      logger.info({
        message: "Cancelling loan with CoveredCare API",
        category: "api",
        source: "internal", // Change from external to internal to fix type error
        metadata: {
          loanNumber
        }
      });

      const response = await axios({
        method: "post",
        url: `${this.apiBaseUrl}/loan/cancel`,
        headers: this.getHeaders(),
        data: payload
      });

      logger.info({
        message: "Received loan cancellation response from CoveredCare API",
        category: "api",
        source: "internal", // Change from external to internal to fix type error
        metadata: {
          loanNumber,
          status: response.status,
          statusText: response.statusText
        }
      });

      return response.data;
    } catch (error) {
      logger.error({
        message: `Error cancelling loan with CoveredCare: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal", // Change from external to internal to fix type error
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }

  /**
   * Add a new location for a provider
   * @param providerGuid The provider GUID
   * @param locationData Information about the location
   * @returns API response from CoveredCare
   */
  async addLocation(
    providerGuid: string,
    locationData: any
  ) {
    try {
      if (!this.isInitialized()) {
        throw new Error("CoveredCare service not initialized");
      }

      const payload = {
        providerGuid,
        locations: [{
          country: "US",
          locationId: locationData.id || locationData.locationId,
          locationName: locationData.name,
          legalName: locationData.legalName || locationData.name,
          businessType: locationData.businessType || "",
          annualRevenue: locationData.annualRevenue || 0,
          taxId: locationData.taxId || "",
          licenseNo: locationData.licenseNo || "",
          licenseState: locationData.state || "",
          yearsCurrentOwnership: locationData.yearsCurrentOwnership || 0,
          address: locationData.address,
          address2: locationData.address2 || "",
          city: locationData.city,
          state: locationData.state,
          contact: locationData.contactName,
          zipCode: locationData.zip,
          phone: locationData.phone,
          email: locationData.email,
          website: locationData.website || "",
          region: locationData.region || "",
          subRegion: locationData.subRegion || "",
          settlements: [{
            bankName: "",
            bankAccount: "",
            bankRouting: "",
            bankWiringInstr: "",
            contactName: "",
            contactPhone: "",
            contactEmail: "",
            lockBox: "",
            bankAccountType: "",
            accountName: ""
          }]
        }]
      };

      logger.info({
        message: "Adding location with CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          providerGuid,
          locationName: locationData.name
        }
      });

      const response = await axios({
        method: "post",
        url: `${this.apiBaseUrl}/provider/branch/location`,
        headers: this.getHeaders(),
        data: payload
      });

      logger.info({
        message: "Received add location response from CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          providerGuid,
          status: response.status,
          statusText: response.statusText
        }
      });

      return response.data;
    } catch (error) {
      logger.error({
        message: `Error adding location with CoveredCare: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }

  /**
   * Add bank account to an existing location
   * @param providerGuid The provider GUID
   * @param branchGuid The branch GUID
   * @param bankData Information about the bank account
   * @returns API response from CoveredCare
   */
  async addBankAccount(
    providerGuid: string,
    branchGuid: string,
    bankData: any
  ) {
    try {
      if (!this.isInitialized()) {
        throw new Error("CoveredCare service not initialized");
      }

      const payload = {
        providerGuid,
        branchGuid,
        settlements: [{
          bankName: bankData.bankName,
          bankAccount: bankData.accountNumber,
          bankRouting: bankData.routingNumber,
          bankWiringInstr: bankData.wiringInstructions || "",
          contactName: bankData.contactName,
          contactPhone: bankData.contactPhone || "",
          contactEmail: bankData.contactEmail || "",
          lockBox: bankData.lockBox || "",
          bankAccountType: bankData.accountType || "Checking",
          accountName: bankData.accountName || ""
        }]
      };

      logger.info({
        message: "Adding bank account with CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          providerGuid,
          branchGuid
        }
      });

      const response = await axios({
        method: "post",
        url: `${this.apiBaseUrl}/provider/location/settlement`,
        headers: this.getHeaders(),
        data: payload
      });

      logger.info({
        message: "Received add bank account response from CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          providerGuid,
          branchGuid,
          status: response.status,
          statusText: response.statusText
        }
      });

      return response.data;
    } catch (error) {
      logger.error({
        message: `Error adding bank account with CoveredCare: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }

  /**
   * Update banking information for a location
   * @param providerGuid The provider GUID
   * @param branchGuid The branch GUID
   * @param settlementGuid The settlement GUID
   * @param bankData Updated banking information
   * @returns API response from CoveredCare
   */
  async updateBankAccount(
    providerGuid: string,
    branchGuid: string,
    settlementGuid: string,
    bankData: any
  ) {
    try {
      if (!this.isInitialized()) {
        throw new Error("CoveredCare service not initialized");
      }

      const payload = {
        providerGuid,
        branchGuid,
        settlementGuid,
        bankName: bankData.bankName,
        bankAccount: bankData.accountNumber,
        bankRouting: bankData.routingNumber,
        bankWiringInstr: bankData.wiringInstructions || "",
        contactName: bankData.contactName,
        contactPhone: bankData.contactPhone || "",
        contactEmail: bankData.contactEmail || "",
        lockBox: bankData.lockBox || "",
        bankAccountType: bankData.accountType || "Checking",
        accountName: bankData.accountName || ""
      };

      logger.info({
        message: "Updating bank account with CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          providerGuid,
          branchGuid,
          settlementGuid
        }
      });

      const response = await axios({
        method: "put",
        url: `${this.apiBaseUrl}/provider/location/settlement`,
        headers: this.getHeaders(),
        data: payload
      });

      logger.info({
        message: "Received update bank account response from CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          providerGuid,
          branchGuid,
          settlementGuid,
          status: response.status,
          statusText: response.statusText
        }
      });

      return response.data;
    } catch (error) {
      logger.error({
        message: `Error updating bank account with CoveredCare: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }

  /**
   * Get loan or offer details from CoveredCare
   * @param loanNumber The loan number or offer tracking GUID to query
   * @returns API response from CoveredCare
   */
  async getLoanDetails(loanNumber: string) {
    try {
      // If in development mode, return a simulated successful response
      if (this.developmentMode) {
        logger.info({
          message: "Simulating loan details request to CoveredCare API (development mode)",
          category: "api",
          source: "internal",
          metadata: {
            loanNumber,
            developmentMode: true
          }
        });
        
        // Return a simulated successful response
        return {
          success: true,
          statusCode: 200,
          loanNumber,
          loanStatus: "Active",
          amount: 5000,
          approvedAmount: 5000,
          currentBalance: 4750,
          interestRate: 9.99,
          monthlyPayment: 156.07,
          remainingPayments: 36,
          startDate: new Date().toISOString(),
          nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          customerInfo: {
            firstName: "Test",
            lastName: "Customer",
            email: "test@example.com",
            phone: "555-123-4567"
          }
        };
      }
      
      // Regular API flow when not in development mode
      if (!this.isInitialized()) {
        throw new Error("CoveredCare service not initialized");
      }

      logger.info({
        message: "Getting loan details from CoveredCare API",
        category: "api",
        source: "internal", // Change from external to internal to fix type error
        metadata: {
          loanNumber
        }
      });

      const response = await axios({
        method: "get",
        url: `${this.apiBaseUrl}/loan/offer-details?loanNumber=${loanNumber}`,
        headers: this.getHeaders()
      });

      logger.info({
        message: "Received loan details response from CoveredCare API",
        category: "api",
        source: "internal", // Change from external to internal to fix type error
        metadata: {
          loanNumber,
          status: response.status,
          statusText: response.statusText
        }
      });

      return response.data;
    } catch (error) {
      logger.error({
        message: `Error getting loan details from CoveredCare: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal", // Change from external to internal to fix type error
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }

  /**
   * Get settlement details for a date range
   * @param providerGuid The provider GUID
   * @param branchGuid Optional branch GUID to filter by 
   * @param startDate Start date for the settlement query (MM/DD/YYYY)
   * @param endDate End date for the settlement query (MM/DD/YYYY)
   * @returns API response from CoveredCare
   */
  async getSettlementDetails(
    providerGuid: string,
    startDate: string,
    endDate: string,
    branchGuid?: string
  ) {
    try {
      if (!this.isInitialized()) {
        throw new Error("CoveredCare service not initialized");
      }

      // Build the query string
      let queryString = `providerGUID=${providerGuid}&startDate=${startDate}&endDate=${endDate}`;
      
      if (branchGuid) {
        queryString += `&branchLocationGUID=${branchGuid}`;
      }

      logger.info({
        message: "Getting settlement details from CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          providerGuid,
          branchGuid,
          startDate,
          endDate
        }
      });

      const response = await axios({
        method: "get",
        url: `${this.apiBaseUrl}/provider/settlement/detail?${queryString}`,
        headers: this.getHeaders()
      });

      logger.info({
        message: "Received settlement details response from CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          providerGuid,
          branchGuid,
          status: response.status,
          statusText: response.statusText
        }
      });

      return response.data;
    } catch (error) {
      logger.error({
        message: `Error getting settlement details from CoveredCare: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }

  /**
   * Get credit contract details for a loan
   * @param loanNumber The loan number to get the contract for
   * @returns API response from CoveredCare with contract details
   */
  async getCreditContract(loanNumber: string) {
    try {
      if (!this.isInitialized()) {
        throw new Error("CoveredCare service not initialized");
      }

      logger.info({
        message: "Getting credit contract from CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          loanNumber
        }
      });

      const response = await axios({
        method: "get",
        url: `${this.apiBaseUrl}/loan/credit-contract?loanNumber=${loanNumber}`,
        headers: this.getHeaders()
      });

      logger.info({
        message: "Received credit contract response from CoveredCare API",
        category: "api",
        source: "internal",
        metadata: {
          loanNumber,
          status: response.status,
          statusText: response.statusText
        }
      });

      return response.data;
    } catch (error) {
      logger.error({
        message: `Error getting credit contract from CoveredCare: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        }
      });
      throw error;
    }
  }
}

// Export singleton instance
export const coveredCareService = new CoveredCareService();