import React from 'react';

export function TechTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] text-stone-500 bg-stone-100 rounded px-1.5 py-0.5">
      {children}
    </span>
  );
}
