import React from 'react';
import { MapPin, Settings, Activity, Phone, Lightbulb, Tv, MessageSquareCode , Radio} from 'lucide-react';

const Navigation = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'status', label: 'Status', icon: Activity },
    { id: 'phone', label: 'Phone', icon: Phone },
    { id: 'led', label: 'LED', icon: Lightbulb },
    { id: 'espnow', label: 'ESP-NOW', icon: Radio },
    { id: 'remote', label: 'IR Transmit', icon: Tv },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'cmd', label: 'SMS CMD', icon: MessageSquareCode }
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-center space-x-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center px-4 py-3 text-sm font-medium transition-all duration-200 hover:bg-gray-800 ${
                  activeTab === item.id
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="hidden sm:block">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;