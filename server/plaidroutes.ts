// Plaid API Routes

// Create a link token - used to initialize Plaid Link
apiRouter.post(
  "/plaid/create-link-token",
  async (req: Request, res: Response) => {
    try {
      const { userId, userName, userEmail, products, redirectUri } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const clientUserId = userId.toString();

      logger.info({
        message: `Creating Plaid link token for user ${clientUserId}`,
        category: "api",
        source: "plaid",
        metadata: {
          userId: clientUserId,
          products,
        },
      });

      const linkTokenResponse = await plaidService.createLinkToken({
        userId: clientUserId,
        clientUserId,
        userName,
        userEmail,
        products, // Optional products array passed from frontend
        redirectUri, // Optional redirect URI for OAuth flow
      });

      res.json({
        success: true,
        linkToken: linkTokenResponse.linkToken,
        expiration: linkTokenResponse.expiration,
      });
    } catch (error) {
      logger.error({
        message: `Failed to create Plaid link token: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      res.status(500).json({
        success: false,
        message: "Failed to create Plaid link token",
      });
    }
  },
);

// Exchange public token for access token and store it
apiRouter.post(
  "/plaid/set-access-token",
  async (req: Request, res: Response) => {
    try {
      const { publicToken, userId, contractId } = req.body;

      if (!publicToken) {
        return res.status(400).json({
          success: false,
          message: "Public token is required",
        });
      }

      if (!userId && !contractId) {
        return res.status(400).json({
          success: false,
          message: "Either userId or contractId is required",
        });
      }

      logger.info({
        message: "Exchanging Plaid public token",
        category: "api",
        source: "plaid",
        metadata: { userId, contractId },
      });

      // Exchange public token for access token
      const exchangeResponse =
        await plaidService.exchangePublicToken(publicToken);

      // Get accounts and bank account details (routing, account numbers)
      const authData = await plaidService.getAuth(exchangeResponse.accessToken);

      // Store the access token and item ID in your database
      // In a real app, never return the access token to the client

      // Create a record of the user's bank information
      const bankInfo = {
        userId: userId ? parseInt(userId) : null,
        contractId: contractId ? parseInt(contractId) : null,
        accessToken: exchangeResponse.accessToken, // This should be encrypted in a real app
        itemId: exchangeResponse.itemId,
        accounts: authData.accounts,
        accountNumbers: authData.numbers,
        createdAt: new Date(),
      };

      // In a real app, store this in your database
      // For example:
      // await db.insert(bankAccounts).values(bankInfo);

      // If contract ID is provided, update the contract's bank step
      if (contractId) {
        // Find the bank step in the application progress
        const applicationProgress =
          await storage.getApplicationProgressByContractId(
            parseInt(contractId),
          );
        const bankStep = applicationProgress.find(
          (step) => step.step === "bank",
        );

        if (bankStep) {
          // Store the selected account ID and relevant bank information
          // For demo, we'll use the first account
          const selectedAccount = authData.accounts[0];
          const accountNumbers = authData.numbers.ach.find(
            (account) => account.account_id === selectedAccount.account_id,
          );

          // Mark the bank step as completed
          await storage.updateApplicationProgressCompletion(
            bankStep.id,
            true, // Completed
            JSON.stringify({
              verified: true,
              completedAt: new Date().toISOString(),
              itemId: exchangeResponse.itemId,
              accountId: selectedAccount.account_id,
              accountName: selectedAccount.name,
              accountMask: selectedAccount.mask,
              accountType: selectedAccount.type,
              accountSubtype: selectedAccount.subtype,
              routingNumber: accountNumbers?.routing,
              accountNumber: accountNumbers?.account,
            }),
          );

          // Move the contract to the next step if currently on bank step
          const contract = await storage.getContract(parseInt(contractId));
          if (contract && contract.currentStep === "bank") {
            await storage.updateContractStep(parseInt(contractId), "payment");
          }
        }
      }

      // Create a log entry
      await storage.createLog({
        level: "info",
        category: "api",
        source: "plaid",
        message: `Bank account linked successfully`,
        userId: userId ? parseInt(userId) : null,
        metadata: JSON.stringify({
          contractId,
          itemId: exchangeResponse.itemId,
          accountsCount: authData.accounts.length,
        }),
      });

      // Return success response with account information
      // Do NOT include the access token in the response
      res.json({
        success: true,
        accounts: authData.accounts,
        itemId: exchangeResponse.itemId,
        message: "Bank account linked successfully",
      });
    } catch (error) {
      logger.error({
        message: `Failed to exchange Plaid public token: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      // Create error log
      await storage.createLog({
        level: "error",
        category: "api",
        source: "plaid",
        message: `Failed to link bank account: ${error instanceof Error ? error.message : String(error)}`,
        metadata: JSON.stringify({
          error: error instanceof Error ? error.stack : null,
        }),
      });

      res.status(500).json({
        success: false,
        message: "Failed to link bank account",
      });
    }
  },
);

// Get account info for a specific user
apiRouter.get("/plaid/accounts", async (req: Request, res: Response) => {
  try {
    const { userId, contractId } = req.query;

    if (!userId && !contractId) {
      return res.status(400).json({
        success: false,
        message: "Either userId or contractId is required",
      });
    }

    // In a real app, fetch the access token from your database
    // For this example, we'll assume you stored it when exchanging the public token
    let accessToken = "";

    if (userId) {
      // Fetch access token for this user from your database
      // For example:
      // const bankAccount = await db.query.bankAccounts.findFirst({
      //   where: eq(bankAccounts.userId, parseInt(userId as string))
      // });
      // accessToken = bankAccount?.accessToken;
    } else if (contractId) {
      // Fetch access token for this contract from your database
      // For example:
      // const bankAccount = await db.query.bankAccounts.findFirst({
      //   where: eq(bankAccounts.contractId, parseInt(contractId as string))
      // });
      // accessToken = bankAccount?.accessToken;

      // For demo purposes, let's get the bank information from the application progress
      const applicationProgress =
        await storage.getApplicationProgressByContractId(
          parseInt(contractId as string),
        );
      const bankStep = applicationProgress.find((step) => step.step === "bank");

      if (bankStep && bankStep.data) {
        try {
          const bankData = JSON.parse(bankStep.data);

          // Return the stored bank information without needing to call Plaid again
          return res.json({
            success: true,
            bankInfo: {
              accountId: bankData.accountId,
              accountName: bankData.accountName,
              accountMask: bankData.accountMask,
              accountType: bankData.accountType,
              accountSubtype: bankData.accountSubtype,
              routingNumber: bankData.routingNumber,
              accountNumber: bankData.accountNumber,
            },
          });
        } catch (parseError) {
          logger.error({
            message: `Failed to parse bank data: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            category: "api",
            source: "plaid",
            metadata: {
              contractId,
              bankData: bankStep.data,
            },
          });
        }
      }
    }

    if (!accessToken) {
      return res.status(404).json({
        success: false,
        message: "No linked bank account found",
      });
    }

    // Call Plaid to get the latest account info
    const authData = await plaidService.getAuth(accessToken);

    res.json({
      success: true,
      accounts: authData.accounts,
      numbers: authData.numbers,
    });
  } catch (error) {
    logger.error({
      message: `Failed to get Plaid accounts: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "plaid",
      metadata: {
        error: error instanceof Error ? error.stack : null,
      },
    });

    res.status(500).json({
      success: false,
      message: "Failed to get bank account information",
    });
  }
});

// Create a transfer (payment)
apiRouter.post(
  "/plaid/create-transfer",
  async (req: Request, res: Response) => {
    try {
      const { contractId, amount, description } = req.body;

      if (!contractId || !amount) {
        return res.status(400).json({
          success: false,
          message: "Contract ID and amount are required",
        });
      }

      // Get contract details
      const contract = await storage.getContract(parseInt(contractId));
      if (!contract) {
        return res.status(404).json({
          success: false,
          message: "Contract not found",
        });
      }

      // Get customer details if available
      let customerName = "Customer";
      if (contract.customerId) {
        const customer = await storage.getUser(contract.customerId);
        if (customer) {
          customerName = customer.name;
        }
      }

      // Get the bank information from the application progress
      const applicationProgress =
        await storage.getApplicationProgressByContractId(parseInt(contractId));
      const bankStep = applicationProgress.find((step) => step.step === "bank");

      if (!bankStep || !bankStep.completed || !bankStep.data) {
        return res.status(400).json({
          success: false,
          message: "Bank account not linked for this contract",
        });
      }

      // Parse bank data
      let bankData;
      try {
        bankData = JSON.parse(bankStep.data);
      } catch (parseError) {
        logger.error({
          message: `Failed to parse bank data: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          category: "api",
          source: "plaid",
          metadata: {
            contractId,
            bankData: bankStep.data,
          },
        });

        return res.status(500).json({
          success: false,
          message: "Failed to process bank information",
        });
      }

      // In a real app, fetch the access token from your database
      // For this example, we'll simulate the transfer creation

      // Log the transfer request
      logger.info({
        message: `Processing payment transfer for contract ${contractId}`,
        category: "payment",
        source: "plaid",
        metadata: {
          contractId,
          amount,
          description:
            description ||
            `Monthly payment for contract ${contract.contractNumber}`,
        },
      });

      // In a real implementation, you would:
      // 1. Retrieve the access token from your database
      // 2. Make the actual transfer API call
      // For now, we'll simulate a successful transfer

      const transferId = "tr_" + Math.random().toString(36).substring(2, 15);
      const status = "pending";

      // Create a record of the payment
      const paymentInfo = {
        contractId: parseInt(contractId),
        amount,
        description:
          description ||
          `Monthly payment for contract ${contract.contractNumber}`,
        transferId,
        status,
        accountId: bankData.accountId,
        createdAt: new Date(),
      };

      // In a real app, store this in your database
      // For example:
      // await db.insert(payments).values(paymentInfo);

      // Create a log entry
      await storage.createLog({
        level: "info",
        category: "payment",
        source: "plaid",
        message: `Payment initiated for contract ${contractId}`,
        metadata: JSON.stringify({
          contractId,
          amount,
          transferId,
          status,
        }),
      });

      // Return success response
      res.json({
        success: true,
        transferId,
        status,
        message: "Payment initiated successfully",
      });
    } catch (error) {
      logger.error({
        message: `Failed to create Plaid transfer: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      // Create error log
      await storage.createLog({
        level: "error",
        category: "payment",
        source: "plaid",
        message: `Failed to initiate payment: ${error instanceof Error ? error.message : String(error)}`,
        metadata: JSON.stringify({
          error: error instanceof Error ? error.stack : null,
        }),
      });

      res.status(500).json({
        success: false,
        message: "Failed to initiate payment",
      });
    }
  },
);

// Create an asset report (for income verification / underwriting)
apiRouter.post(
  "/plaid/create-asset-report",
  async (req: Request, res: Response) => {
    try {
      const { userId, contractId, daysRequested = 60 } = req.body;

      if (!userId && !contractId) {
        return res.status(400).json({
          success: false,
          message: "Either userId or contractId is required",
        });
      }

      // In a real app, fetch the access token from your database
      // For this example, we'll simulate the asset report creation

      logger.info({
        message: `Creating asset report`,
        category: "api",
        source: "plaid",
        metadata: {
          userId,
          contractId,
          daysRequested,
        },
      });

      // Simulate creating an asset report
      // In a real implementation, you would:
      // 1. Retrieve the access token from your database
      // 2. Make the actual asset report API call

      const assetReportId =
        "asset_" + Math.random().toString(36).substring(2, 15);
      const assetReportToken =
        "asset-token-" + Math.random().toString(36).substring(2, 15);

      // Create a record of the asset report
      const assetReportInfo = {
        userId: userId ? parseInt(userId) : null,
        contractId: contractId ? parseInt(contractId) : null,
        assetReportId,
        assetReportToken, // This should be encrypted in a real app
        daysRequested,
        status: "pending",
        createdAt: new Date(),
      };

      // In a real app, store this in your database
      // For example:
      // await db.insert(assetReports).values(assetReportInfo);

      // Create a log entry
      await storage.createLog({
        level: "info",
        category: "api",
        source: "plaid",
        message: `Asset report created`,
        userId: userId ? parseInt(userId) : null,
        metadata: JSON.stringify({
          contractId,
          assetReportId,
          daysRequested,
        }),
      });

      // Return success response
      // Do NOT include the asset report token in the response
      res.json({
        success: true,
        assetReportId,
        message: "Asset report created successfully",
      });
    } catch (error) {
      logger.error({
        message: `Failed to create Plaid asset report: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      // Create error log
      await storage.createLog({
        level: "error",
        category: "api",
        source: "plaid",
        message: `Failed to create asset report: ${error instanceof Error ? error.message : String(error)}`,
        metadata: JSON.stringify({
          error: error instanceof Error ? error.stack : null,
        }),
      });

      res.status(500).json({
        success: false,
        message: "Failed to create asset report",
      });
    }
  },
);

// Get an asset report
apiRouter.get(
  "/plaid/asset-report/:assetReportId",
  async (req: Request, res: Response) => {
    try {
      const { assetReportId } = req.params;

      if (!assetReportId) {
        return res.status(400).json({
          success: false,
          message: "Asset report ID is required",
        });
      }

      // In a real app, fetch the asset report token from your database
      // For this example, we'll simulate the asset report retrieval

      logger.info({
        message: `Retrieving asset report`,
        category: "api",
        source: "plaid",
        metadata: { assetReportId },
      });

      // Simulate getting an asset report
      // In a real implementation, you would:
      // 1. Retrieve the asset report token from your database
      // 2. Make the actual asset report API call

      // Create some mock asset report data
      const mockAssetReport = {
        assetReportId,
        createdDate: new Date().toISOString(),
        daysRequested: 60,
        user: {
          firstName: "John",
          lastName: "Doe",
        },
        items: [
          {
            institutionName: "Chase",
            lastUpdated: new Date().toISOString(),
            accounts: [
              {
                accountId: "acc_" + Math.random().toString(36).substring(2, 10),
                accountName: "Chase Checking",
                type: "depository",
                subtype: "checking",
                currentBalance: 5280.25,
                availableBalance: 5200.1,
                transactions: [
                  {
                    transactionId:
                      "tx_" + Math.random().toString(36).substring(2, 10),
                    date: new Date(
                      Date.now() - 3 * 24 * 60 * 60 * 1000,
                    ).toISOString(),
                    description: "WALMART",
                    amount: 45.23,
                    pending: false,
                  },
                  {
                    transactionId:
                      "tx_" + Math.random().toString(36).substring(2, 10),
                    date: new Date(
                      Date.now() - 5 * 24 * 60 * 60 * 1000,
                    ).toISOString(),
                    description: "AMAZON",
                    amount: 67.89,
                    pending: false,
                  },
                ],
              },
              {
                accountId: "acc_" + Math.random().toString(36).substring(2, 10),
                accountName: "Chase Savings",
                type: "depository",
                subtype: "savings",
                currentBalance: 10250.75,
                availableBalance: 10250.75,
                transactions: [
                  {
                    transactionId:
                      "tx_" + Math.random().toString(36).substring(2, 10),
                    date: new Date(
                      Date.now() - 10 * 24 * 60 * 60 * 1000,
                    ).toISOString(),
                    description: "TRANSFER FROM CHECKING",
                    amount: -500.0,
                    pending: false,
                  },
                ],
              },
            ],
          },
        ],
        summary: {
          totalAccounts: 2,
          totalTransactions: 3,
          totalBalances: 15531.0,
          income: {
            estimatedMonthlyIncome: 5200,
            estimatedAnnualIncome: 62400,
            confidenceScore: 0.95,
          },
        },
      };

      // Create a log entry
      await storage.createLog({
        level: "info",
        category: "api",
        source: "plaid",
        message: `Asset report retrieved`,
        metadata: JSON.stringify({
          assetReportId,
        }),
      });

      // Return success response with the asset report data
      res.json({
        success: true,
        assetReport: mockAssetReport,
      });
    } catch (error) {
      logger.error({
        message: `Failed to get Plaid asset report: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      // Create error log
      await storage.createLog({
        level: "error",
        category: "api",
        source: "plaid",
        message: `Failed to retrieve asset report: ${error instanceof Error ? error.message : String(error)}`,
        metadata: JSON.stringify({
          error: error instanceof Error ? error.stack : null,
        }),
      });

      res.status(500).json({
        success: false,
        message: "Failed to retrieve asset report",
      });
    }
  },
);

// Plaid webhook handler
apiRouter.post("/plaid/webhook", async (req: Request, res: Response) => {
  try {
    const { webhook_type, webhook_code, item_id } = req.body;

    logger.info({
      message: `Received Plaid webhook`,
      category: "api",
      source: "plaid",
      metadata: {
        webhookType: webhook_type,
        webhookCode: webhook_code,
        itemId: item_id,
      },
    });

    // Handle different webhook types
    switch (webhook_type) {
      case "TRANSACTIONS":
        // Handle transaction webhooks
        switch (webhook_code) {
          case "INITIAL_UPDATE":
            logger.info({
              message: "Initial transaction update received",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
          case "HISTORICAL_UPDATE":
            logger.info({
              message: "Historical transaction update received",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
          case "DEFAULT_UPDATE":
            logger.info({
              message: "Default transaction update received",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
          case "TRANSACTIONS_REMOVED":
            logger.info({
              message: "Transactions removed notification received",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
        }
        break;

      case "ITEM":
        // Handle item webhooks
        switch (webhook_code) {
          case "ERROR":
            logger.warn({
              message: "Item error received",
              category: "api",
              source: "plaid",
              metadata: {
                itemId: item_id,
                error: req.body.error,
              },
            });
            break;
          case "PENDING_EXPIRATION":
            logger.warn({
              message: "Item pending expiration",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
          case "USER_PERMISSION_REVOKED":
            logger.warn({
              message: "User permission revoked",
              category: "api",
              source: "plaid",
              metadata: { itemId: item_id },
            });
            break;
        }
        break;

      case "AUTH":
        // Handle auth webhooks
        logger.info({
          message: `Auth webhook received: ${webhook_code}`,
          category: "api",
          source: "plaid",
          metadata: { itemId: item_id },
        });
        break;

      case "ASSETS":
        // Handle assets webhooks
        logger.info({
          message: `Assets webhook received: ${webhook_code}`,
          category: "api",
          source: "plaid",
          metadata: {
            itemId: item_id,
            assetReportId: req.body.asset_report_id,
          },
        });
        break;

      case "INCOME":
        // Handle income webhooks
        logger.info({
          message: `Income webhook received: ${webhook_code}`,
          category: "api",
          source: "plaid",
          metadata: { itemId: item_id },
        });
        break;

      case "TRANSFER":
        // Handle transfer webhooks
        switch (webhook_code) {
          case "TRANSFER_CREATED":
            logger.info({
              message: "Transfer created",
              category: "payment",
              source: "plaid",
              metadata: {
                itemId: item_id,
                transferId: req.body.transfer_id,
              },
            });
            break;
          case "TRANSFER_FAILED":
            logger.warn({
              message: "Transfer failed",
              category: "payment",
              source: "plaid",
              metadata: {
                itemId: item_id,
                transferId: req.body.transfer_id,
                failureReason: req.body.failure_reason,
              },
            });
            break;
          case "TRANSFER_COMPLETED":
            logger.info({
              message: "Transfer completed",
              category: "payment",
              source: "plaid",
              metadata: {
                itemId: item_id,
                transferId: req.body.transfer_id,
              },
            });
            break;
        }
        break;

      default:
        logger.info({
          message: `Unhandled Plaid webhook type: ${webhook_type}`,
          category: "api",
          source: "plaid",
          metadata: {
            webhookType: webhook_type,
            webhookCode: webhook_code,
            itemId: item_id,
          },
        });
    }

    // Always return a 200 status to acknowledge receipt of the webhook
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error({
      message: `Error processing Plaid webhook: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "plaid",
      metadata: {
        error: error instanceof Error ? error.stack : null,
        body: req.body,
      },
    });

    // Still return 200 to acknowledge receipt
    res.status(200).json({
      received: true,
      error: "Error processing webhook",
    });
  }
});
