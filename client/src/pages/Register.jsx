import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import { Loader2, User, Mail, Lock, EyeOff, ArrowRightToLine } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      login(data);
      navigate('/');
    } catch (err) {
      console.error('Registration error details:', err);
      if (err.response) {
        setError(err.response.data?.message || `Server error: ${err.response.status}`);
      } else if (err.request) {
        setError('Network error: Could not connect to the server.');
      } else {
        setError(err.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-black font-sans">
      {/* Left Panel - Hidden on mobile */}
      <div className="hidden lg:flex w-[35%] flex-col justify-center px-12 xl:px-20 bg-gradient-to-b from-[#0b3b24] via-[#107041] to-[#12884f] text-white relative overflow-hidden">
        
        {/* Top Left Logo Placeholder */}
        <div className="absolute top-10 left-12 flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center border border-white/30 rounded-lg backdrop-blur-sm bg-white/10">
            <ArrowRightToLine className="w-5 h-5" />
          </div>
          <span className="font-bold text-2xl italic tracking-tight">RealChatX</span>
        </div>

        {/* Text Content */}
        <div className="relative z-10 -mt-20">
          <h1 className="text-[2.75rem] xl:text-[3.25rem] font-bold mb-6 leading-[1.1] tracking-tight">
            Welcome to<br/>
            PugArch<br/>
            Technology.<br/>
            Create Your<br/>
            Account Today.
          </h1>
          <p className="text-white/80 text-lg xl:text-xl max-w-sm font-medium leading-relaxed">
            Experience the future of<br/>communication.
          </p>
        </div>
      </div>

      {/* Right Panel - Form Area */}
      <div 
        className="flex-1 flex items-center justify-center relative bg-cover bg-center px-4"
        style={{ backgroundImage: `url('/register-bg.png')` }}
      >
        <div className="absolute inset-0 bg-black/40 z-0"></div>

        {/* Outer Form Container */}
        <div className="relative z-10 w-full max-w-[500px] bg-[#1a1f24]/95 backdrop-blur-md rounded-[2rem] p-8 md:p-10 border-[1.5px] border-[#2ecc71] shadow-[0_0_40px_rgba(46,204,113,0.15)]">
          
          <div className="text-center mb-8">
            <h2 className="text-[1.35rem] font-semibold text-white tracking-wide">
              Create Your RealChatX Account
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Powered by PugArch Technology
            </p>
          </div>

          {error && (
            <div className="w-full p-3 mb-6 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div className="relative group">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 group-focus-within:text-[#2ecc71] transition-colors" />
              <input
                type="text"
                placeholder="Full Name"
                className="w-full bg-[#1e2329]/50 border border-gray-600/50 rounded-full py-[14px] pl-[52px] pr-5 text-white placeholder-gray-500 focus:outline-none focus:border-[#2ecc71] focus:ring-1 focus:ring-[#2ecc71] transition-all text-[15px]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Email Address */}
            <div className="relative group">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 group-focus-within:text-[#2ecc71] transition-colors" />
              <input
                type="email"
                placeholder="Email Address"
                className="w-full bg-[#1e2329]/50 border border-gray-600/50 rounded-full py-[14px] pl-[52px] pr-5 text-white placeholder-gray-500 focus:outline-none focus:border-[#2ecc71] focus:ring-1 focus:ring-[#2ecc71] transition-all text-[15px]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 group-focus-within:text-[#2ecc71] transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create Password"
                  className="w-full bg-[#1e2329]/50 border border-gray-600/50 rounded-full py-[14px] pl-[52px] pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-[#2ecc71] focus:ring-1 focus:ring-[#2ecc71] transition-all text-[15px]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <EyeOff className="w-[18px] h-[18px]" />
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-2.5 ml-5">
                At least 8 characters, 1 number, 1 symbol
              </p>
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-3 mt-8 mb-6 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-0.5">
                <input 
                  type="checkbox" 
                  required 
                  className="w-4 h-4 appearance-none rounded-[3px] border border-gray-500 checked:bg-[#2ecc71] checked:border-[#2ecc71] focus:outline-none transition-colors cursor-pointer" 
                />
                <svg className="absolute w-2.5 h-2.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100" style={{'--tw-peer-checked-opacity': '1'}} viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-[13px] text-gray-300">
                I agree to the <span className="text-white hover:underline cursor-pointer">Terms of Service</span> and <span className="text-white hover:underline cursor-pointer">Privacy Policy</span>.
              </span>
            </label>

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#2ecc71] via-[#27ae60] to-[#2ecc71] bg-[length:200%_auto] hover:bg-right text-black font-semibold py-[14px] rounded-full shadow-[0_4px_15px_rgba(46,204,113,0.3)] transition-all duration-500 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed text-[15px]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-black" /> : 'Sign Up'}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-8 text-center">
            <p className="text-[13.5px] text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-[#2ecc71] hover:text-[#27ae60] hover:underline font-medium transition-colors">
                Log In
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Register;
