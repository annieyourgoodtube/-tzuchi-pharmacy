import { GoogleGenAI } from "@google/genai";
import { Medication } from "./types";

export const identifyMedicationFromImage = async (
  base64Image: string,
  inventory: Medication[]
): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
    // 提供少量範例讓 AI 知道我們預期的藥名格式
    const inventorySample = inventory
      .slice(0, 50)
      .map(m => m.name)
      .join(', ');

    const prompt = `
      角色：你是一位專業的藥師助手。
      任務：辨識圖片中藥品包裝上的「主要商品名稱」(Trade Name) 或「顯著的關鍵字」。
      
      規則：
      1. 請找出最顯眼的藥品名稱（通常是英文或中文）。
      2. 只要回傳「一個」最精確的搜尋關鍵字即可。
      3. 優先順序：中文商品名 > 英文商品名 > 學名。
      4. 排除雜訊：不要回傳劑量（如 500mg, 10ml）、不要回傳製造日期、不要回傳廠商名稱（如 永信, 輝瑞）、不要回傳 "F.C." 或 "Tab" 等劑型縮寫。
      5. 如果圖片模糊或無法辨識藥品，請回傳 "NONE"。
      6. 輸出的文字不需要任何標點符號。

      參考庫存中的藥名風格：${inventorySample}
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
        temperature: 0.1, // 降低隨機性，追求精確
      }
    });

    const result = response.text?.trim() || "NONE";
    // 如果回傳包含 NONE 或是空字串
    if (result.includes("NONE") || !result) {
      return null;
    }

    // 簡單清理換行符號，確保是單行文字
    return result.replace(/\n/g, " ");
  } catch (error) {
    console.error("AI辨識錯誤:", error);
    return null;
  }
};