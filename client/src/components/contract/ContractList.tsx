import React from 'react';
import { Button, Link } from '@chakra-ui/react'; // Assuming Chakra UI is used

const ContractRow = ({ row }) => {
  return (
    <tr>
      {/* ... other table cells ... */}
      <td>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/contracts/${row.original.id}`}>View Details</Link>
          </Button>
        </div>
      </td>
    </tr>
  );
};

export default ContractRow;