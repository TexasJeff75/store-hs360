import React from 'react';
import { ArrowRight, Shield, Truck, Award, Dna } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <section className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white relative overflow-hidden">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Turning <span className="bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">Insight</span>
              <br />Into <span className="bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">Impact</span>
            </h1>
            <p className="text-lg text-gray-300 mb-8 leading-relaxed">
              Integrating peptide science, genetic insights, and advanced laboratory testing 
              to help providers and patients achieve better health outcomes.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <button className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all flex items-center justify-center space-x-2">
                <span>For Providers</span>
                <ArrowRight className="h-5 w-5" />
              </button>
              <button className="border-2 border-gray-600 text-gray-300 px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 hover:text-white transition-colors">
                For Patients
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-3 gap-6">
              <div className="flex items-center space-x-3">
                <Shield className="h-8 w-8 text-green-400" />
                <div>
                  <div className="font-semibold text-white">Science-Based</div>
                  <div className="text-sm text-gray-400">Solutions</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Dna className="h-8 w-8 text-pink-400" />
                <div>
                  <div className="font-semibold text-white">Genetic Testing</div>
                  <div className="text-sm text-gray-400">Advanced</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Award className="h-8 w-8 text-orange-400" />
                <div>
                  <div className="font-semibold text-white">Expert Care</div>
                  <div className="text-sm text-gray-400">Providers</div>
                </div>
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="relative z-10">
            <div className="relative z-10">
              <div className="w-80 h-80 mx-auto bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 rounded-full flex items-center justify-center relative">
                <div className="w-64 h-64 bg-gray-900 rounded-full flex items-center justify-center">
                  <Dna className="h-32 w-32 text-white" />
                </div>
                {/* DNA Helix Animation */}
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