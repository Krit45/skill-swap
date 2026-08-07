import { useState } from 'react';
import { auth, signInWithGoogle } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, ArrowRight, Loader2, ArrowLeftRight, Sparkles, Code, Palette, Star } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center max-w-6xl mx-auto px-4 py-8 sm:py-12">
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-stretch">
        
        {/* Left column - Elegant Human Editorial / SaaS Side panel */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:flex lg:col-span-6 flex-col justify-between p-14 bg-white/30 backdrop-blur-xl rounded-[40px] border border-neutral-200/80 shadow-[0_24px_50px_rgba(0,0,0,0.01)] relative overflow-hidden"
        >
          {/* Subtle grid pattern inside */}
          <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
          
          <div className="relative z-10 flex items-center space-x-3">
            <div className="w-10 h-10 bg-neutral-950 rounded-xl flex items-center justify-center shadow-md">
              <ArrowLeftRight size={18} className="text-white" />
            </div>
            <span className="font-serif italic text-2xl font-black tracking-tight text-neutral-950">skillswap</span>
          </div>

          <div className="relative z-10 my-auto py-12 space-y-10">
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center space-x-2 bg-neutral-950 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-neutral-950/20"
              >
                <Sparkles size={11} className="text-amber-400 fill-amber-400" />
                <span>The Peer Knowledge Network</span>
              </motion.div>
              
              <h1 className="text-5xl xl:text-6xl font-serif font-semibold tracking-tight text-neutral-950 leading-[1.02]">
                Trade what you <span className="italic text-neutral-400 font-light">know</span> <br />
                for what you want to <span className="italic text-neutral-950 font-bold underline decoration-amber-400 decoration-4 underline-offset-4">learn</span>.
              </h1>
              
              <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed max-w-md font-semibold">
                Skip standard academies and expensive coaching. Connect with real peers, exchange skills 1-on-1, level up your XP, and unlock badges as you grow.
              </p>
            </div>

            {/* Asymmetrical floating interactive showcase widgets */}
            <div className="grid grid-cols-2 gap-6 relative pt-4">
              <motion.div 
                whileHover={{ y: -6, rotate: -1.5 }}
                className="bg-white border border-neutral-200/80 p-5 rounded-[24px] shadow-sm space-y-3.5"
              >
                <div className="w-9 h-9 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-800 border border-neutral-100 shadow-sm">
                  <Code size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-neutral-900 uppercase tracking-tight">Learn React</h4>
                  <p className="text-[10px] font-semibold text-neutral-400 mt-1">Offered by Jane (Senior Dev)</p>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -6, rotate: 1.5 }}
                className="bg-white border border-neutral-200/80 p-5 rounded-[24px] shadow-sm space-y-3.5 mt-6"
              >
                <div className="w-9 h-9 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-800 border border-neutral-100 shadow-sm">
                  <Palette size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-neutral-900 uppercase tracking-tight">UX Architecture</h4>
                  <p className="text-[10px] font-semibold text-neutral-400 mt-1">Offered by Alex (Lead Designer)</p>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between border-t border-neutral-200/60 pt-8">
            <div className="flex items-center space-x-1 text-[10px] font-black uppercase tracking-widest text-neutral-400">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <span className="text-neutral-600 ml-1.5 font-bold">Over 2,000+ Swaps completed</span>
            </div>
          </div>
        </motion.div>

        {/* Right column - Elegant auth card */}
        <div className="lg:col-span-6 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md w-full bg-white p-8 sm:p-12 rounded-[40px] shadow-[0_24px_60px_rgba(0,0,0,0.015)] border border-neutral-200/80"
          >
            <div className="text-center lg:text-left mb-10">
              <div className="w-12 h-12 bg-neutral-950 rounded-2xl lg:hidden flex items-center justify-center mx-auto mb-6 shadow-md">
                <ArrowLeftRight className="text-white" size={22} />
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-neutral-950">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-neutral-400 text-xs sm:text-sm mt-2.5 font-semibold leading-relaxed">
                {isLogin ? 'Sign in to your peer portal to resume swapping.' : 'Join your local exchange and begin sharing skills.'}
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-50/50 border border-red-200/60 rounded-2xl text-xs text-red-600 font-semibold leading-relaxed"
              >
                {error}
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              <motion.form
                key={isLogin ? 'login' : 'signup'}
                initial={{ opacity: 0, x: isLogin ? -15 : 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 15 : -15 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                onSubmit={handleEmailAuth}
                className="space-y-4 mb-6"
              >
                {!isLogin && (
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" size={16} />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full pl-11 pr-4 py-3.5 bg-neutral-50/40 hover:bg-neutral-50/80 border border-neutral-200/80 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-neutral-950/5 focus:border-neutral-950 transition-all placeholder:text-neutral-400 font-bold text-neutral-900"
                    />
                  </div>
                )}
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    className="w-full pl-11 pr-4 py-3.5 bg-neutral-50/40 hover:bg-neutral-50/80 border border-neutral-200/80 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-neutral-950/5 focus:border-neutral-950 transition-all placeholder:text-neutral-400 font-bold text-neutral-900"
                  />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" size={16} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full pl-11 pr-4 py-3.5 bg-neutral-50/40 hover:bg-neutral-50/80 border border-neutral-200/80 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-neutral-950/5 focus:border-neutral-950 transition-all placeholder:text-neutral-400 font-bold text-neutral-900"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 bg-neutral-950 text-white py-4 px-4 rounded-xl font-black uppercase tracking-wider hover:bg-neutral-850 transition-all disabled:opacity-50 text-xs shadow-md cursor-pointer"
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : (
                    <>
                      <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                      <ArrowRight size={14} className="ml-1" />
                    </>
                  )}
                </motion.button>
              </motion.form>
            </AnimatePresence>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200/80"></div>
              </div>
              <div className="relative flex justify-center text-[9px] uppercase tracking-[0.2em]">
                <span className="bg-white px-4 text-neutral-400 font-black">Or secure connect</span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 bg-white border border-neutral-250 hover:border-neutral-950 py-3.5 px-4 rounded-xl font-black uppercase tracking-wider text-neutral-800 hover:text-neutral-950 transition-all disabled:opacity-50 text-xs shadow-sm cursor-pointer"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 shrink-0" />
              <span>Google Account</span>
            </motion.button>

            <div className="mt-10 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-xs font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-950 transition-colors underline underline-offset-4"
              >
                {isLogin ? "Join free as exchanger" : "Already registered? Sign in"}
              </button>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
