"use client";

import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";

export default function Chat() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    let isMounted = true;
    const socket = new WebSocket("ws://localhost:8080/ws");
    ws.current = socket;

    socket.onopen = () => {
      if (isMounted) setIsConnected(true);
    };

    socket.onmessage = (event) => {
      if (isMounted) {
        setMessages((prev) => [...prev, `AI: ${event.data}`]);
        setIsLoading(false);
      }
    };

    socket.onclose = () => {
      if (isMounted) {
        setIsConnected(false);
        setIsLoading(false);
      }
    };

    socket.onerror = (error) => {
      if (socket.readyState === WebSocket.CLOSED) return;
      console.error("WebSocket connection error");
      if (isMounted) {
        setIsConnected(false);
        setIsLoading(false);
      }
    };

    return () => {
      isMounted = false;
      socket.close();
    };
  }, []);

  const sendMessage = () => {
    if (
      !input.trim() ||
      !ws.current ||
      ws.current.readyState !== WebSocket.OPEN ||
      isLoading
    ) {
      return;
    }

    ws.current.send(input);
    setMessages((prev) => [...prev, `You: ${input}`]);
    setInput("");
    setIsLoading(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans antialiased">
      <div className="w-full max-w-3xl h-[85vh] bg-zinc-900/70 backdrop-blur-xl border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden relative">
        {/* Top Status Bar */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/90 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 ring-4 ring-amber-500/20" />
            <span className="font-mono text-xs tracking-wider text-zinc-300 uppercase font-semibold">
              Console Terminal
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
              }`}
            />
            <span className={isConnected ? "text-emerald-400" : "text-zinc-500"}>
              {isConnected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-zinc-950/40 to-zinc-900/20">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
              <span className="font-mono text-xs uppercase tracking-widest text-zinc-600">
                // Stream Ready
              </span>
              <p className="text-sm font-light text-zinc-400">
                Send a message to begin real-time generation.
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.startsWith("You:");
            const text = msg.replace(/^(You:|AI:)\s*/, "");
            return (
              <div
                key={i}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <span className="font-mono text-[10px] uppercase text-zinc-500 mb-1 px-1 tracking-wider">
                  {isUser ? "Client" : "Assistant"}
                </span>
                <div
                  className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? "bg-zinc-100 text-zinc-950 font-medium rounded-tr-sm shadow-sm"
                      : "bg-zinc-800/60 text-zinc-200 border border-zinc-700/50 rounded-tl-sm backdrop-blur-md"
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <div className="space-y-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>p]:m-0">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Processing Indicator */}
          {isLoading && (
            <div className="flex flex-col items-start">
              <span className="font-mono text-[10px] uppercase text-zinc-500 mb-1 px-1 tracking-wider">
                Assistant
              </span>
              <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-2xl rounded-tl-sm p-4 flex items-center gap-3">
                <span className="font-mono text-xs text-amber-400/90 tracking-wide">
                  Processing
                </span>
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
              </div>
            </div>
          )}

          {/* Auto-scroll target anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Dock */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/90">
          <div className="flex gap-2 bg-zinc-950/80 border border-zinc-800 rounded-2xl p-1.5 focus-within:border-zinc-600 transition-colors">
            <input
              type="text"
              className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 px-4 py-2 text-sm focus:outline-none disabled:opacity-50"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={
                isLoading
                  ? "Awaiting stream..."
                  : isConnected
                  ? "Type message..."
                  : "Disconnected"
              }
              disabled={!isConnected || isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!isConnected || !input.trim() || isLoading}
              className="bg-zinc-100 hover:bg-white text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-600 px-5 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-semibold transition-all"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}