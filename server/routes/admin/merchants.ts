// Get all merchants
router.get("/", async (req: Request, res: Response) => {
  try {
    const merchants = await storage.getAllMerchants();
    res.json({ success: true, merchants });
  } catch (error) {
    console.error("Get merchants error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch merchants",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});