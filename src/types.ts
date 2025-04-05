export interface DebateMessage {
  agent: 'gemini' | 'qroq' | 'groq'; // Include 'groq' here
  message: string;
  type: 'user' | 'ai' | 'winner'; // Adjust as per your requirement
  timestamp: string; // If you want it as ISO string, or use `number` if you prefer a Unix timestamp
}

export interface DebateState {
  topic: string;
  duration: number;
  messages: DebateMessage[];
  isDebating: boolean;
  winner: 'gemini' | 'qroq' | 'tie' | null;
  geminiPoints: number;
  qroqPoints: number;
  timeLeft: number;  // Add timeLeft if it's not already in your state
  isLoading: boolean; // Add the isLoading property
}
