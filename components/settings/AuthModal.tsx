'use client';

import React, { useEffect, useState } from 'react';
import { X, Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { useUIStore } from '@/lib/store/ui-store';
import { useAuthStore } from '@/lib/store/auth-store';

type Mode = 'sign_in' | 'sign_up';

export const AuthModal: React.FC = () => {
  const ui = useUIStore();
  const { signInWithPassword, signUp, error, clearError, status } = useAuthStore();

  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signedUpNotice, setSignedUpNotice] = useState(false);

  // Close automatically once auth succeeds
  useEffect(() => {
    if (status === 'authenticated' && ui.isAuthModalOpen) {
      ui.setIsAuthModalOpen(false);
    }
  }, [status, ui]);

  useEffect(() => {
    if (!ui.isAuthModalOpen) {
      setEmail('');
      setPassword('');
      setSubmitting(false);
      setSignedUpNotice(false);
      clearError();
    }
  }, [ui.isAuthModalOpen, clearError]);

  if (!ui.isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    clearError();

    if (mode === 'sign_in') {
      await signInWithPassword(email, password);
    } else {
      const { error: signUpError } = await signUp(email, password);
      if (!signUpError) setSignedUpNotice(true);
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={() => ui.setIsAuthModalOpen(false)}
      />

      <div className="relative w-full max-w-sm bg-white dark:bg-[#0b0f19] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#1e293b] p-6">
        <button
          onClick={() => ui.setIsAuthModalOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
          {mode === 'sign_in' ? 'Masuk ke Deftorch' : 'Buat akun Deftorch'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Chat, agent, dan workflow kamu akan tersimpan dan bisa diakses dari perangkat lain.
        </p>

        {signedUpNotice ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="text-green-500" size={32} />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Cek email <span className="font-medium">{email}</span> untuk konfirmasi akun,
              lalu masuk seperti biasa.
            </p>
            <button
              onClick={() => {
                setMode('sign_in');
                setSignedUpNotice(false);
              }}
              className="text-sm font-medium text-[#1a6adf] hover:underline"
            >
              Kembali ke halaman masuk
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#1e293b] bg-gray-50 dark:bg-[#111827] text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1a6adf]/40"
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
                placeholder="Password (min. 6 karakter)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#1e293b] bg-gray-50 dark:bg-[#111827] text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1a6adf]/40"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#1a6adf] to-[#4685ff] hover:from-[#1558d6] hover:to-[#3870eb] text-white text-sm font-semibold shadow-lg shadow-[#1a6adf]/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {mode === 'sign_in' ? 'Masuk' : 'Daftar'}
            </button>

            <p className="text-center text-xs text-gray-500 dark:text-gray-400 pt-1">
              {mode === 'sign_in' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in');
                  clearError();
                }}
                className="font-medium text-[#1a6adf] hover:underline"
              >
                {mode === 'sign_in' ? 'Daftar' : 'Masuk'}
              </button>
            </p>
          </form>
        )}

        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-4 text-center">
          Deftorch tetap bisa dipakai tanpa akun — data akan tersimpan lokal di browser ini saja.
        </p>
      </div>
    </div>
  );
};
