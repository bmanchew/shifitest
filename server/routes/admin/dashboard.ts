router.get("/dashboard-stats", async (req, res) => {
  const { storage } = await import('../../storage');
  const merchants = await storage.merchant.findMany({
    where: {
      active: true
    }
  });
  const contracts = await storage.contract.findMany();

  const stats = {
    activeMerchants: merchants.length,
    activeContracts: contracts.filter(c => c.status === 'active').length,
    pendingContracts: contracts.filter(c => c.status === 'pending').length,
  };
  res.json(stats);
});