
import { GoogleGenAI } from "@google/genai";
import { Medication } from "../types";

export const identifyMedicationFromImage = async (
  base64Image: string,
  inventory: Medication[]
): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const inventorySummary = inventory
      .slice(0, 150)
      .map(m => m.name)
      .join(', ');

    const prompt = `
      你是藥學部的辨識小助手。
      任務：從照片中的藥盒或標籤中提取藥品名稱關鍵字。
      
      規則：
      1. 優先回傳中文商品名，若無則回傳英文名。
      2. 排除所有規格（如 500mg, 10ml, 1#）。
      3. 排除廠商名（如 輝瑞, 永信）。
      4. 只回傳「純文字藥名」，不要有任何標點或說明。
      5. 若完全無法辨識請回傳 "NONE"。
      
      醫院參考清單：${inventorySummary}
    `;

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image.split(',')[1],
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        temperature: 0.1,
        topK: 1,
        topP: 1
      }
    });

    const result = response.text?.trim() || "NONE";
    return result === "NONE" ? null : result;
  } catch (error) {
    console.error("AI辨識錯誤:", error);
    return null;
  }
};
