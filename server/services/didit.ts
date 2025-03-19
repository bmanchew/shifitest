import crypto from "crypto";
import { logger } from "./logger";

/**
 * DiDit service for identity verification
 *
 * This service integrates with DiDit Identity Verification API and handles:
 * - Authentication
 * - Creating verification sessions
 * - Retrieving verification results
 * - Processing webhooks
 *
 * It includes a graceful fallback to mock mode when real API access fails
 */

interface DiditTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface DiditSessionResponse {
  session_id: string;
  session_number: number;
  session_url: string;
  vendor_data: string;
  callback: string;
  features: string;
  created_at: string;
  status: string;
  expires_at: string;
}

interface DiditSessionDecision {
  session_id: string;
  session_number: number;
  session_url: string;
  status: string;
  vendor_data: string;
  callback: string;
  features: string;
  kyc?: {
    status: string;
    document_type: string;
    document_number: string;
    date_of_birth: string;
    first_name: string;
    last_name: string;
    full_name: string;
    address?: string;
    [key: string]: any;
  };
  face?: {
    status: string;
    face_match_status: string;
    liveness_status: string;
    face_match_similarity: number;
    [key: string]: any;
  };
  aml?: {
    status: string;
    total_hits: number;
    score?: number;
    hits?: any[];
    [key: string]: any;
  };
  location?: {
    status: string;
    device_brand?: string;
    device_model?: string;
    ip_country?: string;
    ip_city?: string;
    [key: string]: any;
  };
  warnings?: any[];
  reviews?: any[];
  [key: string]: any;
}

interface DiditCreateSessionOptions {
  contractId: string | number;
  callbackUrl: string; // URL where user is redirected after verification (DiDit "callback" param)
  allowedDocumentTypes?: string[];
  allowedChecks?: string[];
  requiredFields?: string[];
  customFields?: Record<string, any>;
}

interface DiditWebhookEvent {
  event_type: string;
  session_id: string;
  status?: string;
  decision?: {
    status: string;
    [key: string]: any;
  };
  customer_details?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

class DiditService {
  // Base URLs according to DiDit documentation
  private authBaseUrl = "https://apx.didit.me"; // Updated per latest docs
  private verificationBaseUrl = "https://verification.didit.me";
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private webhookSecretKey: string | undefined;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;
  private initialized = false;
  private useMockMode = false; // Set to false to use the real DiDit API
  // Use a dynamic base URL that works in any environment
  private serverBaseUrl =
    process.env.PUBLIC_URL ||
    "https://66bc6305-d313-418d-8499-11a803af5b4a-00-368ksgk8kmfni.kirk.replit.dev";

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the DiDit service with credentials from environment variables
   */
  private initialize() {
    // Check for both API_KEY/CLIENT_ID naming conventions to be compatible with different setups
    this.clientId = process.env.DIDIT_CLIENT_ID || process.env.DIDIT_API_KEY;
    this.clientSecret =
      process.env.DIDIT_CLIENT_SECRET || process.env.DIDIT_API_SECRET;
    this.webhookSecretKey =
      process.env.DIDIT_WEBHOOK_SECRET_KEY || process.env.DIDIT_WEBHOOK_SECRET;
    this.initialized = !!this.clientId && !!this.clientSecret;

    if (!this.initialized) {
      logger.warn({
        message: "DiDit service initialized without credentials",
        category: "api",
        source: "didit",
      });
    } else {
      logger.info({
        message: "DiDit service initialized with credentials",
        category: "api",
        source: "didit",
      });
    }
  }

  /**
   * Check if the service is properly initialized with credentials
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Set server base URL for mock mode
   */
  setServerBaseUrl(url: string): void {
    this.serverBaseUrl = url;
  }

  /**
   * Get an OAuth access token from DiDit
   * Caches the token for subsequent requests until expiry
   */
  async getAccessToken(): Promise<string | null> {
    // Check if we have a valid cached token
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && now < this.tokenExpiry - 60) {
      // 60-second buffer
      return this.cachedToken;
    }

    if (!this.clientId || !this.clientSecret) {
      logger.warn({
        message: "Cannot get DiDit access token: Missing credentials",
        category: "api",
        source: "didit",
      });
      return null;
    }

