import { createClient } from 'npm:@google/generative-ai';
import { encode } from 'npm:gpt-tokenizer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface Message {
  agent: 'gemini' | 'qroq';
  message: string;
  timestamp: number;
}

const SYSTEM_PROMPT = `You are participating in a formal debate. You must:
1. Stay focused on the topic
2. Use logical arguments and evidence
3. Be respectful but assertive
4. Keep responses concise (max 2-3 paragraphs)
5. Acknowledge and counter opponent's points`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, duration } = await req.json();
    
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const genAI = new createClient({ apiKey: Deno.env.get('GEMINI_API_KEY') });
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const debate = async () => {
      const startTime = Date.now();
      const endTime = startTime + (duration * 60 * 1000);
      let lastAgent: 'gemini' | 'qroq' = Math.random() < 0.5 ? 'gemini' : 'qroq';
      let context = `Topic: ${topic}\n\nPrevious messages:\n`;

      while (Date.now() < endTime) {
        const currentAgent = lastAgent === 'gemini' ? 'qroq' : 'gemini';
        
        const prompt = `${SYSTEM_PROMPT}\n\nYou are ${currentAgent.toUpperCase()}.\n\n${context}\n\nProvide your next argument:`;
        
        const result = await model.generateContent(prompt);
        const message = result.response.text();
        
        const messageObj: Message = {
          agent: currentAgent,
          message,
          timestamp: Date.now(),
        };

        await writer.write(encoder.encode(JSON.stringify(messageObj) + '\n'));
        
        context += `${currentAgent.toUpperCase()}: ${message}\n`;
        lastAgent = currentAgent;
        
        // Add some delay between messages
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Determine winner based on argument quality
      const analysis = await model.generateContent(`
        Based on the following debate:\n${context}\n
        Determine the winner between GEMINI and QROQ. Consider:
        1. Argument strength
        2. Logical consistency
        3. Evidence usage
        4. Rebuttal effectiveness
        
        Respond with ONLY "GEMINI" or "QROQ".
      `);

      const winner = analysis.response.text().trim().toLowerCase();
      
      await writer.write(encoder.encode(JSON.stringify({
        type: 'winner',
        agent: winner === 'gemini' ? 'gemini' : 'qroq',
        timestamp: Date.now(),
      }) + '\n'));
      
      await writer.close();
    };

    debate().catch(async (error) => {
      console.error('Debate error:', error);
      await writer.abort(error);
    });

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});