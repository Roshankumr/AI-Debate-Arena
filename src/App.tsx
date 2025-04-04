import React, { useState, useEffect, useRef } from 'react';
import { Brain, Timer, Send, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai'; // Import the GoogleGenAI SDK
import type { DebateMessage, DebateState } from './types';
import axios from 'axios';

// Initialize GoogleGenAI with your API Key
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY; // Ensure you're using the correct environment variable

export default function App() {
  const [state, setState] = useState<DebateState>({
    topic: '',
    duration: 2,
    messages: [],
    isDebating: false,
    winner: null,
    geminiPoints: 0,
    qroqPoints: 0,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  // Fetch Gemini's response using GoogleGenAI
  const getGeminiChatCompletion = async (input: string) => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash', // Use the Gemini model
        contents: input, // Send the user's input or previous AI response
      });

      return response.text || 'No response from Gemini'; // Extract and return Gemini's response
    } catch (error) {
      console.error('Gemini API Error:', error);
      return 'Error fetching response from Gemini.';
    }
  };

  // Fetch Qroq's response (Assuming Qroq is a different AI model you integrate similarly)
 // Fetch Qroq's response using axios
 // Fetch Groq's response using axios
 const getGroqChatCompletion = async (topic: string) => {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile", // Groq's optimized model
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant specializing in cybersecurity, online safety, and digital threats. You must answer as a human expert would, without referencing other agents or systems. Ensure the information is simple, actionable, and focused on user understanding. Respond in a clear, bullet-point format, always providing real-world advice."
          },
          {
            role: "user",
            content: topic,
          },
        ],
        max_completion_tokens: 200,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false,
        n: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data?.choices[0]?.message?.content || 'No response from Groq';
  } catch (error) {
    console.error('Groq API Error:', error);
    return 'Error fetching response from Groq.';
  }
};

  // Score calculation for each AI
  const calculatePoints = (response: string) => {
    let points = 0;

    if (response.length > 100) points += 5; // Bonus for longer responses
    if (response.includes('helpful') || response.includes('actionable')) points += 3;
    if (response.includes('cybersecurity') || response.includes('online safety')) points += 2;

    return points;
  };

  const startDebate = async () => {
    if (!state.topic || state.isDebating) return;

    setState(prev => ({ ...prev, isDebating: true, messages: [], winner: null, geminiPoints: 0, qroqPoints: 0 }));

    try {
      // Step 1: Send the topic to Gemini
      let geminiResponse = await getGeminiChatCompletion(state.topic);
      const geminiPoints = calculatePoints(geminiResponse);

      const newMessages: DebateMessage[] = [
        {
          agent: 'gemini',
          message: geminiResponse,
          type: 'ai',
          timestamp: new Date().toISOString(),
        },
      ];

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, ...newMessages],
        geminiPoints: prev.geminiPoints + geminiPoints,
      }));

      // Step 2: Qroq responds based on Gemini's output
      setTimeout(async () => {
        let qroqResponse = await getGroqChatCompletion(geminiResponse);
        const qroqPoints = calculatePoints(qroqResponse);

        newMessages.push({
          agent: 'qroq',
          message: qroqResponse,
          type: 'ai',
          timestamp: new Date().toISOString(),
        });

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, ...newMessages],
          qroqPoints: prev.qroqPoints + qroqPoints,
        }));

        // Step 3: Gemini responds based on Qroq's output
        setTimeout(async () => {
          let finalGeminiResponse = await getGeminiChatCompletion(qroqResponse);
          const finalGeminiPoints = calculatePoints(finalGeminiResponse);

          // Add the final Gemini response to messages
          newMessages.push({
            agent: 'gemini',
            message: finalGeminiResponse,
            type: 'ai',
            timestamp: new Date().toISOString(),
          });

          setState(prev => ({
            ...prev,
            messages: [...prev.messages, ...newMessages],
            geminiPoints: prev.geminiPoints + finalGeminiPoints,
            isDebating: false,
            winner: calculateWinner(prev.geminiPoints, prev.qroqPoints),
          }));
        }, 3000); // Delay before Gemini responds again (e.g., 3 seconds)

      }, 3000); // Delay before Qroq responds (e.g., 3 seconds)

    } catch (error) {
      console.error('Debate error:', error);
      setState(prev => ({ ...prev, isDebating: false }));
    }
  };

  const calculateWinner = (geminiPoints: number, qroqPoints: number) => {
    if (geminiPoints > qroqPoints) return 'gemini';
    if (qroqPoints > geminiPoints) return 'qroq';
    return 'tie'; // In case of a tie
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startDebate();
  };

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-[#111827]/50 backdrop-blur-sm border-b border-gray-800 py-4 px-6 fixed w-full top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              AI Debate Arena
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <Timer className="w-4 h-4 text-gray-400" />
            <select
              value={state.duration}
              onChange={(e) => setState(prev => ({ ...prev, duration: Number(e.target.value) }))}
              className="bg-[#1C2333] border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={state.isDebating}
            >
              {[1, 2, 3, 5, 10].map(n => (
                <option key={n} value={n}>{n} min</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-24 pb-24">
        <div className="h-full rounded-lg overflow-hidden bg-[#1C2333] border border-gray-800 shadow-xl">
          {/* Messages Container */}
          <div className="h-[calc(100vh-16rem)] overflow-y-auto p-6 space-y-4">
            {state.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Bot className="w-16 h-16 mb-4 animate-pulse" />
                <p className="text-lg">Enter a topic to start the debate</p>
              </div>
            )}
            {state.messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.agent === 'gemini' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${msg.agent === 'gemini'
                    ? 'bg-blue-500/20 border border-blue-500/30'
                    : 'bg-purple-500/20 border border-purple-500/30'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <Bot className="w-5 h-5 mr-2" />
                    <span className="font-medium">
                      {msg.agent === 'gemini' ? 'Gemini' : 'Qroq'}
                    </span>
                  </div>
                  <ReactMarkdown className="prose prose-invert max-w-none prose-p:leading-relaxed prose-p:my-1">
                    {msg.message}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-800 bg-[#111827] p-4"
          >
            <div className="max-w-4xl mx-auto flex gap-3">
              <input
                type="text"
                value={state.topic}
                onChange={(e) => setState(prev => ({ ...prev, topic: e.target.value }))}
                placeholder="Enter a topic for debate..."
                className="flex-1 bg-[#1C2333] border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={state.isDebating}
              />
              <button
                type="submit"
                disabled={!state.topic || state.isDebating}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {state.isDebating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Debating...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Start
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Winner Banner */}
        {state.winner && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Bot className="w-6 h-6 text-yellow-400" />
              <span className="font-medium">
                {state.winner === 'gemini' ? 'Gemini' : 'Qroq'} won the debate!
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
