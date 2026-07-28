import type { SpeechGenerator } from "../interfaces/speech-generator.js";
import type { Intent } from "../types/intent.js";
import type { Expression } from "../types/expression.js";
import type { ExpressionGuidelines } from "@ai-agent/personality";

const GREETINGS: Record<string, string[]> = {
  casual: ["Hey!", "Yo!", "What's up?"],
  neutral: ["Hello.", "Hi there.", "Ready."],
  formal: ["Good day.", "Hello.", "How can I assist?"],
};

const FAREWELLS: Record<string, string[]> = {
  casual: ["See ya!", "Later!", "Catch you later."],
  neutral: ["Goodbye.", "Until next time.", "Done for now."],
  formal: ["Farewell.", "Goodbye.", "Until we meet again."],
};

export class DefaultSpeechGenerator implements SpeechGenerator {
  generate(intent: Intent, guidelines: ExpressionGuidelines, personalityId: string): Expression {
    if (!this.needsLlm(intent, guidelines)) {
      return this.generateSimple(intent, guidelines, personalityId);
    }
    return this.generateSimple(intent, guidelines, personalityId);
  }

  generateSimple(intent: Intent, guidelines: ExpressionGuidelines, personalityId: string): Expression {
    let text: string;

    switch (intent.type) {
      case "greeting":
        text = this.pickRandom(GREETINGS[guidelines.formalityLevel] ?? GREETINGS["neutral"]!);
        break;
      case "farewell":
        text = this.pickRandom(FAREWELLS[guidelines.formalityLevel] ?? FAREWELLS["neutral"]!);
        break;
      case "confirmation":
        text = guidelines.formalityLevel === "casual" ? "Got it." : "Understood.";
        break;
      case "celebration":
        text = guidelines.useHumour
          ? `Nice work — ${intent.content.toLowerCase()}`
          : `Completed: ${intent.content}`;
        break;
      case "concern":
        text = guidelines.warmthLevel === "warm"
          ? `I noticed ${intent.content.toLowerCase()}. Want me to look into it?`
          : `Observation: ${intent.content}`;
        break;
      case "suggestion":
        text = guidelines.hedgingLevel === "none"
          ? `I recommend: ${intent.content}`
          : guidelines.hedgingLevel === "some"
            ? `You might want to: ${intent.content}`
            : `If it helps, perhaps: ${intent.content}`;
        break;
      case "question":
        text = intent.content;
        break;
      case "explanation":
        text = intent.content;
        break;
      case "encouragement":
        text = guidelines.warmthLevel === "warm"
          ? `You're doing great — ${intent.content}`
          : `Progress noted: ${intent.content}`;
        break;
      case "reminder":
        text = `Reminder: ${intent.content}`;
        break;
      case "observation":
        text = intent.content;
        break;
      case "reflection":
        text = intent.content;
        break;
      default:
        text = intent.content;
    }

    if (guidelines.preferredLength === "short" && text.length > 100) {
      text = text.slice(0, 97) + "...";
    }

    return {
      text,
      intent,
      personality: personalityId,
      tone: guidelines.tone,
      length: guidelines.preferredLength,
      timestamp: Date.now(),
    };
  }

  needsLlm(intent: Intent, guidelines: ExpressionGuidelines): boolean {
    if (intent.type === "reflection") return true;
    if (intent.type === "explanation" && guidelines.preferredLength === "long") return true;
    if (intent.confidence < 0.5) return true;
    return false;
  }

  private pickRandom(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)]!;
  }
}
