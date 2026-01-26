
export interface Medication {
  id: string;
  name: string;          // 中文商品名
  englishName?: string;  // 英文商品名
  scientificName?: string; // 學名
  specification?: string;  // 規格 (如: 500mg)
  location: string;      // 儲位
  description?: string;
  category?: string;
}

export enum AppTab {
  SEARCH = 'search',
  MANAGEMENT = 'management'
}