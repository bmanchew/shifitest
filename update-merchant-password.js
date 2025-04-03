// Using ES modules with direct SQL to avoid TS import issues
import { exec } from 'child_process';
import bcrypt from 'bcrypt';

async function updatePassword() {
  try {
    const userId = 2;
    const newPassword = 'password123';
    
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update the password using direct SQL execution
    const sqlCommand = `
      UPDATE users
      SET password = '${hashedPassword}'
      WHERE id = ${userId}
      RETURNING id, email;
    `;
    
    exec(`echo "${sqlCommand}" | psql $DATABASE_URL`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing SQL: ${error}`);
        process.exit(1);
      }
      
      console.log('SQL execution result:');
      console.log(stdout);
      
      console.log(`Password updated for user ID ${userId}`);
      console.log(`New password: ${newPassword}`);
      console.log(`Hashed value: ${hashedPassword}`);
      
      process.exit(0);
    });
  } catch (error) {
    console.error('Error updating password:', error);
    process.exit(1);
  }
}

updatePassword();
