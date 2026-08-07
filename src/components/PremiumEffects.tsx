import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeftRight, Sparkles } from 'lucide-react';

export default function PremiumEffects() {
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    // Only run intro once per session
    const introShown = sessionStorage.getItem('skillswap_intro_shown_v2');
    if (!introShown) {
      setShowIntro(true);
      const timer = setTimeout(() => {
        setShowIntro(false);
        sessionStorage.setItem('skillswap_intro_shown_v2', 'true');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <>
      {/* 1. Cinematic Tactile Grain Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* 3. Cinematic Entrance Preloader */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ 
              opacity: 0,
              transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
            }}
            className="fixed inset-0 z-[99999] bg-[#121211] flex flex-col items-center justify-center overflow-hidden"
          >
            {/* Elegant Background Gradients */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,58,54,0.3)_0%,transparent_70%)] pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

            <div className="relative text-center space-y-8 max-w-lg px-8">
              {/* Dynamic Logo Symbol */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto shadow-[0_24px_50px_rgba(0,0,0,0.5)]"
              >
                <ArrowLeftRight size={28} className="text-white animate-pulse" />
              </motion.div>

              {/* Title & Stagger Word Reveal */}
              <div className="space-y-4">
                <motion.h1 
                  initial={{ y: 25, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="font-serif italic text-5xl sm:text-6xl font-bold tracking-tight text-white leading-none"
                >
                  skillswap
                </motion.h1>

                <div className="flex items-center justify-center space-x-2 text-[10px] font-black tracking-[0.35em] text-neutral-400 uppercase">
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    Curated
                  </motion.span>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-white/40"
                  >
                    •
                  </motion.span>
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 }}
                  >
                    Peer Exchange
                  </motion.span>
                </div>
              </div>

              {/* Micro Status bar */}
              <div className="pt-6">
                <div className="w-32 h-[1.5px] bg-white/5 rounded-full mx-auto overflow-hidden relative">
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                  />
                </div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="text-[9px] font-medium text-neutral-500 uppercase tracking-widest mt-2 flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={10} className="text-amber-400 animate-pulse" /> Loading Exchange Engine
                </motion.p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
