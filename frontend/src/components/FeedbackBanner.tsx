import React from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { TechTag } from './TechTag';

export interface FeedbackBannerData {
  type: 'success' | 'error';
  title: string;
  detail?: string;
}

export interface FeedbackBannerProps {
  feedbackBanner: FeedbackBannerData;
  setFeedbackBanner: (banner: null) => void;
}

export function FeedbackBanner({
  feedbackBanner,
  setFeedbackBanner,
}: FeedbackBannerProps) {
  return (
    <div className="max-w-7xl mx-auto w-full px-4 pt-4">
      <div
        role={feedbackBanner.type === 'success' ? 'status' : 'alert'}
        className={`p-3.5 rounded-lg border flex items-start justify-between text-sm font-medium ${
          feedbackBanner.type === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : 'bg-red-50 border-red-300 text-red-900'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {feedbackBanner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div>{feedbackBanner.title}</div>
            {feedbackBanner.detail && (
              <div>
                <TechTag>{feedbackBanner.detail}</TechTag>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFeedbackBanner(null)}
          aria-label="Fechar aviso"
          className="text-stone-500 hover:text-stone-800 font-bold ml-4 p-1 leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
