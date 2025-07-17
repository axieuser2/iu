import React from 'react';
import { Shield } from 'lucide-react';
import { useConnection } from '../contexts/ConnectionContext';

const Header: React.FC = () => {
  const { isConnected, isSecureConnection } = useConnection();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <a 
            href="https://www.axiestudio.se" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <img 
              src="https://www.axiestudio.se/logo.jpg" 
              alt="Axie Studio" 
              className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg object-cover"
              loading="eager"
            />
            <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">
              Axie Studio
            </h1>
          </a>
        </div>
        
        {/* Security Status Indicator */}
        {isConnected && (
          <div className="flex items-center space-x-2 text-emerald-600">
            <Shield size={16} />
            <span className="text-xs font-medium hidden sm:inline">
              {isSecureConnection ? 'Secure' : 'Connected'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;