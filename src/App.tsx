import React, { useState, useEffect, useRef } from "react";
import { Brain, Timer, Send, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

interface DebateMessage {
  agent: "gemini" | "groq";
  message: string;
  type: "ai" | "user";
  timestamp: string;
}

interface DebateState {
  topic: string;
  duration: number;
  messages: DebateMessage[];
  isDebating: boolean;
  winner: "gemini" | "groq" | "tie" | null;
  geminiPoints: number;
  groqPoints: number;
  timeLeft: number;
  debateRound: number;
}

export default function App() {
  const [state, setState] = useState<DebateState>({
    topic: "",
    duration: 2,
    messages: [],
    isDebating: false,
    winner: null,
    geminiPoints: 0,
    groqPoints: 0,
    timeLeft: 2 * 60,
    debateRound: 0,
  });

  const isDebatingRef = useRef(state.isDebating);
  const timeLeftRef = useRef(state.timeLeft);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isDebatingRef.current = state.isDebating;
    timeLeftRef.current = state.timeLeft;
  }, [state.isDebating, state.timeLeft]);

  useEffect(() => {
    if (state.isDebating && state.timeLeft > 0) {
      const interval = setInterval(() => {
        setState((prev) => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
      return () => clearInterval(interval);
    } else if (state.timeLeft === 0) {
      setState((prev) => ({
        ...prev,
        isDebating: false,
        winner: calculateWinner(prev.geminiPoints, prev.groqPoints),
      }));
    }
  }, [state.isDebating, state.timeLeft]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  const getGeminiChatCompletion = async (messages: DebateMessage[]) => {
    try {
      let prompt = `You are Gemini, an AI engaged in a debate about: "${state.topic}". Provide well-reasoned arguments with evidence. Be concise, clear, and logical.`;

      if (messages.length > 0) {
        prompt += "\n\nHere's the conversation so far:\n";
        messages.forEach(msg => {
          prompt += `${msg.agent === "gemini" ? "You (Gemini)" : "Opponent (Groq)"}: ${msg.message}\n\n`;
        });
        prompt += "Now provide your next argument or counter-argument:";
      } else {
        prompt += " Please start the debate with your opening argument.";
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      return response.text || "No response from Gemini";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "Error fetching response from Gemini.";
    }
  };

  const getGroqChatCompletion = async (messages: DebateMessage[]) => {
    try {
      const formattedMessages = [
        {
          role: "system",
          content: `You are Groq, an AI designed to engage in structured, data-driven debates. Your goal is to provide well-reasoned, fact-based arguments about "${state.topic}". Always back up your claims with real-world data, research, or examples. Engage respectfully and challenge the opponent's logic when appropriate, but maintain a professional tone throughout the debate.`,
        },
        ...messages.map(msg => ({
          role: msg.agent === "groq" ? "assistant" : "user",
          content: msg.message,
        })),
        {
          role: "user",
          content: messages.length === 0
            ? `Start a debate on the topic: "${state.topic}". Present your opening arguments.`
            : "Provide your next argument or counter-argument in this debate."
        }
      ];

      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.3-70b-versatile",
          messages: formattedMessages,
          max_completion_tokens: 1000,
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

      return response.data?.choices[0]?.message?.content || "No response from Groq";
    } catch (error) {
      console.error("Groq API Error:", error);
      return "Error fetching response from Groq.";
    }
  };

  const calculatePoints = (message: string, allMessages: DebateMessage[], isGroq: boolean) => {
    let points = 0;
    const agent = isGroq ? "groq" : "gemini";

    if (message.length > 100) points += 3;
    if (message.length > 200) points += 2;

    if (message.match(/research shows|studies indicate|according to|evidence suggests|for example|such as/gi)) {
      points += 5;
    }

    const opponentMessages = allMessages.filter(msg => msg.agent !== agent);
    if (opponentMessages.length > 0) {
      const lastOpponentMessage = opponentMessages[opponentMessages.length - 1].message.toLowerCase();
      const keywords = lastOpponentMessage.match(/\b\w{5,}\b/g) || [];
      const addressedPoints = keywords.filter(word => message.toLowerCase().includes(word)).length;
      points += Math.min(addressedPoints, 5);
    }

    if (message.match(/first|second|third|finally|in conclusion|therefore|thus|as a result/gi)) {
      points += 3;
    }

    const topicKeywords = state.topic.toLowerCase().split(" ");
    const relevancePoints = topicKeywords.filter(word => word.length > 3 && message.toLowerCase().includes(word)).length;
    points += relevancePoints;

    return points;
  };

  const calculateWinner = (geminiPoints: number, groqPoints: number) => {
    if (geminiPoints > groqPoints) return "gemini";
    if (groqPoints > geminiPoints) return "groq";
    return "tie";
  };

  const runDebateRound = async () => {
    try {
      let currentMessages = [...state.messages];
  
      // Step 1: Gemini replies
      const geminiResponse = await getGeminiChatCompletion(currentMessages);
      const geminiPoints = calculatePoints(geminiResponse, currentMessages, false);
  
      const geminiMessage: DebateMessage = {
        agent: "gemini",
        message: geminiResponse,
        type: "ai",
        timestamp: new Date().toISOString(),
      };
  
      currentMessages = [...currentMessages, geminiMessage];
      setState(prev => ({
        ...prev,
        messages:[...prev.messages, geminiMessage],
        geminiPoints: prev.geminiPoints + geminiPoints,
        debateRound: prev.debateRound + 1,
      }));
  
      // Step 2: wait a bit before Groq's turn
      await new Promise(resolve => setTimeout(resolve, 3000));
  
      // Step 3: Groq replies
      const groqResponse = await getGroqChatCompletion(currentMessages);
      const groqPoints = calculatePoints(groqResponse, currentMessages, true);
  
      const groqMessage: DebateMessage = {
        agent: "groq",
        message: groqResponse,
        type: "ai",
        timestamp: new Date().toISOString(),
      };
  
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, groqMessage],
        groqPoints: prev.groqPoints + groqPoints,
        debateRound: prev.debateRound + 1,
      }));
    } catch (error) {
      console.error("Debate round error:", error);
    }
  };
  

  const startDebate = async () => {
    if (!state.topic || state.isDebating) return;

    setState(prev => ({
      ...prev,
      isDebating: true,
      messages: [],
      winner: null,
      geminiPoints: 0,
      groqPoints: 0,
      timeLeft: state.duration * 60,
      debateRound: 0,
    }));

    setTimeout(() => {
      debateLoop();
    }, 1000);
  };

  const debateLoop = async () => {
    if (!isDebatingRef.current || timeLeftRef.current <= 0) return;

    await runDebateRound();

    setTimeout(() => {
      if (isDebatingRef.current && timeLeftRef.current > 0) {
        debateLoop();
      }
    }, 10000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startDebate();
  };

  useEffect(() => {
    if (!state.isDebating) {
      setState(prev => ({
        ...prev,
        timeLeft: state.duration * 60,
      }));
    }
  }, [state.duration, state.isDebating]);

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
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Gemini: {state.geminiPoints}</span>
              <span className="text-sm text-gray-400">|</span>
              <span className="text-sm font-medium">Groq: {state.groqPoints}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Timer className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">
                {Math.floor(state.timeLeft / 60)}:{String(state.timeLeft % 60).padStart(2, '0')}
              </span>
              <select
                value={state.duration}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    duration: Number(e.target.value),
                  }))
                }
                className="bg-[#1C2333] border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={state.isDebating}
              >
                {[1, 2, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </select>
            </div>
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
              <div
                key={i}
                className={`flex ${msg.agent === "gemini" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${msg.agent === "gemini"
                    ? "bg-blue-500/20 border border-blue-500/30"
                    : "bg-purple-500/20 border border-purple-500/30"
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <Bot className="w-5 h-5 mr-2" />
                    <span className="font-medium">
                      {msg.agent === "gemini" ? "Gemini" : "Groq"}
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
          <form onSubmit={handleSubmit} className="border-t border-gray-800 bg-[#111827] p-4">
            <div className="max-w-4xl mx-auto flex gap-3">
              <input
                type="text"
                value={state.topic}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, topic: e.target.value }))
                }
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
                {state.winner === "tie" ? "It's a tie!" : `${state.winner === "gemini" ? "Gemini" : "Groq"} won the debate!`} 
                {" "}({state.geminiPoints} - {state.groqPoints})
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
