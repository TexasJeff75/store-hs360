import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Users,
  Building2,
  DollarSign,
  ShoppingCart,
  Shield,
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  MapPin,
  Package,
  CreditCard,
  Repeat,
  Building
} from 'lucide-react';

interface HelpSectionProps {}

interface HelpTopic {
  id: string;
  title: string;
  icon: React.ElementType;
  content: HelpItem[];
}

interface HelpItem {
  question: string;
  answer: string | string[];
  type?: 'info' | 'warning' | 'success';
}

const HelpSection: React.FC<HelpSectionProps> = () => {
  const [expandedTopic, setExpandedTopic] = useState<string | null>('getting-started');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const helpTopics: HelpTopic[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: BookOpen,
      content: [
        {
          question: 'What is the Admin Dashboard?',
          answer: 'The Admin Dashboard is your central control panel for managing the entire platform. You can manage users, organizations, pricing, orders, commissions, and more.',
          type: 'info'
        },
        {
          question: 'What are the different user roles?',
          answer: [
            'Admin: Full access to all features and settings',
            'Sales Rep: Manage assigned organizations and view commissions',
            'Distributor: View distributor hierarchy and commissions',
            'Customer: Place orders and manage their organization'
          ]
        },
        {
          question: 'How do I approve new users?',
          answer: 'Navigate to Users tab, find pending users (marked with "Pending Approval"), and click Approve. Users cannot access the system until approved.',
          type: 'warning'
        }
      ]
    },
    {
      id: 'organizations',
      title: 'Organizations & Locations',
      icon: Building2,
      content: [
        {
          question: 'How do I create a new organization?',
          answer: [
            '1. Go to the Organizations tab',
            '2. Click "Add Organization" button',
            '3. Enter organization name, code (must be unique), and contact information',
            '4. Assign a default sales rep if needed',
            '5. Mark as house account if no commission should be paid'
          ]
        },
        {
          question: 'What is a house account?',
          answer: 'House accounts are organizations that do not generate sales commissions. Orders from house accounts will have 0% commission regardless of margin.',
          type: 'info'
        },
        {
          question: 'Can I prevent duplicate organizations?',
          answer: 'Yes! The system automatically detects similar organization names and codes to prevent duplicates. This protects against account theft by sales reps.',
          type: 'success'
        },
        {
          question: 'How do locations work?',
          answer: 'Locations are shipping/billing addresses within an organization. Each location can have its own pricing overrides and payment methods.'
        },
        {
          question: 'What happens if I deactivate an organization?',
          answer: 'Deactivated organizations cannot place new orders, but their historical data remains intact. Users can no longer access the organization.',
          type: 'warning'
        }
      ]
    },
    {
      id: 'users',
      title: 'User Management',
      icon: Users,
      content: [
        {
          question: 'How does user approval work?',
          answer: [
            'When users sign up, they are in "pending" status and cannot access the system.',
            'Admins must review and approve each user before they can log in.',
            'This prevents unauthorized access and ensures proper organization assignment.',
            'You can also reject users if needed.'
          ],
          type: 'warning'
        },
        {
          question: 'How do I assign users to organizations?',
          answer: 'In the Users tab, select a user and assign them to an organization with an appropriate role (admin, manager, member, or viewer).'
        },
        {
          question: 'Can users belong to multiple organizations?',
          answer: 'Yes! Users can be assigned to multiple organizations with different roles in each. This is useful for consultants or multi-location managers.'
        },
        {
          question: 'What are organization roles?',
          answer: [
            'Admin: Full control over the organization and its locations',
            'Manager: Can manage orders and users within the organization',
            'Member: Can place orders and view organization data',
            'Viewer: Read-only access to organization data'
          ]
        }
      ]
    },
    {
      id: 'sales-reps',
      title: 'Sales Reps & Assignments',
      icon: TrendingUp,
      content: [
        {
          question: 'How do I assign a sales rep to an organization?',
          answer: [
            '1. Go to Sales Reps tab',
            '2. Click "Assign Sales Rep"',
            '3. Select the sales rep and organization',
            '4. Set commission rate and split percentage',
            '5. Mark as active'
          ]
        },
        {
          question: 'Can an organization have multiple sales reps?',
          answer: 'Yes! You can assign multiple sales reps with different commission splits. The total split percentage should equal 100%.',
          type: 'info'
        },
        {
          question: 'How are sales rep assignments protected?',
          answer: [
            'Only admins can create organizations and assign sales reps.',
            'Sales reps cannot create duplicate organizations to steal accounts.',
            'Sales reps can only create orders for their assigned organizations.',
            'All unauthorized attempts are logged for security monitoring.'
          ],
          type: 'success'
        },
        {
          question: 'What is a default sales rep?',
          answer: 'The default sales rep is automatically assigned to new orders from that organization if no specific sales rep is selected.'
        }
      ]
    },
    {
      id: 'pricing',
      title: 'Pricing & Contracts',
      icon: DollarSign,
      content: [
        {
          question: 'What are the pricing hierarchy levels?',
          answer: [
            '1. Individual User Pricing (highest priority)',
            '2. Location Pricing',
            '3. Organization Pricing',
            '4. Product Base Price + Markup (lowest priority)',
            'The system uses the most specific pricing available.'
          ]
        },
        {
          question: 'How do I set contract pricing?',
          answer: [
            '1. Go to Pricing Management tab',
            '2. Choose pricing type (Organization, Location, or Individual)',
            '3. Select the entity and product',
            '4. Enter contract price or markup percentage',
            '5. Set effective dates and quantity ranges'
          ]
        },
        {
          question: 'What is markup pricing?',
          answer: 'Instead of setting a fixed contract price, you can set a markup percentage. The price is calculated as: Base Cost × (1 + Markup %). This ensures pricing stays current with cost changes.',
          type: 'info'
        },
        {
          question: 'Can pricing overlap?',
          answer: 'No. The system prevents overlapping quantity ranges for the same product/entity combination. This ensures clear, unambiguous pricing.',
          type: 'warning'
        },
        {
          question: 'How do expiration dates work?',
          answer: 'You can set expiration dates on contract pricing. After expiration, the system falls back to the next pricing level in the hierarchy.'
        }
      ]
    },
    {
      id: 'orders',
      title: 'Orders & Processing',
      icon: ShoppingCart,
      content: [
        {
          question: 'How do customers place orders?',
          answer: 'Customers browse products, add to cart, select shipping address and payment method, then complete checkout. Orders sync with BigCommerce for fulfillment.'
        },
        {
          question: 'Can I edit orders?',
          answer: 'Only pending orders can be edited. Once an order is processing or completed, it cannot be modified. You can cancel and create a new order if needed.',
          type: 'warning'
        },
        {
          question: 'What are order statuses?',
          answer: [
            'Pending: Order created but not yet submitted',
            'Processing: Order submitted and being prepared',
            'Shipped: Order dispatched to customer',
            'Delivered: Order received by customer',
            'Cancelled: Order cancelled before shipment'
          ]
        },
        {
          question: 'How does commission calculation work?',
          answer: [
            'Commission is based on product margin (selling price - cost)',
            'Commission % × Margin = Commission Amount',
            'Split between sales rep and distributor based on split percentages',
            'House accounts generate 0% commission'
          ]
        }
      ]
    },
    {
      id: 'recurring-orders',
      title: 'Recurring Orders',
      icon: Repeat,
      content: [
        {
          question: 'What are recurring orders?',
          answer: 'Recurring orders automatically create and process orders on a regular schedule (daily, weekly, monthly, quarterly, yearly).',
          type: 'info'
        },
        {
          question: 'How do I set up a recurring order?',
          answer: [
            '1. Add products to cart',
            '2. Click "Subscribe" instead of checkout',
            '3. Choose frequency (daily, weekly, monthly, etc.)',
            '4. Select start date',
            '5. Choose end date or keep it ongoing',
            '6. Select shipping address and payment method',
            '7. Confirm subscription'
          ]
        },
        {
          question: 'Can customers pause subscriptions?',
          answer: 'Yes! Customers can pause, resume, or cancel recurring orders at any time from their account dashboard.'
        },
        {
          question: 'How are recurring orders processed?',
          answer: 'A scheduled job runs daily to check for recurring orders due. Orders are automatically created and charged to the saved payment method.'
        },
        {
          question: 'What if a payment fails?',
          answer: 'Failed orders are marked as "failed" and customers are notified. The recurring order remains active and will try again on the next scheduled date.',
          type: 'warning'
        }
      ]
    },
    {
      id: 'commissions',
      title: 'Commissions & Payouts',
      icon: TrendingUp,
      content: [
        {
          question: 'How are commissions calculated?',
          answer: [
            '1. Calculate margin: Selling Price - Product Cost',
            '2. Apply commission rate: Margin × Commission %',
            '3. Split between sales rep and distributor',
            '4. Sales Rep gets: Commission × Split %',
            '5. Distributor gets: Commission × (100% - Split %)'
          ]
        },
        {
          question: 'What is the distributor hierarchy?',
          answer: 'Distributors can have multiple sales reps under them. When a sales rep makes a sale, both the rep and their distributor earn commission based on the split percentage.',
          type: 'info'
        },
        {
          question: 'When are commissions paid?',
          answer: 'Commissions are calculated immediately when an order is placed but remain in "pending" status. Admins approve commissions for payout periodically.'
        },
        {
          question: 'Can I recalculate commissions?',
          answer: 'Yes! Use the recalculate-commissions script if pricing or commission rates change. This updates all existing orders with correct commission amounts.',
          type: 'warning'
        },
        {
          question: 'How do I approve commissions for payout?',
          answer: 'In the Commissions tab, select pending commissions and click "Approve". This marks them as approved and ready for payment processing.'
        }
      ]
    },
    {
      id: 'distributors',
      title: 'Distributors',
      icon: Building,
      content: [
        {
          question: 'What is a distributor?',
          answer: 'Distributors are higher-level partners who manage multiple sales reps. They receive a portion of commissions from all their reps\' sales.'
        },
        {
          question: 'How do I create a distributor?',
          answer: [
            '1. Go to Distributors tab',
            '2. Click "Add Distributor"',
            '3. Enter distributor name and code',
            '4. Link to a user profile if applicable',
            '5. Set commission tier',
            '6. Assign sales reps to this distributor'
          ]
        },
        {
          question: 'Can a sales rep have multiple distributors?',
          answer: 'No. Each sales rep can only be assigned to one distributor at a time. However, distributors can have multiple sales reps.',
          type: 'info'
        }
      ]
    },
    {
      id: 'products',
      title: 'Products & Inventory',
      icon: Package,
      content: [
        {
          question: 'How are products managed?',
          answer: 'Products are synced from BigCommerce. You can view product details, set base costs, and configure markup settings in the Products tab.'
        },
        {
          question: 'What is product cost?',
          answer: 'Product cost is your acquisition cost (what you pay). This is used to calculate margins and commissions. Keep costs updated for accurate commission calculations.',
          type: 'warning'
        },
        {
          question: 'Can I allow markup pricing for specific products?',
          answer: 'Yes! In Products Management, enable "Allow Markup Pricing" for products where you want percentage-based pricing instead of fixed contract prices.'
        }
      ]
    },
    {
      id: 'security',
      title: 'Security & Access Control',
      icon: Shield,
      content: [
        {
          question: 'How is data protected?',
          answer: [
            'Row Level Security (RLS) ensures users only see their own data',
            'All database queries are validated and restricted',
            'Payment card data is tokenized and never stored directly',
            'Passwords are hashed using industry-standard bcrypt',
            'All actions are logged for audit trails'
          ],
          type: 'success'
        },
        {
          question: 'What prevents account theft?',
          answer: [
            'Only admins can create organizations',
            'Duplicate organization detection prevents creating similar orgs',
            'Sales reps can only access assigned organizations',
            'Order creation is validated against sales rep assignments',
            'Failed access attempts are logged'
          ],
          type: 'success'
        },
        {
          question: 'How can I monitor suspicious activity?',
          answer: 'Check the Login Audit Log in the Users section. This shows all login attempts, including failed ones, with timestamps and IP addresses.',
          type: 'info'
        },
        {
          question: 'What if I suspect unauthorized access?',
          answer: 'Immediately deactivate the user account, review their recent actions in audit logs, and change any compromised passwords. Contact support if needed.',
          type: 'warning'
        }
      ]
    },
    {
      id: 'payment-methods',
      title: 'Payment Methods',
      icon: CreditCard,
      content: [
        {
          question: 'How are payment methods stored?',
          answer: 'Payment card data is tokenized through BigCommerce Payments. Only encrypted tokens are stored in the database - never actual card numbers.',
          type: 'success'
        },
        {
          question: 'Can customers save multiple payment methods?',
          answer: 'Yes! Customers can save multiple payment methods for their organization and choose which to use at checkout.'
        },
        {
          question: 'How do I delete a payment method?',
          answer: 'In Payment Methods tab, customers can view and delete saved payment methods. Admins can also manage payment methods for any organization.',
          type: 'warning'
        }
      ]
    },
    {
      id: 'analytics',
      title: 'Analytics & Reporting',
      icon: FileText,
      content: [
        {
          question: 'What reports are available?',
          answer: [
            'Sales by organization and time period',
            'Commission summaries by sales rep and distributor',
            'Top products and customers',
            'Order trends and patterns',
            'Revenue and margin analysis'
          ]
        },
        {
          question: 'How do I export data?',
          answer: 'Most reports have an "Export" button that downloads data as CSV. You can then analyze in Excel or other tools.'
        },
        {
          question: 'Can I customize date ranges?',
          answer: 'Yes! Most reports allow you to select custom date ranges for analysis.'
        }
      ]
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: AlertTriangle,
      content: [
        {
          question: 'User cannot log in after approval',
          answer: [
            '1. Verify user is marked as approved in Users tab',
            '2. Check if user is assigned to an organization',
            '3. Confirm user email is verified',
            '4. Check login audit log for error messages',
            '5. Try resetting the user\'s password'
          ],
          type: 'warning'
        },
        {
          question: 'Orders not syncing with BigCommerce',
          answer: [
            'Check BigCommerce API credentials in environment variables',
            'Verify products exist in BigCommerce catalog',
            'Check order status - only processing orders sync',
            'Review error logs for API failures'
          ],
          type: 'warning'
        },
        {
          question: 'Commissions calculating incorrectly',
          answer: [
            'Verify product costs are up to date',
            'Check contract pricing is active and not expired',
            'Confirm sales rep commission rate is set correctly',
            'Run commission recalculation script if rates changed',
            'Verify commission split percentages total 100%'
          ],
          type: 'warning'
        },
        {
          question: 'Pricing not applying correctly',
          answer: [
            'Check pricing hierarchy: Individual > Location > Organization > Base Price',
            'Verify effective and expiration dates',
            'Ensure quantity ranges don\'t overlap',
            'Check if pricing is marked as active',
            'Clear browser cache and refresh'
          ],
          type: 'warning'
        }
      ]
    }
  ];

  const toggleTopic = (topicId: string) => {
    setExpandedTopic(expandedTopic === topicId ? null : topicId);
    setExpandedItem(null);
  };

  const toggleItem = (itemId: string) => {
    setExpandedItem(expandedItem === itemId ? null : itemId);
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'info':
      default:
        return <HelpCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTypeBgColor = (type?: string) => {
    switch (type) {
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Help Center</h2>
        <p className="text-gray-600">
          Everything you need to know about managing the platform
        </p>
      </div>

      <div className="space-y-4">
        {helpTopics.map((topic) => {
          const Icon = topic.icon;
          const isExpanded = expandedTopic === topic.id;

          return (
            <div key={topic.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleTopic(topic.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="font-semibold text-gray-900">{topic.title}</span>
                  <span className="text-sm text-gray-500">({topic.content.length} topics)</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200">
                  {topic.content.map((item, index) => {
                    const itemId = `${topic.id}-${index}`;
                    const isItemExpanded = expandedItem === itemId;

                    return (
                      <div key={itemId} className="border-b border-gray-100 last:border-b-0">
                        <button
                          onClick={() => toggleItem(itemId)}
                          className="w-full flex items-start justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-start space-x-3 flex-1">
                            {getTypeIcon(item.type)}
                            <span className="font-medium text-gray-900">{item.question}</span>
                          </div>
                          {isItemExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                          )}
                        </button>

                        {isItemExpanded && (
                          <div className={`mx-4 mb-4 p-4 rounded-lg border ${getTypeBgColor(item.type)}`}>
                            {Array.isArray(item.answer) ? (
                              <ul className="space-y-2">
                                {item.answer.map((line, i) => (
                                  <li key={i} className="text-gray-700 text-sm">
                                    {line}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-gray-700 text-sm">{item.answer}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Still need help?</h3>
            <p className="text-gray-600 text-sm mb-4">
              If you can't find what you're looking for, check the documentation or contact support.
            </p>
            <div className="flex space-x-3">
              <a
                href="/docs"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                View Documentation
              </a>
              <a
                href="mailto:support@example.com"
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpSection;
