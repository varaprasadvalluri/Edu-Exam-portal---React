import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export class AIImporterService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
       console.error("GEMINI_API_KEY is not defined");
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  async extractQuestionsFromImage(base64Data: string, mimeType: string): Promise<Question[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                text: `Extract all questions from this image/document. 
                For each question, identify:
                - The question text.
                - All available options.
                - The correct answer index (0-based).
                - A default mark value (e.g., 4).
                
                Return exactly as a JSON array of objects fitting the Question type schema.`
              },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                options: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING } 
                },
                correctAnswerIndex: { type: Type.INTEGER },
                marks: { type: Type.INTEGER }
              },
              required: ["text", "options", "correctAnswerIndex", "marks"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) return [];
      
      return JSON.parse(text) as Question[];
    } catch (error) {
      console.error("AI Import error:", error);
      throw error;
    }
  }
}

export const aiImporter = new AIImporterService();
