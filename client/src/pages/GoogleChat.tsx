import React, { useState } from 'react';
import { Send, UserPlus, Paperclip, ShieldAlert, Check, X } from 'lucide-react';

export default function GoogleChat() {
  const [view, setView] = useState<'requests' | 'chat'>('requests');
  const [msg, setMsg] = useState("");

  return (
    <div className="flex h-screen bg-[#f0f2f5]">
      {/* Mini Sidebar */}
      <div className="w-16 bg-[#0057A8] flex flex-col items-center py-6 gap-6 text-white">
        <button onClick={() => setView('requests')} className="p-2 hover:bg-white/10 rounded-lg"><UserPlus /></button>
        <button onClick={() => setView('chat')} className="p-2 hover:bg-white/10 rounded-lg"><Send /></button>
        <div className="mt-auto p-2 opacity-50"><ShieldAlert /></div>
      </div>

      <div className="flex-1 flex flex-col">
        {view === 'requests' ? (
          <div className="p-10 max-w-2xl mx-auto w-full">
            <h1 className="text-2xl font-bold mb-6">Friend Requests</h1>
            <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-bold">JD</div>
                <div>
                  <p className="font-bold">John Doe</p>
                  <p className="text-sm text-gray-500">Wants to chat with you</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 bg-green-100 text-green-700 rounded-lg"><Check /></button>
                <button className="p-2 bg-red-100 text-red-700 rounded-lg"><X /></button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-white m-4 rounded-2xl shadow-lg border overflow-hidden">
            <div className="p-4 border-b bg-slate-50 font-bold">Chatting with John Doe</div>
            <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-[#f8fafc]">
              <div className="bg-white p-3 rounded-xl shadow-sm max-w-[70%] border border-slate-200 text-sm">
                Hey! Can you send me the medical guidelines file?
              </div>
            </div>
            
            <div className="p-4 border-t flex gap-3 items-center bg-white">
              <label className="cursor-pointer hover:bg-slate-100 p-2 rounded-full transition">
                <Paperclip size={20} className="text-slate-500" />
                <input type="file" className="hidden" />
              </label>
              <input 
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button className="bg-[#0057A8] text-white px-4 py-2 rounded-xl font-medium">Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
