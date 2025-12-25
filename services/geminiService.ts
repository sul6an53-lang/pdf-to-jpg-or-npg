
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeDocument(textSnippet: string): Promise<{ summary: string; suggestedTags: string[] }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `قم بتحليل النص التالي المستخرج من ملف PDF وقدم ملخصاً قصيراً باللغة العربية (جملة واحدة) و3 وسوم مناسبة للمحتوى.\n\nالنص:\n${textSnippet}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            suggestedTags: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["summary", "suggestedTags"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return { summary: "لم يتمكن الذكاء الاصطناعي من تحليل النص حالياً.", suggestedTags: [] };
  }
}
