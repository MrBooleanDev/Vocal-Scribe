import React from 'react';
import { Sparkles, Youtube } from 'lucide-react';

export const Header: React.FC = () => (
  <header className="app-header">
    <div className="flex items-center gap-3">
      <div className="brand-icon"><Sparkles size={20} /></div>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">VocalScribe</h1>
        <p className="text-xs text-slate-400">Audio & video to text</p>
      </div>
    </div>
    <a className="support-button" href="https://www.youtube.com/@HackGuy?sub_confirmation=1" target="_blank" rel="noopener noreferrer" aria-label="Plz Support — subscribe to The Hack Guy on YouTube (opens in a new tab)">
      <Youtube size={17} aria-hidden="true" />
      <span>Plz Support</span>
    </a>
  </header>
);
