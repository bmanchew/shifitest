
const { Client } = require('pg');

async function checkContract() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    
    // Get contract details
    const contractResult = await client.query(`
      SELECT * FROM contracts WHERE id = 69
    `);
    
    if (contractResult.rows.length === 0) {
      console.log('Contract 69 not found');
      return;
    }
    
    const contract = contractResult.rows[0];
    console.log('Contract details:', contract);
    
    // Get customer info if customerId exists
    if (contract.customer_id) {
      const userResult = await client.query(`
        SELECT * FROM users WHERE id = $1
      `, [contract.customer_id]);
      
      if (userResult.rows.length > 0) {
        console.log('Customer details:', userResult.rows[0]);
      } else {
        console.log('Customer not found despite having customer_id:', contract.customer_id);
      }
    } else {
      console.log('No customer_id associated with this contract');
    }
    
    // Get application progress
    const progressResult = await client.query(`
      SELECT * FROM application_progress WHERE contract_id = 69 ORDER BY id
    `);
    
    console.log('Application progress entries:', progressResult.rows);
    
    // Get logs related to this contract
    const logsResult = await client.query(`
      SELECT * FROM logs 
      WHERE metadata LIKE '%"contractId":69%' OR metadata LIKE '%"contractId": 69%'
      ORDER BY timestamp DESC
      LIMIT 20
    `);
    
    console.log('Recent logs related to contract 69:');
    logsResult.rows.forEach(log => {
      console.log(`[${log.timestamp}] [${log.level}] ${log.message}`);
      console.log(`Metadata: ${log.metadata}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkContract();
