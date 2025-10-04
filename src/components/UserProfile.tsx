import React, { useState } from 'react';
import { User, Mail, Shield, Clock, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ isOpen, onClose }) => {
  const { user, profile, signOut, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSignOut = async () => {
    setLoading(true);
    const { error } = await signOut();
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      onClose();
    }
    setLoading(false);
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'admin':
        return { text: 'Administrator', color: 'text-purple-700 bg-purple-100', icon: Shield };
      case 'approved':
        return { text: 'Approved User', color: 'text-green-700 bg-green-100', icon: CheckCircle };
      case 'pending':
      default:
        return { text: 'Pending Approval', color: 'text-yellow-700 bg-yellow-100', icon: Clock };
    }
  };

  if (!isOpen || !user || !profile) return null;

  const roleInfo = getRoleDisplay(profile.role);
  const RoleIcon = roleInfo.icon;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">User Profile</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Message */}
            {message && (
              <div className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
                message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <span className={`text-sm ${
                  message.type === 'success' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {message.text}
                </span>
              </div>
            )}

            {/* User Info */}
            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center">
                  <User className="h-10 w-10 text-white" />
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Email</p>
                  <p className="text-sm text-gray-600">{profile.email}</p>
                </div>
              </div>

              {/* Role & Status */}
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <RoleIcon className="h-5 w-5 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Account Status</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                      {roleInfo.text}
                    </span>
                    {profile.is_approved && (
                      <span className="text-xs text-green-600">✓ Contract Pricing Available</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Account Created */}
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Member Since</p>
                  <p className="text-sm text-gray-600">
                    {new Date(profile.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {/* Status Message */}
              {profile.role === 'pending' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-700 text-sm">
                    <strong>Account Pending:</strong> Your account is under review. 
                    Once approved, you'll have access to contract pricing and additional features.
                  </p>
                </div>
              )}

              {profile.role === 'approved' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-700 text-sm">
                    <strong>Account Approved:</strong> You now have access to contract pricing 
                    and all premium features.
                  </p>
                </div>
              )}

              {profile.role === 'admin' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-purple-700 text-sm">
                    <strong>Administrator:</strong> You have full access to all features 
                    and administrative functions.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;