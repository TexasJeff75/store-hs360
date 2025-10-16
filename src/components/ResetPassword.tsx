import React, { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ResetPasswordProps {
  onComplete: () => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onComplete }) => {
  const { resetPassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const { error: resetError } = await resetPassword(newPassword);

    setLoading(false);

    if (resetError) {
      setError(resetError.message || 'Failed to reset password');
    } else {
      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Complete!</h2>
          <p className="text-gray-600">
            Your password has been successfully reset. You can now access your account with your new password.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="mb-6 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <Lock className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Your Password</h2>
          <p className="text-gray-600">
            Please enter your new password below. Make sure it's strong and secure.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-600 space-y-1">
              <p>Password must contain:</p>
              <ul className="list-disc list-inside pl-2 space-y-1">
                <li className={newPassword.length >= 8 ? 'text-green-600' : ''}>
                  At least 8 characters
                </li>
                <li className={/[A-Z]/.test(newPassword) ? 'text-green-600' : ''}>
                  One uppercase letter
                </li>
                <li className={/[a-z]/.test(newPassword) ? 'text-green-600' : ''}>
                  One lowercase letter
                </li>
                <li className={/[0-9]/.test(newPassword) ? 'text-green-600' : ''}>
                  One number
                </li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 px-6 rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>

        <p className="mt-6 text-xs text-center text-gray-500">
          After resetting your password, you'll be able to access your account immediately.
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
