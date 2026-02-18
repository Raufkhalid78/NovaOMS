
import { GoogleGenAI } from "@google/genai";
import { Ticket, TicketStatus } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateQueueInsight = async (
  tickets: Ticket[],
  activeCounters: number
): Promise<{ message: string; severity: 'info' | 'warning' | 'alert' } | null> => {
  const ai = getClient();
  if (!ai) return null;

  // Filter for relevant data to send to AI
  const waitingCount = tickets.filter(t => t.status === TicketStatus.WAITING).length;
  const servingCount = tickets.filter(t => t.status === TicketStatus.SERVING).length;
  const completedRecent = tickets.filter(t => t.status === TicketStatus.COMPLETED && Date.now() - (t.completedAt || 0) < 3600000).length; // Last hour
  
  // Calculate average wait time for currently serving (mock calculation for prompt context)
  const servingTickets = tickets.filter(t => t.status === TicketStatus.SERVING);
  let avgWaitMins = 0;
  if (servingTickets.length > 0) {
    const totalWait = servingTickets.reduce((acc, t) => acc + ((t.servedAt || Date.now()) - t.joinedAt), 0);
    avgWaitMins = Math.round((totalWait / servingTickets.length) / 60000);
  }

  const prompt = `
    Context: You are an AI assistant for a Queue Management System.
    Data:
    - Currently Waiting: ${waitingCount} people.
    - Currently Serving: ${servingCount} people.
    - Active Counters: ${activeCounters}.
    - Completed in last hour: ${completedRecent}.
    - Average Wait Time (approx): ${avgWaitMins} minutes.

    Task: Provide a concise, 1-sentence operational insight or recommendation for the staff.
    Examples: "Queue is moving effectively; wait times are low." or "High influx of Payment tickets; consider opening Counter 4." or "Wait times are escalating; please speed up transactions."
    
    Also determine severity: 'info', 'warning', or 'alert'.
    
    Response Format (JSON):
    {
      "message": "The insight message here.",
      "severity": "info"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error: any) {
    // Gracefully handle quota exhaustion or rate limits
    if (error?.status === 429 || error?.code === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      console.warn("Gemini API quota exceeded. Returning fallback insight.");
      return {
        message: "AI insights paused due to high traffic. Monitoring queue status...",
        severity: "info"
      };
    }
    console.error("Gemini Insight Error:", error);
    return null;
  }
};

export const generateWelcomeMessage = async (ticket: Ticket): Promise<string> => {
  const ai = getClient();
  if (!ai) return "Welcome! Please wait for your number.";

  const prompt = `
    Generate a short, friendly, and reassuring 1-sentence welcome message for a digital ticket screen.
    The customer is here for: ${ticket.serviceName}.
    Ticket Number: ${ticket.number}.
    Don't use quotes.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Welcome! Please wait for your number.";
  } catch (error) {
    // Fallback silently for welcome messages to avoid disrupting user flow
    return "Welcome! Please wait for your number.";
  }
};
