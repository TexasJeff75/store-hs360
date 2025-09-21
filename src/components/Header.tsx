import React, { useState } from 'react';
import { Search, ShoppingCart, User, Menu, X, Heart, Dna, LogIn, UserCheck, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import UserProfile from './UserProfile';
import AdminDashboard from './admin/AdminDashboard';

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ cartCount, onCartClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const { user, profile } = useAuth();

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center">
                <Dna className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">
                  HealthSpan360
                </h1>
                <p className="text-xs text-gray-500">Turning Insight Into Impact</p>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
              Home
            </a>
            <a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
              About
            </a>
            <a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
              Services
            </a>
            <a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
              For Providers
            </a>
            <a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
              For Patients
            </a>
            <a href="#" className="text-gray-700 hover:text-pink-600 px-3 py-2 text-sm font-medium transition-colors">
              Resources
            </a>
            <a href="#" className="text-gray-700 hover:text-pink-600 px-3 py-2 text-sm font-medium transition-colors">
              Contact
            </a>
          </nav>

          {/* Search Bar */}
          <div className="hidden md:flex items-center flex-1 max-w-lg mx-8">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search for products..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* Right Side Icons */}
          <div className="flex items-center space-x-4">
            <button className="text-gray-700 hover:text-blue-600 transition-colors">
              <Heart className="h-6 w-6" />
            </button>
            
            {/* User Authentication */}
            {user ? (
              <div className="flex items-center space-x-2">
                {/* Admin Button */}
                {profile?.role === 'admin' && (
                  <button 
                    onClick={() => setIsAdminOpen(true)}
                    className="text-gray-700 hover:text-purple-600 transition-colors"
                    title="Admin Dashboard"
                  >
                    <Settings className="h-6 w-6" />
                  </button>
                )}
                
                {/* User Profile Button */}
                <button 
                  onClick={() => setIsProfileOpen(true)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors"
                >
                  <div className="relative">
                    <User className="h-6 w-6" />
                    {profile?.role === 'approved' && (
                      <UserCheck className="h-3 w-3 text-green-600 absolute -top-1 -right-1" />
                    )}
                  </div>
                  <span className="hidden md:block text-sm font-medium">
                    {profile?.email?.split('@')[0] || 'User'}
                  </span>
                </button>
               </div>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors"
                type="button"
              >
                <LogIn className="h-6 w-6" />
                <span className="hidden md:block text-sm font-medium">Sign In</span>
              </button>
            )}
            
            <button 
              onClick={onCartClick}
              className="text-gray-700 hover:text-pink-600 transition-colors relative"
            >
              <ShoppingCart className="h-6 w-6" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
            
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-gray-700 hover:text-pink-600 transition-colors"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
              <a href="#" className="text-gray-700 hover:text-pink-600 block px-3 py-2 text-base font-medium">
                Home
              </a>
              <a href="#" className="text-gray-700 hover:text-pink-600 block px-3 py-2 text-base font-medium">
                About
              </a>
              <a href="#" className="text-gray-700 hover:text-pink-600 block px-3 py-2 text-base font-medium">
                Services
              </a>
              <a href="#" className="text-gray-700 hover:text-pink-600 block px-3 py-2 text-base font-medium">
                For Providers
              </a>
              <a href="#" className="text-gray-700 hover:text-pink-600 block px-3 py-2 text-base font-medium">
                For Patients
              </a>
              <a href="#" className="text-gray-700 hover:text-pink-600 block px-3 py-2 text-base font-medium">
                Resources
              </a>
              <a href="#" className="text-gray-700 hover:text-pink-600 block px-3 py-2 text-base font-medium">
                Contact
              </a>
              {/* Mobile Search */}
              <div className="px-3 py-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search for products..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />

      {/* User Profile Modal */}
      <UserProfile 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />

      {/* Admin Dashboard */}
      <AdminDashboard 
        isOpen={isAdminOpen} 
        onClose={() => setIsAdminOpen(false)} 
      />
    </header>
  );
};

export default Header;