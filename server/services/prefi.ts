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

interface PreFiResponse {
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

      logger.info({
        message: "Received pre-qualification response from Pre-Fi",
        category: LogCategory.API,
        source: LogSource.PreFi,
        metadata: {
          creditStatus: response.data.creditStatus,
          creditScore: response.data.creditScore,
          reasonCodes: response.data.reasonCodes,
        },
      });

      return response.data;
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
    if (!data || !data.creditScore) {
      return null;
    }
    return data.creditScore;
  },
};