import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores';
import { APIError } from '@/services/api';
import type { LoginFormData, AuthValidationErrors } from '@/types';
import { Copy, Check, ArrowRight, Loader2 } from 'lucide-react';

/**
 * Login Page Component
 * Replicates the original login.html design with React and TypeScript
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { login, isLoading } = useAuthStore();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false
  });
  const [errors, setErrors] = useState<AuthValidationErrors>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const forgotPasswordRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Show flash message if redirected from 401 logout
  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth-flash');
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.message) {
          setErrors(prev => ({ ...prev, general: data.message as string }));
        }
        localStorage.removeItem('auth-flash');
      }
    } catch {}
  }, []);

  // Handle click outside to close popup
  useEffect(() => {
    if (!showForgotPassword) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        forgotPasswordRef.current &&
        !forgotPasswordRef.current.contains(event.target as Node)
      ) {
        setShowForgotPassword(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showForgotPassword]);

  // Copy command to clipboard
  const handleCopyCommand = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const command = 'docker exec tgo-api resetadmin';
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy command:', err);
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: AuthValidationErrors = {};

    // Email or username validation (only check if not empty)
    if (!formData.email) {
      newErrors.email = t('auth.validation.emailOrUsernameRequired');
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = t('auth.validation.passwordRequired');
    } else if (formData.password.length < 3) {
      newErrors.password = t('auth.validation.passwordMinLength', { min: 3 });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setErrors({});

    try {
      await login(formData);
      // On success, navigate to intended destination or main app
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (error) {
      let errorMessage = t('auth.validation.loginFailed');

      if (error instanceof APIError) {
        // Handle specific API errors based on status code and error message
        switch (error.status) {
          case 401:
            errorMessage = t('auth.validation.invalidCredentials');
            break;
          case 422:
            errorMessage = error.getUserMessage();
            break;
          case 0:
            errorMessage = t('auth.validation.networkError');
            break;
          default:
            // Use the actual error message from the API
            errorMessage = error.getUserMessage() || t('auth.validation.serverError');
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setErrors({
        general: errorMessage
      });
    }
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear field error when user starts typing
    if (errors[name as keyof AuthValidationErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const inputClass = (hasError: boolean): string => `w-full h-12 px-5 text-sm rounded-full outline-none transition-all duration-200 bg-gray-100 text-gray-900 placeholder:text-gray-400 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-acid-400),0_8px_24px_-14px_rgba(143,179,30,0.6)] dark:focus:bg-gray-900 ${
    hasError ? 'shadow-[inset_0_0_0_1.5px_var(--color-red-400)] bg-red-50/60 dark:bg-red-900/20' : ''
  }`;

  return (
    <div className="tgo-canvas min-h-screen p-3 font-sans antialiased">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1400px] gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Showcase panel */}
        <section className="relative hidden overflow-hidden rounded-[32px] bg-ink-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-white/[0.06]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full border border-white/[0.08]" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-acid-400/10 blur-3xl" />

          <Link to="/" className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
              <img src="/logo.svg" alt="" className="h-6 w-6" />
            </span>
            <span className="text-lg font-medium">{t('brand.name')}</span>
          </Link>

          <div className="relative">
            <h1 className="tgo-display tgo-fade-up text-[64px] leading-[0.95] xl:text-[80px]">
              {t('auth.showcase.headlineTop', 'Support that')}
              <br />
              <span className="text-acid-400">{t('auth.showcase.headlineBottom', 'thinks ahead.')}</span>
            </h1>
            <p className="tgo-fade-up mt-6 max-w-md text-base leading-relaxed text-white/60" style={{ animationDelay: '80ms' }}>
              {t('auth.showcase.subtitle', 'AI agents, your knowledge base and human teammates working one shared inbox.')}
            </p>
          </div>

          {/* Decorative conversation preview */}
          <div className="relative max-w-md space-y-3" aria-hidden="true">
            <div className="tgo-msg-left flex items-end gap-2" style={{ animationDelay: '250ms' }}>
              <span className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-rose-400" />
              <span className="rounded-[20px] rounded-bl-md bg-white/10 px-4 py-2.5 text-sm text-white/90 backdrop-blur">
                {t('auth.showcase.visitorMessage', 'Where is my order #2048?')}
              </span>
            </div>
            <div className="tgo-msg-right flex justify-end" style={{ animationDelay: '650ms' }}>
              <span className="max-w-[85%] rounded-[20px] rounded-br-md bg-acid-400 px-4 py-2.5 text-sm text-ink-900">
                {t('auth.showcase.agentMessage', 'It shipped this morning and arrives Thursday. Want the tracking link?')}
              </span>
            </div>
            <div className="tgo-fade-in flex justify-end" style={{ animationDelay: '1050ms' }}>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-acid-400 tgo-pulse-ring" />
                {t('auth.showcase.agentMeta', 'AI agent replied in 1.2s')}
              </span>
            </div>
          </div>
        </section>

        {/* Form panel */}
        <section className="flex items-center justify-center rounded-[32px] bg-white px-6 py-12 dark:bg-gray-900 sm:px-12">
          <div className="tgo-fade-up w-full max-w-sm">
            {/* Logo (compact screens) */}
            <Link to="/" className="mb-10 flex items-center gap-2 lg:hidden">
              <img src="/logo.svg" alt="Pelatis CS Logo" className="h-9 w-9" />
              <span className="text-xl font-semibold text-gray-800 dark:text-gray-200">{t('brand.name')}</span>
            </Link>

            <p className="tgo-eyebrow">{t('auth.login.eyebrow', 'Welcome back')}</p>
            <h2 className="tgo-display mt-3 text-[44px] text-gray-900 dark:text-white">{t('auth.login.title')}</h2>

            {/* General Error Message */}
            {errors.general && (
              <div className="tgo-pop mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800/50 dark:bg-red-900/30" role="alert">
                <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {/* Email or Username Field */}
              <div>
                <label htmlFor="email" className="mb-2 ml-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('auth.login.emailOrUsername')}
                </label>
                <input
                  type="text"
                  id="email"
                  name="email"
                  required
                  autoComplete="username"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={inputClass(Boolean(errors.email))}
                  placeholder={t('auth.login.emailOrUsernamePlaceholder')}
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="ml-1 mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="mb-2 ml-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('auth.login.password')}
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={inputClass(Boolean(errors.password))}
                  placeholder={t('auth.login.passwordPlaceholder')}
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="ml-1 mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.password}</p>
                )}

                {/* Remember me and Forgot password */}
                <div className="mt-3 flex items-center justify-between px-1">
                  <label htmlFor="rememberMe" className="flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <input
                      id="rememberMe"
                      name="rememberMe"
                      type="checkbox"
                      checked={formData.rememberMe}
                      onChange={handleInputChange}
                      className="h-4 w-4 rounded border-gray-300 accent-[var(--color-ink-900)] dark:border-gray-600 dark:bg-gray-700 dark:accent-[var(--color-acid-400)]"
                      disabled={isLoading}
                    />
                    {t('auth.login.rememberMe')}
                  </label>
                  <div className="relative" ref={forgotPasswordRef}>
                    <button
                      type="button"
                      onMouseEnter={() => setShowForgotPassword(true)}
                      onClick={() => setShowForgotPassword(!showForgotPassword)}
                      className="text-xs font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 transition-colors hover:decoration-acid-500 dark:text-gray-200 dark:decoration-gray-600"
                    >
                      {t('auth.login.forgotPassword', 'Forgot password?')}
                    </button>
                    {showForgotPassword && (
                      <div
                        ref={popupRef}
                        className="animate-in fade-in zoom-in-95 slide-in-from-top-1 absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800"
                        style={{ minWidth: '320px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="mb-3 text-xs text-gray-700 dark:text-gray-300">
                          {t('auth.login.resetAdminInstruction', 'Run the following command to reset the admin user')}
                        </p>
                        <div className="group flex items-center gap-2 rounded-xl bg-ink-900 p-3 dark:bg-black">
                          <code className="min-w-0 flex-1 whitespace-nowrap font-mono text-xs text-acid-300">
                            docker exec tgo-api resetadmin
                          </code>
                          <button
                            type="button"
                            onClick={handleCopyCommand}
                            className="flex-shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            title={copied ? t('auth.login.copied', 'Copied') : t('auth.login.copy', 'Copy')}
                          >
                            {copied ? (
                              <Check className="h-4 w-4 text-acid-400" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="group flex h-12 w-full items-center justify-between rounded-full bg-ink-900 pl-6 pr-1.5 text-sm font-medium text-white shadow-[0_14px_30px_-14px_rgba(15,16,18,0.8)] transition-all duration-300 hover:-translate-y-px active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-acid-400 dark:text-ink-900"
              >
                <span>{isLoading ? t('auth.login.loggingIn') : t('auth.login.loginButton')}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-acid-400 text-ink-900 transition-transform duration-300 group-hover:translate-x-0.5 dark:bg-ink-900 dark:text-acid-400">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </span>
              </button>
            </form>

            {/* Footer Copyright */}
            <p className="mt-12 text-xs text-gray-400 dark:text-gray-500">
              {t('footer.copyright')}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
