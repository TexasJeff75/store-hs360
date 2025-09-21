import React from 'react';
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Youtube } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent mb-4"></h3>
            <p className="text-gray-300 mb-4 leading-relaxed"></p>
            <div className="flex space-x-4">
              <Facebook className="h-6 w-6 text-gray-400 hover:text-pink-400 cursor-pointer transition-colors" />
              <Twitter className="h-6 w-6 text-gray-400 hover:text-pink-400 cursor-pointer transition-colors" />
              <Instagram className="h-6 w-6 text-gray-400 hover:text-pink-400 cursor-pointer transition-colors" />
              <Youtube className="h-6 w-6 text-gray-400 hover:text-pink-400 cursor-pointer transition-colors" />
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-lg font-semibold mb-4"></h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors"></a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors"></a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors"></a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors"></a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors"></a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-lg font-semibold mb-4"></h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors"></a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors"></a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors"></a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors"></a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors"></a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-semibold mb-4"></h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-pink-400" />
                <span className="text-gray-300"></span>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-pink-400" />
                <span className="text-gray-300"></span>
              </div>
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-pink-400 mt-1" />
                <span className="text-gray-300"></span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm"></p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors"></a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors"></a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors"></a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;