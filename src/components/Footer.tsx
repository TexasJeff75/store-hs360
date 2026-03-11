import React, { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Youtube } from 'lucide-react';
import { siteSettingsService, type ContactInfo } from '@/services/siteSettings';

interface FooterProps {
  onNavigateToLegal?: (page: 'eula' | 'privacy') => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigateToLegal }) => {
  const [contact, setContact] = useState<ContactInfo>(siteSettingsService.getDefaults().contact);

  useEffect(() => {
    siteSettingsService.getSettings().then(s => setContact(s.contact));
  }, []);

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <a href="#" className="flex items-center space-x-3 mb-4">
              <div>
                <span className="text-xl font-poppins font-bold bg-gradient-primary bg-clip-text text-transparent block">
                  HealthSpan360
                </span>
                <span className="text-xs font-poppins text-cool-gray block">
                  Turning Insight Into Impact
                </span>
              </div>
            </a>
            <p className="text-gray-300 mb-4 leading-relaxed">
              Advanced peptide science, genetic testing, and personalized healthcare solutions.
            </p>
            <div className="flex space-x-4">
              <Facebook className="h-6 w-6 text-gray-400 hover:text-pink-400 cursor-pointer transition-colors" />
              <Twitter className="h-6 w-6 text-gray-400 hover:text-pink-400 cursor-pointer transition-colors" />
              <Instagram className="h-6 w-6 text-gray-400 hover:text-pink-400 cursor-pointer transition-colors" />
              <Youtube className="h-6 w-6 text-gray-400 hover:text-pink-400 cursor-pointer transition-colors" />
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Services</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Peptide Therapy</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Genetic Testing</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Lab Testing</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Wellness Programs</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Provider Training</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Support</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Shipping Info</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Returns</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Track Order</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Contact Us</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-pink-400" />
                <span className="text-gray-300">{contact.phone}</span>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-pink-400" />
                <span className="text-gray-300">{contact.email}</span>
              </div>
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-pink-400 mt-1" />
                <span className="text-gray-300">
                  {contact.addressLine1}<br />
                  {contact.addressLine2}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} HealthSpan360. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <button
                onClick={() => onNavigateToLegal?.('privacy')}
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Privacy Policy
              </button>
              <button
                onClick={() => onNavigateToLegal?.('eula')}
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
