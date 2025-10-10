import React from 'react';
import { ArrowRight, Shield, Truck, Award, Dna } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <section className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white relative overflow-hidden">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto text-center">
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
            
            <div className="flex flex-col sm:flex-row gap-4 mb-12 justify-center">
              <button className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-orange-600 transition-all flex items-center justify-center space-x-2">
                <span>For Providers</span>
                <ArrowRight className="h-5 w-5" />
              </button>
              <button className="border-2 border-gray-600 text-gray-300 px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 hover:text-white transition-colors">
                For Patients
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="flex flex-col items-center text-center space-y-2">
                <Shield className="h-8 w-8 text-green-400" />
                <div>
                  <div className="font-semibold text-white">Science-Based</div>
                  <div className="text-sm text-gray-400">Solutions</div>
                </div>
              </div>
              <div className="flex flex-col items-center text-center space-y-2">
                <Dna className="h-8 w-8 text-pink-400" />
                <div>
                  <div className="font-semibold text-white">Genetic Testing</div>
                  <div className="text-sm text-gray-400">Advanced</div>
                </div>
              </div>
              <div className="flex flex-col items-center text-center space-y-2">
                <Award className="h-8 w-8 text-orange-400" />
                <div>
                  <div className="font-semibold text-white">Expert Care</div>
                  <div className="text-sm text-gray-400">Providers</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;