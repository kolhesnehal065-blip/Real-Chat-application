import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import { Loader2 } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data);
      navigate('/');
    } catch (err) {
      console.error('Login error details:', err);
      if (err.response) {
        setError(err.response.data?.message || `Server error: ${err.response.status}`);
      } else if (err.request) {
        setError('Network error: Could not connect to the server.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen font-sans px-4 relative bg-cover bg-center"
      style={{ backgroundImage: `url('/login-bg.png')` }}
    >
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-black/60 z-0"></div>

      {/* Main Container */}
      <div className="w-full max-w-[350px] border border-[#363636]/50 bg-[#000000]/80 backdrop-blur-md rounded-lg py-10 px-8 flex flex-col items-center relative z-10 shadow-2xl">
        
        {/* Logo Header */}
        <h1 className="text-3xl font-semibold text-white mb-8 tracking-tight">RealChatX</h1>

        {/* Error message */}
        {error && (
          <div className="w-full p-3 mb-4 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-sm text-center">
            {error}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col">
          <input
            type="email"
            placeholder="Email Address"
            className="w-full bg-[#262626] text-white text-sm px-3 py-2.5 rounded-sm border border-transparent focus:outline-none focus:border-[#38bdf8]/50 mb-3 transition-colors"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full bg-[#262626] text-white text-sm px-3 py-2.5 rounded-sm border border-transparent focus:outline-none focus:border-[#38bdf8]/50 mb-3 transition-colors"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* Forgot Password */}
          <div className="w-full flex justify-end mb-4">
            <a href="#" className="text-xs text-blue-500 hover:text-white transition-colors tracking-wide">
              Forgot password?
            </a>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#38bdf8] hover:bg-[#0ea5e9] text-white font-semibold py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log In'}
          </button>
        </form>

        {/* Divider */}
        <div className="w-full flex items-center my-6">
          <div className="flex-1 h-px bg-[#363636]"></div>
          <div className="px-4 text-[#737373] text-xs font-semibold uppercase tracking-widest">or</div>
          <div className="flex-1 h-px bg-[#363636]"></div>
        </div>

        {/* Footer Link */}
        <div className="text-center text-sm text-white/80">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#38bdf8] font-semibold hover:text-[#0ea5e9] transition-colors">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
