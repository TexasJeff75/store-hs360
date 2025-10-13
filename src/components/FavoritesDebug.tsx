import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFavorites } from '../contexts/FavoritesContext';

const FavoritesDebug: React.FC = () => {
  const { user } = useAuth();
  const { favorites, isFavorite, toggleFavorite, isLoading, animatingProductId } = useFavorites();

  useEffect(() => {
    console.log('=== FAVORITES DEBUG ===');
    console.log('User:', user?.email, user?.id);
    console.log('Favorites:', favorites);
    console.log('Is Loading:', isLoading);
    console.log('Animating Product ID:', animatingProductId);
  }, [user, favorites, isLoading, animatingProductId]);

  const testFavorite = async () => {
    console.log('🧪 Testing favorite with product ID 1');
    await toggleFavorite(1);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 border-2 border-yellow-400 p-4 rounded-lg shadow-lg z-50 max-w-sm">
      <h3 className="font-bold text-sm mb-2">Favorites Debug Panel</h3>
      <div className="text-xs space-y-1">
        <p><strong>User:</strong> {user?.email || 'Not logged in'}</p>
        <p><strong>User ID:</strong> {user?.id || 'N/A'}</p>
        <p><strong>Favorites Count:</strong> {favorites.length}</p>
        <p><strong>Favorites:</strong> {favorites.join(', ') || 'None'}</p>
        <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
        <button
          onClick={testFavorite}
          className="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
        >
          Test Favorite (Product 1)
        </button>
      </div>
    </div>
  );
};

export default FavoritesDebug;
