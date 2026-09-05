'use client';

import { useState } from 'react';
import { MenuItem, Option } from '@/lib/types';
import { X, Plus, Minus } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface OptionModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (item: MenuItem, qty: number, selectedOptions: Option[], note: string) => void;
}

export function OptionModal({ item, onClose, onAddToCart }: OptionModalProps) {
  const { t, lang } = useLanguage();
  const [qty, setQty] = useState(1);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [note, setNote] = useState('');

  if (!item) return null;

  const options = item.options || [];

  const toggleOption = (optId: string) => {
    setSelectedOptionIds((prev) =>
      prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
    );
  };

  const selectedOptionsList = options.filter((o) => selectedOptionIds.includes(o.id));
  const optionsDelta = selectedOptionsList.reduce((sum, o) => sum + Number(o.price_delta), 0);
  const unitPrice = Number(item.price) + optionsDelta;
  const totalPrice = unitPrice * qty;

  const handleConfirm = () => {
    onAddToCart(item, qty, selectedOptionsList, note);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-6 duration-200 border border-transparent dark:border-stone-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800">
          <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 truncate pr-2">
            {item.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors shrink-0"
            aria-label={t.common.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 sm:space-y-6">
          {item.image_url && (
            <div className="relative w-full h-44 sm:h-48 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800">
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {item.description && (
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Options */}
          {options.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-xs sm:text-sm font-semibold text-stone-800 dark:text-stone-200">
                {lang === 'th' ? 'ตัวเลือกเพิ่มเติม / ท็อปปิ้ง' : 'Additional Options / Toppings'}
              </div>
              <div className="space-y-2">
                {options.map((opt) => {
                  const isChecked = selectedOptionIds.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      onClick={() => toggleOption(opt.id)}
                      className={`flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-stone-900 dark:text-stone-100'
                          : 'border-stone-200 dark:border-stone-700/80 hover:border-stone-300 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300 pointer-events-none"
                        />
                        <span className="text-xs sm:text-sm font-medium">{opt.name}</span>
                      </div>
                      {Number(opt.price_delta) > 0 && (
                        <span className="text-[11px] sm:text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                          +{Number(opt.price_delta)} {t.common.currency}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-semibold text-stone-800 dark:text-stone-200">
              {lang === 'th' ? 'หมายเหตุพิเศษ' : 'Special Instructions'}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.menu.itemNotePlaceholder}
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              maxLength={150}
            />
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs sm:text-sm font-semibold text-stone-800 dark:text-stone-200">
              {lang === 'th' ? 'จำนวน' : 'Quantity'}
            </span>
            <div className="flex items-center gap-2 sm:gap-3 bg-stone-100 dark:bg-stone-800 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white dark:bg-stone-700 shadow-xs text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-600 disabled:opacity-40"
                disabled={qty <= 1}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-bold text-stone-900 dark:text-stone-100 text-sm">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white dark:bg-stone-700 shadow-xs text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Action with Safe Area bottom */}
        <div className="p-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 pb-safe">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3 sm:py-3.5 px-5 sm:px-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl shadow-lg shadow-amber-600/25 flex items-center justify-between transition-all min-h-[44px]"
          >
            <span>{t.menu.addToCart}</span>
            <span>{totalPrice.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t.common.currency}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
