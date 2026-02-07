import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Medication } from './types';
import { INITIAL_MEDICATIONS } from './constants';
import { identifyMedicationFromImage } from './geminiService';
import { 
  Search, 
  MapPin, 
  ChevronRight, 
  Loader2,
  X,
  Database,
  Package,
  Camera,
  Aperture
} from 'lucide-react';

const App: React.FC = () => {
  const DEFAULT_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vReUQnXNOTsBtNzEUrODdvPKKeS3XYfhdN86nICurJbG7Cst-4SGfZujbHJgs4bvLwclmHIjtTyqpTw/pub?output=csv';

  const [medications, setMedications] = useState<Medication[]>(() => {
    const saved = localStorage.getItem('pharmacy_inventory');
    return saved ? JSON.parse(saved) : INITIAL_MEDICATIONS;
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sheetUrl] = useState(() => localStorage.getItem('pharmacy_sheet_url') || DEFAULT_URL);
  const [lastSynced, setLastSynced] = useState(() => localStorage.getItem('pharmacy_last_synced') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Camera State
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const headerColor = 'bg-[#004766]'; 

  const syncFromGoogleSheets = useCallback(async () => {
    setIsSyncing(true);
    
    try {
      let fetchUrl = sheetUrl.trim();
      if (!fetchUrl) throw new Error('網址不能為空');
      
      if (fetchUrl.includes('docs.google.com/spreadsheets')) {
        if (fetchUrl.includes('/edit')) {
           fetchUrl = fetchUrl.split('/edit')[0] + '/export?format=csv';
        } else if (fetchUrl.includes('/pubhtml')) {
           fetchUrl = fetchUrl.replace('/pubhtml', '/pub?output=csv');
        } else if (!fetchUrl.includes('output=csv') && !fetchUrl.includes('format=csv')) {
           fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + 'output=csv';
        }
      }

      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error('無法抓取資料');
      
      const csvData = await response.text();
      const cleanCsv = csvData.replace(/^\uFEFF/, '').trim();
      const lines = cleanCsv.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 1) return;
      
      const splitCSVLine = (line: string) => {
        const result = [];
        let inQuotes = false;
        let current = '';
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else current += char;
        }
        result.push(current.trim());
        return result.map(v => v.replace(/^"|"$/g, '').trim());
      };

      const headers = splitCSVLine(lines[0]);
      const lowerHeaders = headers.map(h => h.toLowerCase());
      
      const fieldMap = {
        location: ['儲位', '櫃', '位置', 'loc', 'place', '櫃號', '棚', '位'],
        name: ['中文', '名稱', '藥名', '品名', '商品名', 'name', 'drug', '商品名稱'],
        englishName: ['英文', 'eng', 'english', '英文名'],
        scientificName: ['學名', '成分', '成份', 'generic', 'scientific'],
        specification: ['規格', '劑量', '包裝', '容量', 'spec', 'strength'],
        packetMachine: ['藥包機', 'atc', '包藥機', 'machine']
      };

      const findIdx = (keys: string[], defaultIdx: number) => {
        const idx = lowerHeaders.findIndex(h => keys.some(k => h.toLowerCase().includes(k)));
        return idx !== -1 ? idx : defaultIdx;
      };

      const map = {
        locIdx: findIdx(fieldMap.location, 0),
        nameIdx: findIdx(fieldMap.name, 1),
        engIdx: findIdx(fieldMap.englishName, 2),
        sciIdx: findIdx(fieldMap.scientificName, 3),
        specIdx: findIdx(fieldMap.specification, 4),
        atcIdx: findIdx(fieldMap.packetMachine, -1)
      };

      const startRow = headers.some(h => ['位', '名', '藥'].some(k => h.includes(k))) ? 1 : 0;
      const dataLines = lines.slice(startRow);

      const newMeds = dataLines.map((line, index) => {
        const values = splitCSVLine(line);
        const isSmallPharmacy = values.some(v => v.includes('小藥庫'));
        
        return {
          id: `med-${index}-${Date.now()}`,
          name: values[map.nameIdx] || '',
          englishName: values[map.engIdx] || '',
          scientificName: values[map.sciIdx] || '',
          specification: values[map.specIdx] || '',
          location: values[map.locIdx] || '',
          packetMachineValue: (map.atcIdx !== -1 && values[map.atcIdx]) ? values[map.atcIdx] : undefined,
          description: '', 
          isSmallPharmacy
        };
      }).filter(m => m.name !== '' || m.location !== '');

      if (newMeds.length > 0) {
        setMedications(newMeds);
        const time = new Date().toLocaleString('zh-TW', { hour12: false });
        setLastSynced(time);
      }
    } catch (err) {
      console.error("同步失敗", err);
    } finally {
      setIsSyncing(false);
    }
  }, [sheetUrl]);

  useEffect(() => {
    syncFromGoogleSheets();
  }, [syncFromGoogleSheets]);

  useEffect(() => {
    localStorage.setItem('pharmacy_inventory', JSON.stringify(medications));
    localStorage.setItem('pharmacy_sheet_url', sheetUrl);
    localStorage.setItem('pharmacy_last_synced', lastSynced);
  }, [medications, sheetUrl, lastSynced]);

  // Camera Logic
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (err) {
      console.error("Camera error:", err);
      alert("無法啟動相機，請確認您已允許相機權限。");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const captureImage = useCallback(async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      
      stopCamera();
      setIsAnalyzing(true);
      setSearchTerm('');

      const result = await identifyMedicationFromImage(base64Image, medications);
      if (result) {
        setSearchTerm(result);
      } else {
        alert('無法辨識圖片中的文字，請重試或手動輸入。');
      }
      setIsAnalyzing(false);
    }
  }, [medications, cameraStream]);

  // Bind stream to video element
  useEffect(() => {
    if (showCamera && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showCamera, cameraStream]);

  const filteredMedications = medications.filter(m => {
    if (!searchTerm.trim()) return true;
    const kw = searchTerm.toLowerCase();
    return (
      m.name.toLowerCase().includes(kw) || 
      (m.englishName && m.englishName.toLowerCase().includes(kw)) ||
      (m.scientificName && m.scientificName.toLowerCase().includes(kw)) ||
      (m.specification && m.specification.toLowerCase().includes(kw)) ||
      m.location.toLowerCase().includes(kw)
    );
  });

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-white text-slate-900 overflow-hidden relative font-sans border-x border-slate-100">
      <header className={`${headerColor} text-white p-7 pt-14 shadow-lg shrink-0 z-10 rounded-b-[45px]`}>
        <div className="flex flex-col">
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 mb-1">
            <Database size={32} className="text-cyan-400" />
            西藥儲位快速查詢
          </h1>
          <div className="flex items-center gap-3 mt-2 pl-1">
             <span className="text-[11px] font-black bg-white/10 px-3 py-0.5 rounded-full text-white/80 border border-white/5 tracking-widest uppercase">台中慈院藥學部</span>
             {lastSynced && <span className="text-[10px] opacity-40 italic font-bold">同步：{lastSynced}</span>}
             {isSyncing && <Loader2 size={10} className="animate-spin text-cyan-400 ml-1" />}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-5 no-scrollbar bg-slate-50/30">
        <div className="space-y-6">
          <div className="relative group mt-2">
            {isAnalyzing ? (
              <div className="absolute left-5 top-5 z-20">
                <Loader2 className="animate-spin text-[#004766]" size={24} />
              </div>
            ) : (
              <Search className="absolute left-5 top-5 text-slate-400 group-focus-within:text-[#004766] transition-colors" size={24} />
            )}
            
            <input 
              type="text" 
              placeholder={isAnalyzing ? "AI 辨識中..." : "搜尋藥名 或 點擊相機"} 
              className={`w-full pl-14 pr-24 py-5 bg-white border-2 border-slate-100 rounded-3xl focus:ring-8 focus:ring-[#004766]/5 focus:border-[#004766] outline-none transition-all text-xl font-black text-slate-900 placeholder:text-slate-300 shadow-sm ${isAnalyzing ? 'opacity-50' : ''}`}
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              disabled={isAnalyzing}
            />
            
            <div className="absolute right-4 top-3 flex items-center gap-1">
              {searchTerm && !isAnalyzing && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
              
              <button 
                onClick={startCamera}
                disabled={isAnalyzing}
                className="p-2 bg-[#004766] text-white rounded-full hover:bg-[#00334d] transition-colors shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title="拍照搜尋"
              >
                <Camera size={20} />
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            {medications.length === 0 && isSyncing ? (
              <div className="text-center py-20 flex flex-col items-center">
                  <Loader2 size={40} className="animate-spin text-[#004766] mb-4" />
                  <p className="font-black text-slate-400">正在獲取最新儲位資料...</p>
              </div>
            ) : filteredMedications.length > 0 ? (
              <>
                {filteredMedications.slice(0, 10).map(med => (
                  <div key={med.id} className="p-6 rounded-[35px] border border-slate-100 shadow-[0_8px_25px_rgba(0,0,0,0.02)] flex flex-col group active:scale-[0.98] transition-all bg-white">
                    <div className="flex-1 mb-3">
                      <h3 className="font-black text-slate-900 text-2xl mb-1 leading-tight">
                        {med.name}
                        {med.specification && <span className="ml-2 text-2xl text-red-600 font-bold">{med.specification}</span>}
                        {med.isSmallPharmacy && <span className="ml-2 text-2xl text-rose-500 font-bold">❤庫</span>}
                      </h3>
                      <span className="text-sm text-slate-400 font-black uppercase block tracking-tight">
                        {med.scientificName} {med.englishName ? `(${med.englishName})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 px-8 py-4 bg-[#004766] text-white rounded-2xl shadow-xl">
                      <MapPin size={24} className="text-cyan-300" />
                      <span className="text-5xl font-black tracking-tighter tabular-nums flex-1">
                        {med.location || '無儲位'}
                        {med.packetMachineValue && <span className="ml-3 text-4xl opacity-70 font-bold">({med.packetMachineValue})</span>}
                      </span>
                      <ChevronRight size={20} className="opacity-20" />
                    </div>
                  </div>
                ))}
                {filteredMedications.length > 10 && (
                  <div className="text-center py-6">
                    <p className="text-sm font-bold text-slate-400">僅顯示前 10 筆結果，請輸入關鍵字搜尋更多</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-32 text-slate-200">
                <Package size={80} className="mx-auto opacity-10 mb-4" />
                <p className="font-black text-xl">找不到相關藥品</p>
              </div>
            )}
          </div>

          <div className="py-12 flex flex-col items-center gap-2 text-center">
             <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2">台中慈濟醫院藥學部</h2>
             <p className="text-xl font-bold text-slate-900">製作：許文馨</p>
             <p className="text-lg font-bold text-slate-900">維護：施瑢家、李紀賢、李家豪</p>
          </div>
        </div>
      </main>

      {/* Full Screen Camera Overlay */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
           <div className="relative flex-1 overflow-hidden">
             <video 
               ref={videoRef} 
               autoPlay 
               playsInline 
               className="w-full h-full object-cover"
             />
             <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative">
                   <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl -mt-1 -ml-1"></div>
                   <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl -mt-1 -mr-1"></div>
                   <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl -mb-1 -ml-1"></div>
                   <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-xl -mb-1 -mr-1"></div>
                </div>
                <p className="absolute bottom-10 text-white/90 font-bold bg-black/40 px-4 py-1 rounded-full text-sm backdrop-blur-md">將藥品名稱對準框框</p>
             </div>
           </div>
           
           <div className="h-32 bg-black flex items-center justify-center relative shrink-0 pb-safe">
              <button 
                onClick={stopCamera} 
                className="absolute left-8 text-white/80 hover:text-white p-4 rounded-full active:bg-white/10"
              >
                <X size={32} />
              </button>
              
              <button 
                onClick={captureImage}
                className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 p-1 active:scale-95 transition-transform"
              >
                 <div className="w-full h-full bg-white rounded-full border-2 border-black/10"></div>
              </button>
              
              {/* Placeholder for potential gallery or flip button */}
              <div className="absolute right-8 w-12"></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;