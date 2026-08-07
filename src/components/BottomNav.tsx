import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Compass, Search, MessageSquare, User } from 'lucide-react';
import { motion } from 'motion/react';

export default function BottomNav() {
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Home' },
    { to: '/discovery', icon: Compass, label: 'Explore' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/chat', icon: MessageSquare, label: 'Chat' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="md:hidden fixed bottom-5 left-4 right-4 z-50">
      <nav className="bg-white/80 backdrop-blur-xl border border-neutral-200/40 px-4 py-2.5 rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-around max-w-md mx-auto relative">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="relative flex flex-col items-center py-1 px-3 transition-all rounded-xl"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="mobile-active-capsule"
                      className="absolute inset-0 bg-neutral-900/5 rounded-2xl z-0"
                      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center">
                    <item.icon 
                      size={20} 
                      className={`transition-all duration-300 ${
                        isActive 
                          ? 'text-neutral-900 scale-110' 
                          : 'text-neutral-400 hover:text-neutral-600'
                      }`} 
                    />
                    <span 
                      className={`text-[9px] mt-1 font-bold tracking-tight transition-all duration-300 ${
                        isActive ? 'text-neutral-900 font-extrabold' : 'text-neutral-400'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
