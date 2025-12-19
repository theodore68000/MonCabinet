"use client";

import { forwardRef } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: () => void;
  onEnter?: () => void;
};

const isValidTime = (v: string) => {
  if (!/^\d{2}:\d{2}$/.test(v)) return false;

  const [h, m] = v.split(":").map(Number);
  if (h < 0 || h > 23) return false;
  if (m < 0 || m > 59) return false;

  return true;
};

const TimeField = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, onComplete, onEnter }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (onEnter) onEnter();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value.replace(/[^\d]/g, "");

      if (v.length > 4) v = v.slice(0, 4);

      if (v.length >= 3) {
        v = v.slice(0, 2) + ":" + v.slice(2);
      }

      onChange(v);

      // ✅ onComplete seulement si HH:MM valide
      if (v.length === 5 && isValidTime(v) && onComplete) {
        setTimeout(onComplete, 50);
      }
    };

    return (
      <input
        ref={ref}
        value={value}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        placeholder="--:--"
        inputMode="numeric"
        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-center w-20"
      />
    );
  }
);

export default TimeField;
