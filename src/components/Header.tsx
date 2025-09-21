import React from 'react';
import { ShoppingCart, User, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
  onAuthClick: () => void;
  onProfileClick: () => void;
  onAdminClick: () => void;
}

const Header: React.FC<HeaderProps> = ({
  cartCount,
  onCartClick,
  onAuthClick,
  onProfileClick,
  onAdminClick
}) => {
  const { user, profile, loading } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent">
                HealthSpan360
              </h1>
              {loading && (
              <span className="text-sm text-gray-600 hidden sm:inline">Loading...</span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-8">
            <a href="#" className="text-gray-700 hover:text-pink-600 transition-colors">
              Products
            </a>
            <a href="#" className="text-gray-700 hover:text-pink-600 transition-colors">
              About
            </a>
            <a href="#" className="text-gray-700 hover:text-pink-600 transition-colors">
              Contact
            </a>
          </nav>

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

            {/* User Authentication */}
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-600"></div>
                <span className="text-sm text-gray-600">Loading...</span>
              </div>
            ) : user ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onProfileClick}
                  className="flex items-center space-x-2 text-gray-700 hover:text-pink-600 transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span className="hidden sm:inline">
                    {profile?.email?.split('@')[0] || user.email?.split('@')[0] || 'Profile'}
                  </span>
                </button>
                
                {profile?.role === 'admin' && (
                  <button
                    onClick={onAdminClick}
                    className="flex items-center space-x-2 text-gray-700 hover:text-pink-600 transition-colors"
                  >
                    <Settings className="w-5 h-5" />
                    <span className="hidden sm:inline">Admin</span>
                  </button>
                )}
              </div>
            ) : (
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