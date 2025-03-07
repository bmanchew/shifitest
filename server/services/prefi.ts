import { logger, LogCategory, LogSource } from "../logger";
import axios from "axios";

interface PreFiRequest {
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  ConsentDate: string;
  ConsentIP: string;
}

interface PreFiOffer {
  Name: string;
  Score: string;
  Details: string;
  Status: string;
  Amount: string;
  Contingencies: string;
}

interface PreFiDataPerfection {
  Emails?: string[];
  Phones?: string[];
  Bankruptcy?: string[];
  Addresses?: Array<{
    Address: string;
    City: string;
    State: string;
    Zip: string;
  }>;
  DOB?: {
    Age: string;
  };
  Income?: {
    Estimate: string;
  };
}

interface PreFiResponse {
  Status: string;
  Code: string;
  Offers?: PreFiOffer[];
  DataPerfection?: PreFiDataPerfection;
  Errors?: string[];
  
  // Mapped fields for our internal use
  creditStatus: string;
  creditScore: number | null;
  annualIncome: number | null;
  employmentMonths: number | null;
  dtiRatio: number | null;
  ownHome: boolean | null;
  hasDelinquencies: boolean | null;
  reasonCodes: string[];
}

export const preFiService = {
  async preQualify(data: PreFiRequest): Promise<PreFiResponse> {
    try {
      const apiKey = process.env.PREFI_API_KEY;
      if (!apiKey) {
        throw new Error("Pre-Fi API key not configured");
      }

      logger.info({
        message: "Sending pre-qualification request to Pre-Fi",
        category: LogCategory.API,
        source: LogSource.PreFi,
        metadata: {
          data: {
            ...data,
            // Exclude sensitive info from logs
            FirstName: data.FirstName.charAt(0) + "***",
            LastName: data.LastName.charAt(0) + "***",
            Email: "***@" + data.Email.split("@")[1],
            Phone: "***" + data.Phone.slice(-4),
          },
        },
      });

      const response = await axios.post<PreFiResponse>(
        "https://pre-fi.com/api/v2/pre-qualification",
        data,
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      // Map the raw response to our internal format
      const mappedResponse = this.mapResponseToInternalFormat(response.data);

      logger.info({
        message: "Received pre-qualification response from Pre-Fi",
        category: LogCategory.API,
        source: LogSource.PreFi,
        metadata: {
          status: mappedResponse.Status,
          creditStatus: mappedResponse.creditStatus,
          creditScore: mappedResponse.creditScore,
          annualIncome: mappedResponse.annualIncome,
          offers: mappedResponse.Offers?.length || 0,
          reasonCodes: mappedResponse.reasonCodes,
        },
      });

      return mappedResponse;
    } catch (error) {
      logger.error({
        message: `Pre-Fi pre-qualification error: ${error instanceof Error ? error.message : String(error)}`,
        category: LogCategory.API,
        source: LogSource.PreFi,
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });
      throw error;
    }
  },

  parseCreditScore(data: PreFiResponse): number | null {
    // If we already have a mapped creditScore field, use it
    if (data?.creditScore) {
      return data.creditScore;
    }
    
    // Otherwise, try to extract from Offers array - first offer Score
    const offers = data?.Offers;
    if (offers && offers.length > 0 && offers[0]?.Score) {
      const score = parseInt(offers[0].Score);
      return isNaN(score) ? null : score;
    }
    
    return null;
  },
  
  // Helper method to map the raw API response to our internal structure
  mapResponseToInternalFormat(data: PreFiResponse): PreFiResponse {
    // Create a copy with our internal fields populated
    const mapped = { ...data };
    
    // Map Status to creditStatus
    mapped.creditStatus = data.Status || "";
    
    // Extract credit score from Offers
    mapped.creditScore = this.parseCreditScore(data);
    
    // Extract income estimate from DataPerfection
    mapped.annualIncome = data.DataPerfection?.Income?.Estimate 
      ? parseInt(data.DataPerfection.Income.Estimate.replace(/\$|,/g, ''))
      : null;
    
    // Estimate employment months from DataPerfection age (very rough estimate)
    mapped.employmentMonths = data.DataPerfection?.DOB?.Age
      ? parseInt(data.DataPerfection.DOB.Age) * 12 - 264 // Rough estimate: (age - 22) * 12
      : null;
    
    // Set defaults for other fields that we can't directly map
    mapped.dtiRatio = null;
    mapped.ownHome = data.DataPerfection?.Addresses?.length ? true : null;
    mapped.hasDelinquencies = data.DataPerfection?.Bankruptcy?.length ? true : null;
    mapped.reasonCodes = data.Errors || [];
    
    return mapped;
  },
};