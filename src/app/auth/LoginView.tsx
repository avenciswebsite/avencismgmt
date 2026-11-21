import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import avencisSymbol from '@/assets/avencis-symbol.png';
import avencisWordmark from '@/assets/avencis-wordmark.png';
import { 
  Building2, 
  Lock, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  Smartphone, 
  Key,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, isLoading, authError, clearAuthError } = useAuth();
  const navigate = useNavigate();

  const [authMethod, setAuthMethod] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[800px] h-[500px] bg-secondary-fixed-dim/20 rounded-full blur-[140px] -translate-y-12"></div>
        <div className="w-[500px] h-[350px] bg-surface-container-high/60 rounded-full blur-[100px] translate-y-36"></div>
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Header Insignia */}
        <header className="flex flex-col items-center text-center mb-6">
          <div className="mb-3 flex items-center justify-center gap-3">
            <img
              src={avencisSymbol}
              alt="Avencis Symbol"
              className="h-9 w-auto object-contain shrink-0"
            />
            <img
              src={avencisWordmark}
              alt="Avencis"
              className="h-6 w-auto object-contain shrink-0"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-surface-container-high/70 px-3 py-1 rounded-full text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container animate-pulse"></span>
            <span>Workforce Management • Enterprise Access</span>
          </div>
        </header>

        {/* Main Login Card */}
        <div className="w-full bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 p-5 sm:p-8">
          <div className="mb-6">
            <h1 className="font-serif text-2xl text-primary font-normal">Sign In</h1>
            <p className="text-xs text-on-surface-variant mt-1">
              Enter your enterprise credentials to access your workspace.
            </p>
          </div>

          {/* Authentication Error Banner */}
          {authError && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-tight">{authError}</div>
            </div>
          )}

          {/* Tab selector */}
          <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-lg mb-5 text-xs font-semibold">
            <button
              onClick={() => { setAuthMethod('password'); clearAuthError(); }}
              className={`py-1.5 rounded transition-colors ${
                authMethod === 'password'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Email & Password
            </button>
            <button
              onClick={() => { setAuthMethod('otp'); clearAuthError(); }}
              className={`py-1.5 rounded transition-colors ${
                authMethod === 'otp'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Mobile OTP
            </button>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4 text-xs">
            {authMethod === 'password' ? (
              <>
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-outline" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); clearAuthError(); }}
                      className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">
                    Master Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-outline" />
                    <input
                      type="password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearAuthError(); }}
                      className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">
                    Registered Mobile Number
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 absolute left-3 top-2.5 text-outline" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 98000 00000"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">
                    6-Digit SMS OTP
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3 top-2.5 text-outline" />
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="••••••"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none font-mono tracking-widest text-center"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-primary text-white rounded-lg font-semibold text-xs hover:bg-primary/95 transition-all shadow-md flex items-center justify-center gap-2 group disabled:opacity-60"
            >
              {isLoading ? (
                <span>Authenticating with Workspace...</span>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4 text-secondary-fixed group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Footer Notice */}
        <div className="mt-6 flex items-center gap-1.5 text-[11px] text-on-surface-variant">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Secured with TLS 1.3 & AES-256 Tenant Encryption</span>
        </div>
      </div>
    </div>
  );
};
