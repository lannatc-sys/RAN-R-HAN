'use client';

import { useState, useEffect } from 'react';
import { Lock, Delete, X, ShieldAlert } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expectedPin: string;
  title?: string;
  description?: string;
}

export function PinModal({
  isOpen,
  onClose,
  onSuccess,
  expectedPin,
  title = 'ยืนยันรหัส PIN ความปลอดภัย',
  description = 'กรุณากรอกรหัส PIN 4 หลักเพื่อดำเนินการต่อ',
}: PinModalProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  // Reset states when opened
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setIsShaking(false);
    }
  }, [isOpen]);

  // Support physical keyboard
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePressDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, expectedPin]);

  const handlePressDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(null);

    if (newPin.length === 4) {
      validatePin(newPin);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const validatePin = (inputPin: string) => {
    const targetPin = expectedPin || '0000';
    if (inputPin === targetPin) {
      onSuccess();
      onClose();
    } else {
      setIsShaking(true);
      setError('รหัส PIN ไม่ถูกต้อง');
      setTimeout(() => {
        setIsShaking(false);
        setPin('');
      }, 700);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className={`w-full max-w-xs bg-white rounded-3xl shadow-2xl p-6 space-y-5 text-center border border-amber-100 ${
          isShaking ? 'animate-bounce' : ''
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center -mt-1">
          <div className="w-6" />
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200/80 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1">
          <h3 className="font-bold text-stone-900 text-base">{title}</h3>
          <p className="text-xs text-stone-500 leading-relaxed">{description}</p>
        </div>

        {/* PIN 4-Dots Display */}
        <div className="flex items-center justify-center gap-4 py-2">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  error
                    ? 'bg-red-500 scale-110'
                    : isFilled
                    ? 'bg-amber-600 scale-125 shadow-xs shadow-amber-600/40'
                    : 'bg-stone-200'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="text-xs text-red-600 font-bold flex items-center justify-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Numpad 3x4 Grid */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handlePressDigit(num)}
              className="h-14 rounded-2xl bg-stone-50 hover:bg-amber-50 active:bg-amber-100 text-stone-800 hover:text-amber-900 font-extrabold text-xl flex items-center justify-center border border-stone-200/80 hover:border-amber-300 transition-all shadow-2xs"
            >
              {num}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-stone-50 hover:bg-stone-100 text-stone-400 font-bold text-xs flex items-center justify-center border border-stone-200/80 transition-all"
          >
            ล้าง
          </button>

          {/* Zero Button */}
          <button
            type="button"
            onClick={() => handlePressDigit('0')}
            className="h-14 rounded-2xl bg-stone-50 hover:bg-amber-50 active:bg-amber-100 text-stone-800 hover:text-amber-900 font-extrabold text-xl flex items-center justify-center border border-stone-200/80 hover:border-amber-300 transition-all shadow-2xs"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-stone-50 hover:bg-stone-100 text-stone-600 font-bold text-sm flex items-center justify-center border border-stone-200/80 transition-all active:scale-95"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <div className="text-[11px] text-stone-400 pt-1">
          รหัสเริ่มต้นสำหรับร้านค้าคือ: <span className="font-bold text-stone-600">0000</span>
        </div>
      </div>
    </div>
  );
}
