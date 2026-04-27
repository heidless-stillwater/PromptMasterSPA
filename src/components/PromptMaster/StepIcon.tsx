import React from 'react';
import { Icons } from '../Icons';
import type { StatusStep } from './types';

export const StepIcon = ({ stepStatus }: { stepStatus: StatusStep['status'] }) => {
  if (stepStatus === 'done') return <Icons.check className="w-4 h-4 text-emerald-400" />;
  if (stepStatus === 'active') return <Icons.refresh className="w-4 h-4 text-indigo-400 animate-spin" />;
  if (stepStatus === 'error') return <Icons.alert className="w-4 h-4 text-rose-400 animate-pulse" />;
  return <div className="w-4 h-4 rounded-full border border-white/5 bg-white/[0.02]" />;
};
