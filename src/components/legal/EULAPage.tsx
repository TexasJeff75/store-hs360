import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';

interface EULAPageProps {
  onBack: () => void;
}

const EULAPage: React.FC<EULAPageProps> = ({ onBack }) => {
  const lastUpdated = 'March 11, 2026';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors mr-4"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-gray-700" />
              <h1 className="text-lg font-semibold text-gray-900">End User License Agreement</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-8 py-10 text-white">
            <h1 className="text-3xl font-bold mb-2">End User License Agreement</h1>
            <p className="text-gray-300">HealthSpan360 Store Application</p>
            <p className="text-gray-400 text-sm mt-2">Last Updated: {lastUpdated}</p>
          </div>

          <div className="px-8 py-10 prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed">
              This End User License Agreement ("Agreement") is a legal agreement between you ("User," "you," or "your") and HealthSpan360, LLC ("Company," "we," "us," or "our") governing your use of the HealthSpan360 Store web application, including all related services, features, and content (collectively, the "Application").
            </p>
            <p className="text-gray-700 leading-relaxed">
              By accessing or using the Application, you acknowledge that you have read, understood, and agree to be bound by this Agreement. If you do not agree to these terms, you must not access or use the Application.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">1. License Grant</h2>
            <p className="text-gray-700 leading-relaxed">
              Subject to your compliance with this Agreement, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Application for your internal business purposes. This license does not include the right to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Modify, copy, or create derivative works based on the Application</li>
              <li>Reverse engineer, disassemble, or decompile any part of the Application</li>
              <li>Sublicense, lease, sell, or otherwise transfer the Application or your access to it</li>
              <li>Use the Application for any unlawful purpose or in violation of any applicable regulation</li>
              <li>Remove, alter, or obscure any proprietary notices or labels on the Application</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">2. Account Registration and Security</h2>
            <p className="text-gray-700 leading-relaxed">
              To use the Application, you must create an account and provide accurate, complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Provide truthful and accurate registration information</li>
              <li>Keep your login credentials secure and confidential</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Not share account access with unauthorized individuals</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              Account approval is at our sole discretion. We reserve the right to suspend or terminate accounts that violate this Agreement or at our sole discretion.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">3. Organization and Business Use</h2>
            <p className="text-gray-700 leading-relaxed">
              The Application supports multi-organization access for business-to-business transactions. If you are using the Application on behalf of an organization, you represent and warrant that you have the authority to bind that organization to this Agreement. The organization and its users are jointly responsible for compliance with these terms.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">4. Orders and Payments</h2>
            <p className="text-gray-700 leading-relaxed">
              All orders placed through the Application are subject to acceptance by us. We reserve the right to refuse or cancel any order for any reason, including but not limited to product availability, pricing errors, or suspected fraud. Payment processing is handled through secure third-party payment processors. By submitting payment information, you represent that you are authorized to use the payment method provided.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Pricing displayed in the Application may include contract pricing, organization pricing, or standard retail pricing depending on your account configuration. All prices are subject to change without notice.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">5. Third-Party Integrations</h2>
            <p className="text-gray-700 leading-relaxed">
              The Application may integrate with third-party services, including but not limited to Intuit QuickBooks for invoicing and payment processing. Your use of any third-party service through the Application is subject to that service's own terms and conditions. We are not responsible for the availability, accuracy, or content of third-party services, and your use of such services is at your own risk.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              By authorizing the QuickBooks integration, you consent to the exchange of relevant business data (such as invoice details, payment records, and customer information) between the Application and QuickBooks as needed to facilitate your transactions.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">6. Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed">
              The Application, including all content, features, functionality, software, text, graphics, logos, and trademarks, is owned by HealthSpan360, LLC and is protected by intellectual property laws. Nothing in this Agreement transfers any intellectual property rights to you. You retain ownership of data you submit to the Application, subject to the license you grant us to use that data as described in our Privacy Policy.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">7. Data and Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Your use of the Application is also governed by our Privacy Policy, which describes how we collect, use, and protect your information. By using the Application, you consent to our data practices as described in the Privacy Policy. We implement industry-standard security measures to protect your data, but no method of electronic transmission or storage is 100% secure.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">8. Acceptable Use</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree not to use the Application to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Violate any applicable law, regulation, or third-party right</li>
              <li>Interfere with or disrupt the Application or its servers and networks</li>
              <li>Attempt to gain unauthorized access to any part of the Application</li>
              <li>Transmit any malware, viruses, or other harmful code</li>
              <li>Scrape, crawl, or use automated means to access the Application without our express written permission</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Use the Application in a manner that could damage, disable, or impair our services</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">9. Disclaimer of Warranties</h2>
            <p className="text-gray-700 leading-relaxed uppercase font-medium text-sm">
              The Application is provided "as is" and "as available" without any warranties of any kind, whether express, implied, or statutory. We disclaim all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Application will be uninterrupted, error-free, or secure.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">10. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              To the maximum extent permitted by applicable law, in no event shall HealthSpan360, LLC, its officers, directors, employees, or agents be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, use, or goodwill, arising out of or in connection with your use of the Application, regardless of the theory of liability. Our total liability for any claims arising under this Agreement shall not exceed the amount you paid to us in the twelve (12) months preceding the claim.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">11. Indemnification</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree to indemnify, defend, and hold harmless HealthSpan360, LLC and its officers, directors, employees, and agents from and against any claims, damages, losses, liabilities, and expenses (including reasonable attorneys' fees) arising out of or related to your use of the Application, your violation of this Agreement, or your violation of any rights of a third party.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">12. Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              We may suspend or terminate your access to the Application at any time, with or without cause, and with or without notice. Upon termination, your license to use the Application immediately ceases. Sections of this Agreement that by their nature should survive termination will continue to apply, including but not limited to intellectual property, disclaimers, limitations of liability, and indemnification.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">13. Modifications to This Agreement</h2>
            <p className="text-gray-700 leading-relaxed">
              We reserve the right to modify this Agreement at any time. Changes will be effective upon posting to the Application. Your continued use of the Application after any modifications constitutes acceptance of the updated terms. We encourage you to review this Agreement periodically.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">14. Governing Law and Dispute Resolution</h2>
            <p className="text-gray-700 leading-relaxed">
              This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of law provisions. Any disputes arising under this Agreement shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, conducted in the State of Florida. You waive any right to a jury trial or to participate in a class action.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">15. Severability</h2>
            <p className="text-gray-700 leading-relaxed">
              If any provision of this Agreement is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary so that this Agreement shall otherwise remain in full force and effect.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">16. Entire Agreement</h2>
            <p className="text-gray-700 leading-relaxed">
              This Agreement, together with the Privacy Policy, constitutes the entire agreement between you and HealthSpan360, LLC regarding the Application and supersedes all prior agreements, understandings, and communications, whether written or oral.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">17. Contact Information</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have questions or concerns about this Agreement, please contact us at:
            </p>
            <div className="bg-gray-50 rounded-lg p-5 mt-3 border border-gray-200">
              <p className="text-gray-800 font-medium">HealthSpan360, LLC</p>
              <p className="text-gray-600 mt-1">Email: info@hs360.co</p>
              <p className="text-gray-600">Phone: 1-800-HEALTH-360</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EULAPage;
