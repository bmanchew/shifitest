
import React from 'react';
import { NavLink } from 'react-router-dom';

const AdminNavigation: React.FC = () => {
  return (
    <nav className="space-y-1">
      <NavLink
        to="/admin/dashboard"
        className={({ isActive }) =>
          `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            isActive
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`
        }
      >
        Dashboard
      </NavLink>
      
      <NavLink
        to="/admin/contracts"
        className={({ isActive }) =>
          `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            isActive
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`
        }
      >
        Contracts
      </NavLink>
      
      <NavLink
        to="/admin/users"
        className={({ isActive }) =>
          `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            isActive
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`
        }
      >
        Users
      </NavLink>
      
      <NavLink
        to="/admin/merchants"
        className={({ isActive }) =>
          `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            isActive
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`
        }
      >
        Merchants
      </NavLink>
      
      <NavLink
        to="/admin/portfolio"
        className={({ isActive }) =>
          `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            isActive
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`
        }
      >
        Portfolio
      </NavLink>
      
      <NavLink
        to="/admin/settings"
        className={({ isActive }) =>
          `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            isActive
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`
        }
      >
        Settings
      </NavLink>
    </nav>
  );
};

export default AdminNavigation;
