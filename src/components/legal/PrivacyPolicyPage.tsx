import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';

interface PrivacyPolicyPageProps {
  onBack: () => void;
}

const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({ onBack }) => {
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
              <Shield className="w-5 h-5 text-gray-700" />
              <h1 className="text-lg font-semibold text-gray-900">Privacy Policy</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-8 py-10 text-white">
            <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
            <p className="text-gray-300">HealthSpan360 Store Application</p>
            <p className="text-gray-400 text-sm mt-2">Last Updated: {lastUpdated}</p>
          </div>

          <div className="px-8 py-10 prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed">
              HealthSpan360, LLC ("Company," "we," "us," or "our") is committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the HealthSpan360 Store web application (the "Application"). Please read this policy carefully. By using the Application, you consent to the data practices described in this policy.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">1. Information We Collect</h2>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">1.1 Information You Provide</h3>
            <p className="text-gray-700 leading-relaxed">
              We collect information that you voluntarily provide when you:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><span className="font-medium">Create an account:</span> name, email address, password, and role within your organization</li>
              <li><span className="font-medium">Complete your profile:</span> business name, organization details, and contact information</li>
              <li><span className="font-medium">Place orders:</span> shipping and billing addresses, order details, and product selections</li>
              <li><span className="font-medium">Submit payment information:</span> payment card details (processed and stored by our PCI-compliant payment processor; we do not store full card numbers)</li>
              <li><span className="font-medium">Contact support:</span> messages, attachments, and communication history through our support ticket system</li>
              <li><span className="font-medium">Subscribe to communications:</span> email address for newsletters and promotional content</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">1.2 Information Collected Automatically</h3>
            <p className="text-gray-700 leading-relaxed">
              When you access the Application, we may automatically collect:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><span className="font-medium">Session data:</span> login timestamps, session duration, and activity logs</li>
              <li><span className="font-medium">Device information:</span> browser type, operating system, and screen resolution</li>
              <li><span className="font-medium">Usage data:</span> pages visited, features used, products viewed, and search queries</li>
              <li><span className="font-medium">IP address:</span> for security, fraud prevention, and general geographic analysis</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">1.3 Information from Third Parties</h3>
            <p className="text-gray-700 leading-relaxed">
              We may receive information from third-party services integrated with the Application, including:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><span className="font-medium">Intuit QuickBooks:</span> invoicing data, payment status, and customer records when you authorize the QuickBooks integration</li>
              <li><span className="font-medium">Product catalog providers:</span> product information, pricing, and availability data</li>
              <li><span className="font-medium">Payment processors:</span> transaction confirmation and payment status</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">2. How We Use Your Information</h2>
            <p className="text-gray-700 leading-relaxed">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><span className="font-medium">Provide and maintain the Application:</span> process orders, manage your account, and deliver products</li>
              <li><span className="font-medium">Process transactions:</span> handle payments, generate invoices through QuickBooks, and manage billing</li>
              <li><span className="font-medium">Personalize your experience:</span> display relevant pricing (contract, organization, or retail), product recommendations, and account-specific features</li>
              <li><span className="font-medium">Communicate with you:</span> send order confirmations, shipping updates, support responses, and account notifications</li>
              <li><span className="font-medium">Improve the Application:</span> analyze usage patterns, diagnose technical issues, and enhance features</li>
              <li><span className="font-medium">Ensure security:</span> detect fraud, prevent unauthorized access, and maintain audit logs</li>
              <li><span className="font-medium">Fulfill legal obligations:</span> comply with applicable laws, regulations, and legal processes</li>
              <li><span className="font-medium">Manage business relationships:</span> administer distributor, sales representative, and commission arrangements</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">3. How We Share Your Information</h2>
            <p className="text-gray-700 leading-relaxed">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">3.1 Service Providers</h3>
            <p className="text-gray-700 leading-relaxed">
              We share information with third-party service providers who perform services on our behalf, including:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><span className="font-medium">Supabase:</span> database hosting, authentication, and data storage</li>
              <li><span className="font-medium">Intuit QuickBooks:</span> invoicing, payment processing, and financial record-keeping</li>
              <li><span className="font-medium">Payment processors:</span> secure payment card processing and vault storage</li>
              <li><span className="font-medium">Hosting providers:</span> application hosting and content delivery</li>
              <li><span className="font-medium">Email services:</span> transactional and marketing email delivery</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">3.2 Business Partners</h3>
            <p className="text-gray-700 leading-relaxed">
              Within the Application's multi-tenant business model, certain information may be shared with:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><span className="font-medium">Your organization administrators:</span> order history, account activity, and usage within the organization</li>
              <li><span className="font-medium">Assigned sales representatives:</span> order details and contact information necessary to service your account</li>
              <li><span className="font-medium">Distributors:</span> order and commission data related to their sales operations</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">3.3 Legal Requirements</h3>
            <p className="text-gray-700 leading-relaxed">
              We may disclose your information when required by law, regulation, legal process, or governmental request, or when we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
            </p>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">3.4 Business Transfers</h3>
            <p className="text-gray-700 leading-relaxed">
              In the event of a merger, acquisition, reorganization, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any change in ownership or use of your personal information.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">4. Data Security</h2>
            <p className="text-gray-700 leading-relaxed">
              We implement a variety of security measures to protect your personal information:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><span className="font-medium">Encryption:</span> data is encrypted in transit using TLS/SSL and at rest in our database</li>
              <li><span className="font-medium">Access controls:</span> role-based access control (RBAC) ensures users can only access data they are authorized to see</li>
              <li><span className="font-medium">Row Level Security:</span> database-level security policies restrict data access based on user identity and role</li>
              <li><span className="font-medium">Authentication:</span> secure password hashing and session management through industry-standard protocols</li>
              <li><span className="font-medium">Payment security:</span> payment card data is processed by PCI DSS-compliant processors; we use tokenization and never store full card numbers</li>
              <li><span className="font-medium">Audit logging:</span> login attempts and critical operations are logged for security monitoring</li>
              <li><span className="font-medium">Session management:</span> automatic session timeouts to prevent unauthorized access from unattended sessions</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              While we strive to protect your personal information, no method of transmission over the Internet or method of electronic storage is 100% secure. We cannot guarantee absolute security.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">5. Data Retention</h2>
            <p className="text-gray-700 leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide you services, comply with legal obligations, resolve disputes, and enforce our agreements. When your account is deleted or deactivated:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Personal profile data will be removed or anonymized within 30 days</li>
              <li>Transaction records may be retained for up to 7 years for tax and legal compliance purposes</li>
              <li>Audit logs may be retained for up to 2 years for security purposes</li>
              <li>Aggregated, anonymized data may be retained indefinitely for analytical purposes</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">6. Your Rights and Choices</h2>
            <p className="text-gray-700 leading-relaxed">
              Depending on your location, you may have the following rights regarding your personal information:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><span className="font-medium">Access:</span> request a copy of the personal information we hold about you</li>
              <li><span className="font-medium">Correction:</span> request correction of inaccurate or incomplete personal information</li>
              <li><span className="font-medium">Deletion:</span> request deletion of your personal information, subject to legal retention requirements</li>
              <li><span className="font-medium">Portability:</span> request your data in a commonly used, machine-readable format</li>
              <li><span className="font-medium">Opt-out:</span> unsubscribe from marketing communications at any time</li>
              <li><span className="font-medium">Restrict processing:</span> request that we limit the use of your personal information</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              To exercise any of these rights, please contact us using the information provided in the Contact section below. We will respond to your request within 30 days.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">7. Cookies and Tracking Technologies</h2>
            <p className="text-gray-700 leading-relaxed">
              The Application uses essential cookies and local storage to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Maintain your authentication session</li>
              <li>Remember your preferences and settings</li>
              <li>Ensure the security of your account</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              These are strictly necessary for the Application to function and cannot be disabled. We do not use third-party advertising or analytics cookies that track you across other websites.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">8. Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              The Application is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected personal information from a child under 18, we will take steps to delete that information promptly.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">9. International Data Transfers</h2>
            <p className="text-gray-700 leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those of your country. We take appropriate safeguards to ensure that your personal information remains protected in accordance with this Privacy Policy.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">10. California Privacy Rights (CCPA)</h2>
            <p className="text-gray-700 leading-relaxed">
              If you are a California resident, you have the right to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Know what personal information we collect, use, and disclose</li>
              <li>Request deletion of your personal information</li>
              <li>Opt-out of the sale of your personal information (we do not sell personal information)</li>
              <li>Non-discrimination for exercising your privacy rights</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              To make a request under the CCPA, please contact us using the information below.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">11. QuickBooks Integration Data Practices</h2>
            <p className="text-gray-700 leading-relaxed">
              When you authorize the QuickBooks integration, the following data practices apply:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>We access your QuickBooks data only with your explicit authorization through OAuth 2.0</li>
              <li>Data exchanged includes customer records, invoice details, and payment information necessary for order processing</li>
              <li>We do not access QuickBooks data beyond what is necessary for the Application's functionality</li>
              <li>You can revoke QuickBooks access at any time through the Application settings or your Intuit account</li>
              <li>QuickBooks data is subject to Intuit's own privacy policy and terms of service</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">12. Changes to This Privacy Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on the Application and updating the "Last Updated" date. Your continued use of the Application after changes are posted constitutes your acceptance of the revised policy. We encourage you to review this policy periodically.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">13. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="bg-gray-50 rounded-lg p-5 mt-3 border border-gray-200">
              <p className="text-gray-800 font-medium">HealthSpan360, LLC</p>
              <p className="text-gray-600 mt-1">Privacy Inquiries</p>
              <p className="text-gray-600 mt-1">Email: info@hs360.co</p>
              <p className="text-gray-600">Phone: 1-800-HEALTH-360</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicyPage;
