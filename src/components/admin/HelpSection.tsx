import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  CreditCard,
  Repeat,
  Building2,
  TrendingUp,
  Package
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface HelpSectionProps {}

interface HelpTopic {
  id: string;
  title: string;
  icon: React.ElementType;
  content: HelpItem[];
  roles: string[];
}

interface HelpItem {
  question: string;
  answer: string | string[];
  type?: 'info' | 'warning' | 'success';
}

const HelpSection: React.FC<HelpSectionProps> = () => {
  const { profile } = useAuth();
  const userRole = profile?.role || 'customer';
  const [expandedTopic, setExpandedTopic] = useState<string | null>('getting-started');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const helpTopics: HelpTopic[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: BookOpen,
      roles: ['admin', 'sales_rep', 'distributor', 'customer'],
      content: [
        {
          question: 'What is this dashboard?',
          answer: userRole === 'admin'
            ? 'The Admin Dashboard is your central control panel for managing the entire platform. You can manage users, organizations, pricing, orders, commissions, and more.'
            : userRole === 'sales_rep'
            ? 'This is your Sales Dashboard where you can view orders from your assigned organizations and track your commission earnings.'
            : userRole === 'distributor'
            ? 'This is your Distributor Dashboard where you can view commissions from your sales representatives.'
            : 'This is your Account Dashboard where you can manage orders, delivery locations, and payment methods.',
          type: 'info'
        },
        {
          question: userRole === 'customer' ? 'How do I place an order?' : 'What can I do here?',
          answer: userRole === 'customer'
            ? [
                '1. Browse products in the main catalog',
                '2. Add items to your cart',
                '3. Click the cart icon to review your order',
                '4. Select a delivery address',
                '5. Choose a payment method',
                '6. Complete checkout'
              ]
            : userRole === 'sales_rep'
            ? [
                'View and manage orders from your assigned organizations',
                'Track commission earnings from your sales',
                'Access your organization assignments',
                'Contact support for assistance'
              ]
            : userRole === 'distributor'
            ? [
                'View commission earnings from your sales representatives',
                'Track performance across your team',
                'Access reports and analytics',
                'Contact support for assistance'
              ]
            : [
                'Manage all users and their roles',
                'Create and manage organizations',
                'Set pricing and commission structures',
                'View all orders and approve commissions',
                'Access comprehensive analytics'
              ]
        }
      ]
    },
    {
      id: 'orders',
      title: 'Orders & Order History',
      icon: ShoppingCart,
      roles: ['admin', 'sales_rep', 'customer'],
      content: [
        {
          question: userRole === 'customer' ? 'How do I track my orders?' : 'How do I view orders?',
          answer: userRole === 'customer'
            ? 'Click on the Orders tab to view your complete order history. You can see order status, tracking information, and order details.'
            : userRole === 'sales_rep'
            ? 'The Orders tab shows all orders from organizations you manage. You can filter, search, and view detailed order information including commission details.'
            : 'The Orders tab displays all orders across the platform. You can filter by organization, date range, status, and more.'
        },
        {
          question: 'What are the different order statuses?',
          answer: [
            'Pending: Order created but not yet submitted',
            'Processing: Order is being prepared for shipment',
            'Shipped: Order has been dispatched',
            'Delivered: Order has been received',
            'Cancelled: Order was cancelled before shipment'
          ]
        },
        {
          question: userRole === 'customer' ? 'Can I cancel or modify my order?' : 'Can orders be modified?',
          answer: userRole === 'customer'
            ? 'Only pending orders can be modified. Once an order is processing, it cannot be changed. Please contact support immediately if you need to cancel a processing order.'
            : 'Only pending orders can be edited. Processing and shipped orders cannot be modified. To make changes to a submitted order, you must cancel it and create a new one.',
          type: 'warning'
        },
        {
          question: userRole === 'customer' ? 'How do I reorder items?' : 'What is the quickest way to reorder?',
          answer: userRole === 'customer'
            ? 'Use the Favorites feature to save products you order frequently. You can quickly add favorite items to your cart with one click.'
            : 'Use the Recurring Orders feature for items that need to be ordered on a regular schedule. This automates the ordering process.'
        }
      ]
    },
    {
      id: 'locations',
      title: 'Delivery Locations',
      icon: MapPin,
      roles: ['customer'],
      content: [
        {
          question: 'How do I add a delivery address?',
          answer: [
            '1. Go to the Locations tab',
            '2. Click "Add Location"',
            '3. Enter the address details',
            '4. Give it a name for easy identification (e.g., "Main Office", "Warehouse")',
            '5. Save the location'
          ]
        },
        {
          question: 'Can I have multiple delivery locations?',
          answer: 'Yes! You can save multiple delivery addresses. This is useful if you have multiple offices, warehouses, or job sites.',
          type: 'info'
        },
        {
          question: 'How do I choose which location to deliver to?',
          answer: 'During checkout, select your preferred delivery location from your saved addresses.'
        },
        {
          question: 'Can I edit or delete a location?',
          answer: 'Yes, you can edit or delete any saved location from the Locations tab. Note that you cannot delete a location that has pending orders.',
          type: 'warning'
        }
      ]
    },
    {
      id: 'payment-methods',
      title: 'Payment Methods',
      icon: CreditCard,
      roles: ['customer'],
      content: [
        {
          question: 'How do I save a payment method?',
          answer: [
            '1. Go to the Payment Methods tab',
            '2. Click "Add Payment Method"',
            '3. Enter your card details securely',
            '4. Give it a name for easy identification',
            '5. Your card information is encrypted and stored securely'
          ],
          type: 'success'
        },
        {
          question: 'Is my payment information secure?',
          answer: 'Yes! Your card details are encrypted and tokenized. We never store actual card numbers. All payment processing meets industry security standards.',
          type: 'success'
        },
        {
          question: 'Can I use different payment methods for different orders?',
          answer: 'Yes, you can select which saved payment method to use during checkout. You can also add a new payment method at checkout.'
        },
        {
          question: 'How do I remove a saved payment method?',
          answer: 'In the Payment Methods tab, click the delete icon next to any saved payment method. Note that you cannot delete a payment method that is used for active recurring orders.',
          type: 'warning'
        }
      ]
    },
    {
      id: 'recurring-orders',
      title: 'Recurring Orders',
      icon: Repeat,
      roles: ['customer', 'admin'],
      content: [
        {
          question: 'What are recurring orders?',
          answer: 'Recurring orders automatically place orders for products you need on a regular schedule - daily, weekly, monthly, quarterly, or yearly. This ensures you never run out of essential items.',
          type: 'info'
        },
        {
          question: userRole === 'customer' ? 'How do I set up a recurring order?' : 'How do recurring orders work?',
          answer: userRole === 'customer'
            ? [
                '1. Add products to your cart',
                '2. Click "Subscribe" instead of "Checkout"',
                '3. Choose your delivery frequency',
                '4. Select a start date',
                '5. Optionally set an end date',
                '6. Choose delivery address and payment method',
                '7. Confirm your subscription'
              ]
            : [
                'Customers can create recurring orders for any product',
                'Orders are automatically processed on the scheduled date',
                'Payment is charged to the saved payment method',
                'Customers can pause, resume, or cancel anytime',
                'Failed orders are flagged and customers are notified'
              ]
        },
        {
          question: userRole === 'customer' ? 'Can I pause or cancel a recurring order?' : 'Can recurring orders be paused?',
          answer: userRole === 'customer'
            ? 'Yes! Go to My Recurring Orders tab to view all your subscriptions. You can pause, resume, or cancel any recurring order at any time.'
            : 'Yes, customers can pause, resume, or cancel their recurring orders at any time from their dashboard.'
        },
        {
          question: 'What happens if a payment fails?',
          answer: 'If a payment fails, the order is marked as failed and the customer is notified. The recurring order remains active and will try again on the next scheduled date.',
          type: 'warning'
        }
      ]
    },
    {
      id: 'pricing',
      title: 'Pricing & Discounts',
      icon: Package,
      roles: ['customer'],
      content: [
        {
          question: 'Why do I see discounted prices?',
          answer: 'Your account may have special contract pricing that reflects your negotiated rates. These discounts are automatically applied to your orders.',
          type: 'info'
        },
        {
          question: 'How do I know if I have special pricing?',
          answer: 'Products with special pricing will show the original price crossed out and your discounted price. The discount is applied automatically at checkout.'
        },
        {
          question: 'Can pricing change?',
          answer: 'Contract pricing may have expiration dates or quantity requirements. If you have questions about your pricing, please contact support.',
          type: 'info'
        }
      ]
    },
    {
      id: 'commissions',
      title: 'Commission Tracking',
      icon: TrendingUp,
      roles: ['sales_rep', 'distributor'],
      content: [
        {
          question: 'How do I view my commissions?',
          answer: userRole === 'sales_rep'
            ? 'The Commissions tab shows all your commission earnings from orders placed by your assigned organizations. You can filter by date range and status.'
            : 'The Commissions tab displays earnings from all sales representatives in your network. You can view individual rep performance and overall totals.'
        },
        {
          question: 'When are commissions paid?',
          answer: 'Commissions are calculated when orders are placed but remain in "pending" status. Once approved by management, they become available for payout.',
          type: 'info'
        },
        {
          question: 'What do the commission statuses mean?',
          answer: [
            'Pending: Commission has been calculated but not yet approved',
            'Approved: Commission has been approved and is ready for payment',
            'Paid: Commission has been paid out'
          ]
        }
      ]
    },
    {
      id: 'organizations',
      title: 'My Organizations',
      icon: Building2,
      roles: ['sales_rep'],
      content: [
        {
          question: 'What organizations am I assigned to?',
          answer: 'The My Organizations tab shows all organizations you manage. You can view organization details, contact information, and order history.'
        },
        {
          question: 'How do I help my customers place orders?',
          answer: 'You can view your organizations and their order history. Encourage customers to use the online ordering system for fastest processing. You can also assist them by phone if needed.',
          type: 'info'
        }
      ]
    },
    {
      id: 'troubleshooting',
      title: 'Common Issues',
      icon: AlertTriangle,
      roles: ['admin', 'sales_rep', 'distributor', 'customer'],
      content: [
        {
          question: userRole === 'customer' ? 'I cannot complete checkout' : 'Checkout issues',
          answer: userRole === 'customer'
            ? [
                'Ensure you have a delivery address saved',
                'Verify you have a payment method saved',
                'Check that all cart items are in stock',
                'Try refreshing the page',
                'If the issue persists, contact support'
              ]
            : 'Checkout issues are usually related to missing delivery addresses or payment methods. Ensure customers have both configured before attempting checkout.',
          type: 'warning'
        },
        {
          question: userRole === 'customer' ? 'My payment was declined' : 'Payment declined',
          answer: userRole === 'customer'
            ? [
                'Verify your card details are correct',
                'Check that your card has not expired',
                'Ensure you have sufficient funds',
                'Contact your bank if the card should be valid',
                'Try a different payment method'
              ]
            : 'Payment declines are typically related to insufficient funds, expired cards, or bank security holds. Customers should contact their bank to resolve the issue.',
          type: 'warning'
        },
        {
          question: userRole === 'customer' ? 'I forgot my password' : 'Password reset',
          answer: userRole === 'customer'
            ? 'Click "Forgot Password" on the login screen. Enter your email address and follow the instructions sent to your email to reset your password.'
            : 'Users can reset their passwords using the "Forgot Password" link on the login page. They will receive an email with reset instructions.'
        },
        {
          question: userRole === 'customer' ? 'How do I contact support?' : 'Support contact',
          answer: 'For assistance, email support@example.com or call during business hours. Have your order number ready if inquiring about a specific order.',
          type: 'info'
        }
      ]
    }
  ];

  const filteredTopics = helpTopics.filter(topic => topic.roles.includes(userRole));

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

  const getDashboardTitle = () => {
    switch (userRole) {
      case 'admin':
        return 'Admin Help Center';
      case 'sales_rep':
        return 'Sales Rep Help Center';
      case 'distributor':
        return 'Distributor Help Center';
      default:
        return 'Help Center';
    }
  };

  const getDashboardSubtitle = () => {
    switch (userRole) {
      case 'admin':
        return 'Everything you need to know about managing the platform';
      case 'sales_rep':
        return 'Resources to help you manage your organizations and commissions';
      case 'distributor':
        return 'Track your team performance and commissions';
      default:
        return 'Get help with orders, locations, and account management';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{getDashboardTitle()}</h2>
        <p className="text-gray-600">{getDashboardSubtitle()}</p>
      </div>

      <div className="space-y-4">
        {filteredTopics.map((topic) => {
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
              If you cannot find what you are looking for, contact our support team for assistance.
            </p>
            <div className="flex space-x-3">
              <a
                href="mailto:support@example.com"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
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
