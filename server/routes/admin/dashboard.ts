router.get("/dashboard-stats", async (req, res) => {
  const { storage } = await import('../../storage');
  
  try {
    // Get all merchants to calculate metrics
    const merchants = await storage.getAllMerchants();
    const totalMerchants = merchants.length;
    const activeMerchants = merchants.filter(m => m.active && !m.archived).length;
    
    // Get all contracts
    const contracts = await storage.getAllContracts();
    const activeContracts = contracts.filter(c => c.status === 'active').length;
    const pendingContracts = contracts.filter(c => c.status === 'pending').length;
    
    // Get total users count - this uses the private helper method from storage
    const users = await storage.getAllUsers();
    const totalUsers = users.length;

    const stats = {
      success: true,
      data: {
        totalMerchants,
        activeMerchants,
        totalUsers,
        activeContracts,
        pendingContracts
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch dashboard stats" 
    });
  }
});
</old_str>