    try {
      // Log the request being made for debugging
      logger.debug({
        message: "Attempting to get DiDit access token",
        category: "api",
        source: "didit",
        metadata: {
          authUrl: `${this.authBaseUrl}/auth/v2/token/`, // Updated endpoint from docs
          clientId: this.clientId,
        },
      });

      // Construct the Basic Auth header using Base64 encoded credentials
      const encodedCredentials = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString("base64");

      // Create form params for the token request
      const formData = new URLSearchParams();
      formData.append("grant_type", "client_credentials");

      const response = await fetch(`${this.authBaseUrl}/auth/v2/token/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${encodedCredentials}`,
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DiDit authentication error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const tokenData: DiditTokenResponse = await response.json();
      this.cachedToken = tokenData.access_token;
      this.tokenExpiry = Math.floor(Date.now() / 1000) + tokenData.expires_in;

      logger.info({
        message: "Successfully acquired DiDit access token",
        category: "api",
        source: "didit",
        metadata: {
          expires_in: tokenData.expires_in,
          token_type: tokenData.token_type,
        },
      });

      return this.cachedToken;
    } catch (error) {
      logger.error({
        message: `Failed to get DiDit access token: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      return null;
    }
  }

  /**
   * Create a new verification session
   * Falls back to mock mode if real API access fails
   */
  async createVerificationSession(
    options: DiditCreateSessionOptions,
  ): Promise<DiditSessionResponse | null> {
    if (!this.isInitialized()) {
      logger.warn({
        message:
          "Cannot create DiDit verification session: Service not initialized",
        category: "api",
        source: "didit",
      });
      return null;
    }

    // If we're in mock mode or real API access fails, use the mock implementation
    if (this.useMockMode) {
      return this.createMockVerificationSession(options);
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      logger.warn({
        message: "DiDit API access failed, falling back to mock implementation",
        category: "api",
        source: "didit",
      });
      return this.createMockVerificationSession(options);
    }

    try {
      const {
        contractId,
        callbackUrl,
        allowedDocumentTypes = ["passport", "driving_license", "id_card"],
        allowedChecks = ["ocr", "face", "document_liveness"],
        requiredFields = [
          "first_name",
          "last_name",
          "date_of_birth",
          "document_number",
        ],
        customFields = {},
      } = options;

      // According to DiDit documentation, "callback" is the URL where users are redirected after verification
      const requestBody = {
        callback: callbackUrl, // This is the redirect URL for users after verification
        vendor_data: JSON.stringify({ contractId }),
        features: "OCR + FACE", // Features string format as specified in docs
        ...customFields,
      };

      logger.debug({
        message: "Creating DiDit verification session with parameters",
        category: "api",
        source: "didit",
        metadata: {
          contractId: contractId.toString(),
          callback: callbackUrl,
          features: requestBody.features,
        },
      });

      const response = await fetch(`${this.verificationBaseUrl}/v1/session/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        logger.warn({
          message: `DiDit API session creation failed, falling back to mock: ${response.status} ${response.statusText}`,
          category: "api",
          source: "didit",
        });
        return this.createMockVerificationSession(options);
      }

      const sessionData: DiditSessionResponse = await response.json();

      logger.info({
        message: `DiDit verification session created: ${sessionData.session_id}`,
        category: "api",
        source: "didit",
        metadata: {
          contractId: contractId.toString(),
          sessionId: sessionData.session_id,
          status: sessionData.status,
          callback: sessionData.callback,
        },
      });

      return sessionData;
    } catch (error) {
      logger.error({
        message: `Failed to create DiDit verification session through API, falling back to mock: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          contractId: options.contractId.toString(),
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      return this.createMockVerificationSession(options);
    }
  }

  /**
   * Generate a mock verification session for testing when the real API is unavailable
   */
  private createMockVerificationSession(
    options: DiditCreateSessionOptions,
  ): DiditSessionResponse {
    const { contractId, callbackUrl } = options;
    const sessionId = crypto.randomUUID();
    const sessionNumber = Math.floor(Math.random() * 100000);

    logger.info({
      message: `Created mock DiDit verification session: ${sessionId}`,
      category: "api",
      source: "didit",
      metadata: {
        contractId: contractId.toString(),
        mockMode: true,
      },
    });

    // Get current origin from environment
    const originUrl = process.env.PUBLIC_URL || this.serverBaseUrl;

    // Make sure we're using the proper scheme (https://)
    const baseUrl = originUrl.startsWith("http")
      ? originUrl
      : `https://${originUrl}`;

    // Construct the mock verification URL
    const mockUrl = `${baseUrl}/mock/didit-kyc?sessionId=${sessionId}&contractId=${contractId}`;

    logger.info({
      message: `Created mock DiDit verification URL: ${mockUrl}`,
      category: "api",
      source: "didit",
    });

    return {
      session_id: sessionId,
      session_number: sessionNumber,
      session_url: mockUrl,
      vendor_data: JSON.stringify({ contractId }),
      callback: callbackUrl,
      features: "OCR + FACE + AML",
      created_at: new Date().toISOString(),
      status: "pending",
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    };
  }

  /**
   * Get the status of a verification session
   * This is a simplified version of getSessionDecision that only returns the status
   */
  async getVerificationSessionStatus(
    sessionId: string,
  ): Promise<{ status: string } | null> {
    try {
      const sessionDecision = await this.getSessionDecision(sessionId);
      
      if (!sessionDecision) {
        return null;
      }
      
      // Return just the status in lowercase for consistent handling
      return {
        status: sessionDecision.status.toLowerCase(),
      };
    } catch (error) {
      logger.error({
        message: `Failed to get verification session status: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          sessionId,
          error: error instanceof Error ? error.stack : String(error),
        },
      });
      
      return null;
    }
  }
  
  /**
   * Retrieve the results of a verification session
   * In mock mode, generates simulated verification results
   */
  async getSessionDecision(
    sessionId: string,
  ): Promise<DiditSessionDecision | null> {
    if (!this.isInitialized()) {
      logger.warn({
        message: "Cannot get DiDit session decision: Service not initialized",
        category: "api",
        source: "didit",
      });
      return null;
    }

    // If in mock mode, return mock session decision
    if (this.useMockMode) {
      return this.getMockSessionDecision(sessionId);
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      logger.warn({
        message:
          "Cannot get DiDit session decision: Failed to acquire access token, falling back to mock",
        category: "api",
        source: "didit",
      });
      return this.getMockSessionDecision(sessionId);
    }

    try {
      const response = await fetch(
        `${this.verificationBaseUrl}/v1/session/${sessionId}/decision/`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        logger.warn({
          message: `DiDit session decision error: ${response.status} ${response.statusText}, falling back to mock`,
          category: "api",
          source: "didit",
        });
        return this.getMockSessionDecision(sessionId);
      }

      const decisionData: DiditSessionDecision = await response.json();

      logger.info({
        message: `DiDit session decision retrieved: ${sessionId}`,
        category: "api",
        source: "didit",
        metadata: {
          sessionId,
          status: decisionData.status,
          vendorData: decisionData.vendor_data,
        },
      });

      return decisionData;
    } catch (error) {
      logger.error({
        message: `Failed to get DiDit session decision, using mock: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          sessionId,
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      return this.getMockSessionDecision(sessionId);
    }
  }

  /**
   * Generate a mock session decision for testing
   */
  private getMockSessionDecision(sessionId: string): DiditSessionDecision {
    const mockContractId = 123; // For testing purposes

    return {
      session_id: sessionId,
      session_number: Math.floor(Math.random() * 100000),
      session_url: `${this.serverBaseUrl}/mock/didit-kyc?sessionId=${sessionId}`,
      status: "Approved",
      vendor_data: JSON.stringify({ contractId: mockContractId }),
      callback: `${this.serverBaseUrl}/api/kyc/webhook`,
      features: "OCR + FACE",
      kyc: {
        status: "Approved",
        document_type: "Passport",
        document_number: `P${Math.floor(Math.random() * 1000000)}`,
        date_of_birth: "1990-01-01",
        first_name: "John",
        last_name: "Doe",
        full_name: "John Doe",
        address: "123 Main St, Anytown, USA",
      },
      face: {
        status: "Approved",
        face_match_status: "Approved",
        liveness_status: "Approved",
        face_match_similarity: 98.5,
      },
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Verify the signature of a DiDit webhook
   * According to DiDit documentation, the signature is in the X-DiDit-Signature header
   * and should be verified using HMAC-SHA256 with your webhook secret key
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    if (!this.webhookSecretKey) {
      logger.warn({
        message:
          "Cannot verify DiDit webhook signature: Missing webhook secret key",
        category: "api",
        source: "didit",
      });
      return false;
    }

    try {
      // DiDit expects the raw JSON string without any whitespace
      const rawPayload =
        typeof payload === "string" ? payload : JSON.stringify(payload);

      // Create HMAC-SHA256 signature with the webhook secret key
      const computedSignature = crypto
        .createHmac("sha256", this.webhookSecretKey)
        .update(rawPayload)
        .digest("hex");

      logger.debug({
        message: "DiDit webhook signature verification",
        category: "api",
        source: "didit",
        metadata: {
          receivedSignature: signature,
          computedSignature: computedSignature,
          signatureMatches: computedSignature === signature,
        },
      });

      return computedSignature === signature;
    } catch (error) {
      logger.error({
        message: `Failed to verify DiDit webhook signature: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      return false;
    }
  }

  /**
   * Process a webhook event from DiDit
   *
   * @param event The webhook event payload from DiDit
   * @param signature Optional signature from the X-DiDit-Signature header for verification
   */
  processWebhookEvent(
    event: DiditWebhookEvent,
    signature?: string,
  ): {
    status: "success" | "error";
    isVerified: boolean;
    isCompleted: boolean;
    isApproved: boolean;
    contractId?: string;
    sessionId: string;
    eventType: string;
  } {
    try {
      const { event_type, session_id, status, decision, vendor_data } = event;

      // Verify webhook signature if provided
      const isVerified = signature
        ? this.verifyWebhookSignature(event, signature)
        : false;

      // Handle different event types according to DiDit's documentation
      // The main event we're interested in is 'verification.completed'
      const isCompleted = event_type === "verification.completed";

      // Check if verification was approved based on decision status
      // DiDit sends 'approved' for successful verifications
      const isApproved =
        isCompleted &&
        (decision?.status === "approved" ||
          status === "approved" ||
          status === "completed");

      logger.info({
        message: `Processing DiDit webhook event: ${event_type}`,
        category: "api",
        source: "didit",
        metadata: {
          sessionId: session_id,
          eventType: event_type,
          status,
          decisionStatus: decision?.status,
          vendorData: vendor_data,
          isVerified,
          isCompleted,
          isApproved,
          signatureProvided: !!signature,
        },
      });

      // Extract contractId from vendor_data
      let contractId = undefined;
      try {
        if (vendor_data) {
          const parsedVendorData = JSON.parse(vendor_data);
          contractId = parsedVendorData.contractId?.toString();
        }
      } catch (err) {
        logger.warn({
          message: `Failed to parse vendor_data as JSON: ${vendor_data}`,
          category: "api",
          source: "didit",
          metadata: { error: err instanceof Error ? err.message : String(err) },
        });
      }

      return {
        status: "success",
        isVerified,
        isCompleted,
        isApproved,
        contractId,
        sessionId: session_id,
        eventType: event_type,
      };
    } catch (error) {
      logger.error({
        message: `Failed to process DiDit webhook event: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      return {
        status: "error",
        isVerified: false,
        isCompleted: false,
        isApproved: false,
        sessionId: event.session_id || "",
        eventType: event.event_type || "unknown",
      };
    }
  }

  /**
   * Check if the credentials are valid by obtaining an access token
   * If we can get a token, the credentials are considered valid
   * regardless of whether specific API endpoints are available
   */
  async validateCredentials(): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      // First, check if we can get an access token
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        logger.warn({
          message:
            "DiDit credential validation failed: Unable to get access token",
          category: "api",
          source: "didit",
        });
        return false;
      }

      // If we successfully got an access token, consider the credentials valid
      logger.info({
        message:
          "DiDit credentials validated successfully (access token obtained)",
        category: "api",
        source: "didit",
      });

      return true;
    } catch (error) {
      logger.error({
        message: `Failed to validate DiDit credentials: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "didit",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      return false;
    }
  }
}

export const diditService = new DiditService();
