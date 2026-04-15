import { useState } from "react";

export function AICommandCenter() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    const res = await fetch("/api/ai-command", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: input })
    });

    const data = await res.json();

    setMessages(prev => [
      ...prev,
      { role: "assistant", content: data.response }
    ]);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">

      {/* Header */}
      <div className="p-6 border-b bg-white/80 backdrop-blur">
        <h1 className="text-xl font-bold">Ask Codical</h1>
        <p className="text-sm text-gray-500">
          AI-powered medical coding intelligence
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-xl p-4 rounded-xl ${
              m.role === "user"
                ? "ml-auto bg-blue-600 text-white"
                : "bg-white shadow"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about coding, claims, billing..."
          className="flex-1 px-4 py-3 border rounded-xl"
        />
        <button
          onClick={sendMessage}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl"
        >
          Send
        </button>
      </div>
    </div>
  );
}
