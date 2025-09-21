import React from 'react';

const Hero: React.FC = () => {
  return (
    <section className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <button className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all">
              </button>
              <button className="border-2 border-gray-600 text-gray-300 px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 hover:text-white transition-colors">
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-3 gap-6">
              <div className="flex items-center space-x-3">
                <div>
                  <div className="font-semibold text-white"></div>
                  <div className="text-sm text-gray-400"></div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div>
                  <div className="font-semibold text-white"></div>
                  <div className="text-sm text-gray-400"></div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div>
                  <div className="font-semibold text-white"></div>
                  <div className="text-sm text-gray-400"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="relative z-10">
            <div className="relative z-10">
              <div className="w-80 h-80 mx-auto bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 rounded-full flex items-center justify-center relative">
                <div className="w-64 h-64 bg-gray-900 rounded-full flex items-center justify-center">
                </div>
                {/* Animation */}
                <div className="absolute inset-0 rounded-full border-4 border-dashed border-pink-300 animate-spin" style={{ animationDuration: '20s' }}></div>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-600/20 to-orange-600/20 rounded-full transform translate-x-6 translate-y-6"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;