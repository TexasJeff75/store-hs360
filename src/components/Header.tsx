import React from 'react';
import { ShoppingCart, User, Settings, Users, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
  onAuthClick: () => void;
  onProfileClick: () => void;
  onAdminClick: () => void;
  onSalesRepClick: () => void;
}

const Header: React.FC<HeaderProps> = ({
  cartCount,
  onCartClick,
  onAuthClick,
  onProfileClick,
  onAdminClick,
  onSalesRepClick
}) => {
  const { user, profile, loading } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 transition-transform hover:scale-105 active:scale-95">
              <a href="#" className="flex items-center space-x-3">
                <div>
                  <span className="text-2xl font-poppins font-bold bg-gradient-primary bg-clip-text text-transparent block transition-all hover:drop-shadow-lg">
                    HealthSpan360
                  </span>
                  <span className="text-xs font-poppins text-cool-gray -mt-1 block">
                    Turning Insight Into Impact
                  </span>
                </div>
              </a>
            </div>
          </div>

          {/* Center Navigation */}
          <div className="flex items-center space-x-6">
            {/* Home Button */}
            <a href="#" className="flex items-center space-x-2 text-gray-700 hover:text-pink-600 transition-colors">
              <Home className="w-5 h-5" />
              <span className="hidden sm:inline">Home</span>
            </a>

            {/* User Actions - Middle */}
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-600"></div>
                <span className="text-sm text-gray-600">Loading...</span>
              </div>
            ) : user ? (
              <div className="flex items-center space-x-4">
                {profile?.role === 'admin' && (
                  <button
                    onClick={onSalesRepClick}
                    className="flex items-center space-x-2 text-gray-700 hover:text-pink-600 transition-colors"
                  >
                    <Users className="w-5 h-5" />
                    <span className="hidden sm:inline">Select Organization</span>
                  </button>
                )}

                {profile?.role === 'admin' && (
                  <button
                    onClick={onAdminClick}
                    className="flex items-center space-x-2 text-gray-700 hover:text-pink-600 transition-colors"
                  >
                    <Settings className="w-5 h-5" />
                    <span className="hidden sm:inline">Admin</span>
                  </button>
                )}

                <button
                  onClick={onProfileClick}
                  className="flex items-center space-x-2 text-gray-700 hover:text-pink-600 transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span className="hidden sm:inline">
                    {profile?.email?.split('@')[0] || user.email?.split('@')[0] || 'Profile'}
                  </span>
                </button>
              </div>
            ) : null}
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Cart */}
            <button
              onClick={onCartClick}
              className="relative p-2 text-gray-700 hover:text-pink-600 transition-colors"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Sign In Button */}
            {!loading && !user && (
              <button
                type="button"
                onClick={onAuthClick}
                className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-4 py-2 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;