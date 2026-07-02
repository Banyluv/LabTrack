import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

const defaultIntro = 'Hi! I can help you find pages, explain workflows, and answer questions about inventory, requests, approvals, batch expiry, and daily usage.';

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: defaultIntro }]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, open]);

  const appendMessage = (msg) => setMessages((prev) => [...prev, msg]);

  const handleSend = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;

    appendMessage({ role: 'user', content: trimmed });
    setQuestion('');
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post('/chat', { question: trimmed });
      appendMessage({ role: 'assistant', content: data.answer || 'I could not generate a reply.' });
    } catch (err) {
      console.error(err);
      setError('Unable to connect with the assistant. Please try again later.');
      appendMessage({ role: 'assistant', content: 'Sorry, I cannot answer right now. Please try again in a moment.' });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-[340px] max-w-full flex flex-col rounded-3xl border border-emerald-300/50 bg-white shadow-2xl dark:bg-gray-900 dark:border-emerald-800 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-emerald-900 text-white">
            <div>
              <p className="text-sm font-bold">ECEWS AI Assistant</p>
              <p className="text-xs text-emerald-200">Ask anything about the app, workflows, or inventory.</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/10">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-[280px] max-h-[420px] overflow-y-auto bg-gray-50 dark:bg-gray-950 px-4 py-3 space-y-3">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`rounded-2xl p-3 text-sm leading-6 ${
                  msg.role === 'assistant'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    : 'self-end bg-emerald-100/90 dark:bg-emerald-900/70 text-emerald-950 dark:text-emerald-100'
                }`}
              >
                <div className="font-semibold text-[10px] uppercase tracking-[0.18em] mb-1 text-gray-500 dark:text-gray-400">
                  {msg.role === 'assistant' ? 'Assistant' : 'You'}
                </div>
                <div>{msg.content}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="border-t border-emerald-200/70 dark:border-emerald-800 px-3 py-3 bg-white dark:bg-gray-900">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full min-h-[70px] resize-none rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 p-3"
              placeholder="Ask how to use the app, find a page, or manage stock..."
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">{error || (loading ? 'Thinking...' : 'Press Enter or Send')}</span>
              <button onClick={handleSend} disabled={loading} className="btn btn-primary btn-sm">
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-emerald-700/30 hover:bg-emerald-700 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        AI Help
      </button>
    </div>
  );
}
