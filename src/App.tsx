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
  stance: {
    gemini: "favor" | "oppose" | null;
    groq: "favor" | "oppose" | null;
  };
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
    stance: { gemini: null, groq: null },
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

  const assignStances = (): {
    gemini: "favor" | "oppose";
    groq: "favor" | "oppose";
  } => {
    const favorFirst = Math.random() > 0.5;
    return {
      gemini: favorFirst ? "favor" : "oppose",
      groq: favorFirst ? "oppose" : "favor",
    };
  };

  const getGeminiChatCompletion = async (messages: DebateMessage[]) => {
    try {
      let prompt = `You are Gemini, an AI engaged in a debate about: "${state.topic}".\nYour stance is to ${state.stance.gemini} the topic.\nRespond with concise, human-understandable arguments (no more than 4 sentences). Provide strong, well-reasoned points and clear logic.`;

      if (messages.length > 0) {
        prompt += "\n\nHere's the conversation so far:\n";
        messages.forEach((msg) => {
          prompt += `${
            msg.agent === "gemini" ? "You (Gemini)" : "Opponent (Groq)"
          }: ${msg.message}\n\n`;
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
          content: `You are Groq, an AI debating the topic: "${state.topic}". You are arguing to ${state.stance.groq} the topic. Stick to your side throughout the debate. Limit your answer to 4 sentences with clear, data-driven, or example-based logic.`,
        },
        ...messages.map((msg) => ({
          role: msg.agent === "groq" ? "assistant" : "user",
          content: msg.message,
        })),
        {
          role: "user",
          content:
            messages.length === 0
              ? `Start a debate on the topic: "${state.topic}". Present your opening arguments.`
              : "Provide your next argument or counter-argument in this debate.",
        },
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

      return (
        response.data?.choices[0]?.message?.content || "No response from Groq"
      );
    } catch (error) {
      console.error("Groq API Error:", error);
      return "Error fetching response from Groq.";
    }
  };

  // Criterion 1: Clarity of Argument
  const scoreClarity = (message: string): number => {
    const clarityIndicators =
      /first|second|third|finally|in conclusion|therefore|thus|as a result|however|on the other hand|although/gi;
    const count = (message.match(clarityIndicators) || []).length;
    return Math.min(count * 2, 10); // Score up to 10
  };

  // Criterion 2: Depth of Reasoning
  const scoreDepth = (message: string): number => {
    const depthIndicators =
      /autonomy|moral|philosophy|belief|value|nuance|complex|context|principle|assumption|framework|diversity/gi;
    const count = (message.match(depthIndicators) || []).length;
    return Math.min(count * 2, 10); // Score up to 10
  };

  // Criterion 3: Use of Evidence & Examples
  const scoreEvidence = (message: string): number => {
    const evidenceIndicators =
      /research shows|studies indicate|according to|evidence suggests|data from|statistically|survey|report|study/gi;
    const exampleIndicators =
      /for example|such as|consider|case study|instance|take the case of/gi;
    const evidenceCount = (message.match(evidenceIndicators) || []).length;
    const exampleCount = (message.match(exampleIndicators) || []).length;
    return Math.min(evidenceCount * 3 + exampleCount * 2, 10); // Score up to 10
  };

  // Criterion 4: Relevance & Realism
  const scoreRelevance = (message: string, topic: string): number => {
    const topicKeywords = topic.toLowerCase().split(" ");
    const lowerMessage = message.toLowerCase();
    const relevanceCount = topicKeywords.filter(
      (word) => word.length > 3 && lowerMessage.includes(word)
    ).length;
    return Math.min(relevanceCount * 2, 10); // Score up to 10
  };

  // Criterion 5: Persuasiveness / Impact
  const scorePersuasiveness = (
    message: string,
    allMessages: DebateMessage[],
    isGroq: boolean
  ): number => {
    const agent = isGroq ? "groq" : "gemini";
    const lowerMessage = message.toLowerCase();
    const opponentMessages = allMessages.filter((msg) => msg.agent !== agent);

    if (opponentMessages.length === 0) return 5;

    const lastOpponentMessage =
      opponentMessages[opponentMessages.length - 1].message.toLowerCase();
    const rebuttalKeywords = lastOpponentMessage.match(/\b\w{5,}\b/g) || [];
    const rebuttals = rebuttalKeywords.filter((word) =>
      lowerMessage.includes(word)
    ).length;

    if (rebuttals >= 5) return 10;
    if (rebuttals >= 3) return 7;
    if (rebuttals >= 1) return 5;
    return 3;
  };

  // Final total scorer (max 50 points)
  const calculatePoints = (
    message: string,
    allMessages: DebateMessage[],
    isGroq: boolean,
    topic: string
  ): number => {
    const clarity = scoreClarity(message);
    const depth = scoreDepth(message);
    const evidence = scoreEvidence(message);
    const relevance = scoreRelevance(message, topic);
    const persuasiveness = scorePersuasiveness(message, allMessages, isGroq);

    const total = clarity + depth + evidence + relevance + persuasiveness;
    return Math.min(total, 50);
  };

  // Winner calculator
  const calculateWinner = (
    geminiPoints: number,
    groqPoints: number
  ): "gemini" | "groq" | "tie" => {
    if (geminiPoints > groqPoints) return "gemini";
    if (groqPoints > geminiPoints) return "groq";
    return "tie";
  };

  const runDebateRound = async () => {
    try {
      let currentMessages = [...state.messages];
      const geminiResponse = await getGeminiChatCompletion(currentMessages);
      const geminiPoints = calculatePoints(
        geminiResponse,
        currentMessages,
        false,
        state.topic
      );

      const geminiMessage: DebateMessage = {
        agent: "gemini",
        message: geminiResponse,
        type: "ai",
        timestamp: new Date().toISOString(),
      };

      currentMessages = [...currentMessages, geminiMessage];
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, geminiMessage],
        geminiPoints: prev.geminiPoints + geminiPoints,
        debateRound: prev.debateRound + 1,
      }));

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const groqResponse = await getGroqChatCompletion(currentMessages);
      const groqPoints = calculatePoints(
        groqResponse,
        currentMessages,
        true,
        state.topic
      );

      const groqMessage: DebateMessage = {
        agent: "groq",
        message: groqResponse,
        type: "ai",
        timestamp: new Date().toISOString(),
      };

      setState((prev) => ({
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
    const stanceAssignment = assignStances();

    setState((prev) => ({
      ...prev,
      isDebating: true,
      messages: [],
      winner: null,
      geminiPoints: 0,
      groqPoints: 0,
      timeLeft: state.duration * 60,
      debateRound: 0,
      stance: stanceAssignment,
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
      setState((prev) => ({
        ...prev,
        timeLeft: state.duration * 60,
      }));
    }
  }, [state.duration, state.isDebating]);

  // Full React return section for AI Debate Arena with stance reveal, debate log, and winner banner

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-gray-100 flex flex-col">
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
              <span className="text-sm font-medium">
                Gemini: {state.geminiPoints}
              </span>
              <span className="text-sm text-gray-400">|</span>
              <span className="text-sm font-medium">
                Groq: {state.groqPoints}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Timer className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">
                {Math.floor(state.timeLeft / 60)}:
                {String(state.timeLeft % 60).padStart(2, "0")}
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

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-24 pb-24">
        {state.isDebating && state.debateRound === 0 && state.stance.gemini && (
          <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-400/20 to-purple-400/20 p-4 border border-gray-700 rounded-xl shadow-xl backdrop-blur-md animate-fade-in-down z-10">
            <p className="text-center text-lg font-semibold">
              🤖 Gemini will argue in{" "}
              <span className="text-blue-400">
                {state.stance.gemini?.toUpperCase() ?? ""}
              </span>{" "}
              of the topic.
              <br />⚡ Groq will argue in{" "}
              <span className="text-purple-400">
                {state.stance.groq?.toUpperCase() ?? ""}
              </span>{" "}
              of the topic.
            </p>
          </div>
        )}

        <div className="h-full rounded-lg overflow-hidden bg-[#1C2333] border border-gray-800 shadow-xl">
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
                className={`flex ${
                  msg.agent === "gemini" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    msg.agent === "gemini"
                      ? "bg-blue-500/20 border border-blue-500/30"
                      : "bg-purple-500/20 border border-purple-500/30"
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <Bot className="w-5 h-5 mr-2" />
                    <span className="font-medium">
                      {msg.agent === "gemini" ? "Gemini" : "Groq"} (
                      {state.stance[msg.agent]?.toUpperCase() ?? ""})
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

          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-800 bg-[#111827] p-4"
          >
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

        {state.winner && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Bot className="w-6 h-6 text-yellow-400" />
              <span className="font-medium">
                {state.winner === "tie"
                  ? "It's a tie!"
                  : `${
                      state.winner === "gemini" ? "Gemini" : "Groq"
                    } won the debate!`}
                ({state.geminiPoints} - {state.groqPoints})
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
