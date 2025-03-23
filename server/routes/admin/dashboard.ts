router.get("/dashboard-stats", async (req, res) => {
  const { storage } = await import('../../storage');
  
  // Use getAllMerchants to ensure we get all merchants with proper active status
  const merchants = await storage.getAllMerchants();
  const activeCount = merchants.filter(m => m.active).length;
  
  const contracts = await storage.contract.findMany();

  const stats = {
    activeMerchants: activeCount,
    activeContracts: contracts.filter(c => c.status === 'active').length,
    pendingContracts: contracts.filter(c => c.status === 'pending').length,
  };
  res.json(stats);
});
</old_str>