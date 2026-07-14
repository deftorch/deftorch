import React, { useEffect, useState } from 'react';
import { X, Check, Sparkles, Zap, Shield, Infinity as InfinityIcon } from 'lucide-react';
import { useUIStore } from '@/lib/store/ui-store';

export const UpgradeModal: React.FC = () => {
  const ui = useUIStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (ui.isUpgradeModalOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [ui.isUpgradeModalOpen]);

  if (!isVisible && !ui.isUpgradeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          ui.isUpgradeModalOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => ui.setIsUpgradeModalOpen(false)}
      />
      
      {/* Modal */}
      <div 
        className={`relative w-full max-w-2xl bg-white dark:bg-[#0b0f19] rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 transform border border-gray-200 dark:border-[#1e293b] ${
          ui.isUpgradeModalOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        <button
          onClick={() => ui.setIsUpgradeModalOpen(false)}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col md:flex-row">
          {/* Left Side - Current Plan */}
          <div className="w-full md:w-5/12 bg-gray-50 dark:bg-[#111827] p-8 border-b md:border-b-0 md:border-r border-gray-200 dark:border-[#1e293b] flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Plan</h3>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Free Tier</div>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Check size={16} className="text-gray-400 shrink-0 mt-0.5" />
                  <span>Basic code generation</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Check size={16} className="text-gray-400 shrink-0 mt-0.5" />
                  <span>Standard execution speed</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Check size={16} className="text-gray-400 shrink-0 mt-0.5" />
                  <span>Community support</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Side - Pro Plan */}
          <div className="w-full md:w-7/12 p-8 relative overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-gradient-to-br from-[#1a6adf] to-[#8b5cf6] rounded-full blur-[80px] opacity-20 dark:opacity-30 pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={20} className="text-[#1a6adf] dark:text-[#60aaff]" />
                <h3 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1a6adf] to-[#8b5cf6] uppercase tracking-wider">
                  Deftorch Pro
                </h3>
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">$20</span>
                <span className="text-gray-500 dark:text-gray-400">/month</span>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#1a6adf]/10 dark:bg-[#60aaff]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap size={12} className="text-[#1a6adf] dark:text-[#60aaff]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Priority Processing</div>
                    <div className="text-xs text-gray-500">Access to fastest GPU clusters</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#1a6adf]/10 dark:bg-[#60aaff]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <InfinityIcon size={12} className="text-[#1a6adf] dark:text-[#60aaff]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Unlimited Messages</div>
                    <div className="text-xs text-gray-500">No daily chat or generation caps</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#1a6adf]/10 dark:bg-[#60aaff]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield size={12} className="text-[#1a6adf] dark:text-[#60aaff]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Private Artifacts</div>
                    <div className="text-xs text-gray-500">Keep your visual creations private</div>
                  </div>
                </li>
              </ul>

              <button 
                onClick={() => {
                  ui.setIsUpgradeModalOpen(false);
                  // Optional: add a toast saying "Upgraded successfully!" for the dummy effect
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#1a6adf] to-[#4685ff] hover:from-[#1558d6] hover:to-[#3870eb] text-white rounded-xl font-semibold shadow-lg shadow-[#1a6adf]/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
