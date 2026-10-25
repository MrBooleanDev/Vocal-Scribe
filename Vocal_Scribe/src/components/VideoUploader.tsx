import React, {useRef, useState} from 'react';
import {UploadCloud} from 'lucide-react';
interface Props {onFileSelected: (file: File, name: string) => void; isProcessing: boolean;}
export const VideoUploader: React.FC<Props> = ({onFileSelected, isProcessing}) => {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const select = (file?: File) => {
    if (!file || isProcessing) return;
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {setError('Choose an audio or video file.'); return;}
    setError(''); onFileSelected(file, file.name);
  };
  return <section className={`upload-card ${dragging ? 'is-dragging' : ''}`} onDragOver={e=>{e.preventDefault(); if(!isProcessing)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);select(e.dataTransfer.files[0]);}}>
    <div className="upload-icon"><UploadCloud size={30}/></div><h2 className="text-2xl font-semibold tracking-tight">Turn speech into text</h2><p className="text-sm text-slate-400">Drop your audio or video here to get started.</p><button className="primary-button" disabled={isProcessing} onClick={()=>input.current?.click()}>Choose file</button><input ref={input} type="file" accept="audio/*,video/*" hidden onChange={e=>select(e.target.files?.[0])} aria-label="Choose audio or video" disabled={isProcessing}/><p className="text-xs text-slate-500">English · 30-second clips · No API key</p>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </section>;
};
