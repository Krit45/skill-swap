import { useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

export default function AnimatedBackground() {
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  // Spring values for mouse parallax drift
  const xValue = useMotionValue(0);
  const yValue = useMotionValue(0);
  const driftX = useSpring(xValue, { damping: 50, stiffness: 200 });
  const driftY = useSpring(yValue, { damping: 50, stiffness: 200 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      // Calculate normalized position between -1 and 1
      const x = (e.clientX / innerWidth) * 2 - 1;
      const y = (e.clientY / innerHeight) * 2 - 1;
      
      // Drift maximum amplitude of 25px
      xValue.set(x * 25);
      yValue.set(y * 25);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [xValue, yValue]);

  return (
    <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-[#faf8f5]">
      {/* 1. Subtle modern radial background grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.35] mix-blend-overlay"
        style={{
          backgroundImage: `radial-gradient(#121211 0.75px, transparent 0.75px), radial-gradient(#121211 0.75px, #faf8f5 0.75px)`,
          backgroundSize: '40px 40px',
          backgroundPosition: '0 0, 20px 20px'
        }}
      />

      {/* 2. Abstract Handcrafted Rotating Vector Orbits (Aesthetic Anchors) */}
      <div className="absolute top-[15%] right-[8%] w-[280px] h-[280px] opacity-[0.06] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border border-neutral-900 rounded-full border-dashed"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="w-[70%] h-[70%] border border-neutral-900 rounded-full"
        />
        <span className="font-serif italic text-xs text-neutral-900 absolute">coordinate.swap.hub</span>
      </div>

      <div className="absolute bottom-[12%] left-[5%] w-[340px] h-[340px] opacity-[0.04] flex items-center justify-center">
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border border-neutral-900 rounded-full"
        />
        <div className="absolute inset-[30px] border border-neutral-900 rounded-full border-dashed" />
        <div className="absolute w-[1px] h-full bg-neutral-900 rotate-45" />
        <div className="absolute w-[1px] h-full bg-neutral-900 -rotate-45" />
      </div>

      {/* 3. Soft Floating Blur Blobs with Interactive Parallax Drift */}
      <motion.div
        style={{ x: driftX, y: driftY }}
        className="absolute inset-0"
      >
        {/* Amber Blob */}
        <motion.div
          animate={{
            x: [0, 60, -30, 0],
            y: [0, -50, 30, 0],
            scale: [1, 1.12, 0.92, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-[-8%] left-[-8%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-tr from-orange-100/25 to-amber-100/15 blur-[120px]"
        />

        {/* Indigo / Rose Blob */}
        <motion.div
          animate={{
            x: [0, -70, 40, 0],
            y: [0, 60, -50, 0],
            scale: [1, 0.92, 1.08, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute bottom-[-8%] right-[-8%] w-[65vw] h-[65vw] rounded-full bg-gradient-to-bl from-indigo-100/15 to-pink-100/25 blur-[130px]"
        />

        {/* Soft Emerald center accent */}
        <motion.div
          animate={{
            x: [0, 40, -40, 0],
            y: [0, 40, -40, 0],
            scale: [1, 1.15, 0.88, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-[25%] left-[25%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-r from-emerald-100/12 to-teal-100/12 blur-[100px]"
        />
      </motion.div>

      {/* 4. Atmospheric fine linear overlay separator */}
      <div className="absolute top-[80px] inset-x-0 h-px bg-[linear-gradient(to_right,transparent,rgba(18,18,17,0.035)_20%,rgba(18,18,17,0.035)_80%,transparent)]" />
      <div className="absolute bottom-[80px] inset-x-0 h-px bg-[linear-gradient(to_right,transparent,rgba(18,18,17,0.035)_20%,rgba(18,18,17,0.035)_80%,transparent)]" />
    </div>
  );
}
