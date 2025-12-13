import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

// --- Types ---

type CalcMode = 'quantity' | 'area_m2' | 'area_pyeong';

interface SavedItem {
  id: number;
  title: string;
  specs: {
    t: number;
    w: number;
    l: number;
  };
  inputLabel: string;
  totalQuantity: number;
  totalAreaM2: number;
  totalPrice: number;
  unitPrice: number;
  timestamp: number;
}

// --- Constants ---

const THICKNESS_OPTS = [19, 20, 25, 30];
const WIDTH_OPTS = [95, 100, 120, 140, 150];
const LENGTH_OPTS = [2000, 2400, 2800, 3000];

const PYEONG_TO_M2 = 3.305785;

const STORAGE_KEY = 'deck-calculator-saved-items';
const STORAGE_DURATION_DAYS = 7;
const STORAGE_DURATION_MS = STORAGE_DURATION_DAYS * 24 * 60 * 60 * 1000;

const LOGO_URL = "https://i.ibb.co/PZZSchRn/Logo.png";

// --- Icons ---

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#004225]/40" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const XMarkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

// --- Helpers ---

const formatDate = (timestamp: number) => {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hour}:${min}`;
};

const formatNumber = (num: number, decimals: number) => {
  return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const getDisplayValue = (val: string) => {
  if (!val) return '';
  const parts = val.split('.');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? '.' + parts[1] : '';
  
  const formattedInteger = integerPart ? Number(integerPart).toLocaleString() : '';
  return formattedInteger + decimalPart;
};

const loadHtml2Canvas = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('html2canvas failed to load'));
    document.body.appendChild(script);
  });
};

declare global {
  interface Window {
    html2canvas: any;
  }
}

// --- Helper Components ---

const DimensionControl = React.memo(({
  label,
  options,
  value,
  onChange,
  unit
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (val: number) => void;
  unit: string;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (options.includes(value)) {
      setIsEditing(false);
    }
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (opt: number | 'custom') => {
    if (opt === 'custom') {
      setIsEditing(true);
      onChange(0);
      setIsOpen(false);
    } else {
      onChange(opt as number);
      setIsOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const handleReset = () => {
    setIsEditing(false);
    onChange(options[0]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-base font-bold text-slate-700 mb-1.5">{label}</label>
      <div className="relative w-full">
        {isEditing ? (
          <>
            <input
              type="number"
              inputMode="numeric"
              value={value === 0 ? '' : value}
              onChange={handleInputChange}
              className="block w-full h-12 rounded-lg border border-[#004225] bg-white pl-3 pr-8 text-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#004225] no-spinner"
              placeholder="직접입력"
              autoFocus
            />
            <button
              onClick={handleReset}
              className="absolute inset-y-0 right-0 px-2 flex items-center text-slate-400 hover:text-slate-600"
              title="목록으로 돌아가기"
            >
              <XMarkIcon />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-full h-12 text-left rounded-lg border border-[#004225]/20 bg-white pl-3 pr-8 text-slate-700 text-lg focus:border-[#004225] focus:outline-none shadow-sm flex items-center justify-between transition-colors hover:border-[#004225]/50"
            >
              <span className="truncate">{value}{unit}</span>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <ChevronDownIcon />
              </div>
            </button>

            {isOpen && (
              <ul className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 text-lg shadow-xl focus:outline-none animate-fade-in-down">
                {options.map((opt) => (
                  <li
                    key={opt}
                    onClick={() => handleOptionClick(opt)}
                    className={`cursor-pointer select-none py-3 pl-3 pr-3 transition-colors ${
                      value === opt 
                        ? 'bg-[#004225]/10 text-[#004225] font-bold' 
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {opt}{unit}
                  </li>
                ))}
                <li
                  onClick={() => handleOptionClick('custom')}
                  className="cursor-pointer select-none py-3 pl-3 pr-3 text-slate-500 hover:bg-slate-100 hover:text-[#004225] border-t border-slate-100 font-medium transition-colors"
                >
                  직접입력
                </li>
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
});

const ResultRow = React.memo(({ label, value, subValue, highlight = false }: { label: string; value: string; subValue?: string; highlight?: boolean }) => (
  <div className={`flex justify-between items-baseline gap-4 p-5 rounded-lg ${highlight ? 'bg-[#004225]/5 border border-[#004225]/10' : 'bg-white border border-slate-200'}`}>
    <span className={`text-2xl font-medium break-keep ${highlight ? 'text-[#004225]' : 'text-slate-600'}`}>{label}</span>
    <div className="text-right">
      <div className={`text-3xl font-bold ${highlight ? 'text-[#004225]' : 'text-slate-800'}`}>{value}</div>
      {subValue && <div className="text-sm text-slate-400 mt-1">{subValue}</div>}
    </div>
  </div>
));

// Optimized SavedItem Component to prevent re-renders when Calculator inputs change
const SavedItemCard = React.memo(({ 
  item, 
  onDownload, 
  onDelete 
}: { 
  item: SavedItem, 
  onDownload: (id: number, title: string) => void, 
  onDelete: (id: number) => void 
}) => {
  return (
    <div 
      id={`saved-item-${item.id}`}
      className="bg-white rounded-lg shadow-sm p-5 relative overflow-hidden"
    >
      {/* Straight Color Bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[6px] bg-[#004225] z-10"></div>

      {/* Buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-2" data-html2canvas-ignore="true">
        <button 
          onClick={() => onDownload(item.id, item.title)}
          className="text-slate-300 hover:text-[#004225] transition-colors p-1"
          title="이미지로 저장/공유"
        >
          <DownloadIcon />
        </button>
        <button 
          onClick={() => onDelete(item.id)}
          className="text-slate-300 hover:text-red-500 transition-colors p-1"
          title="삭제"
        >
          <TrashIcon />
        </button>
      </div>
      
      {/* Header */}
      <div className="mb-3 pr-20 pl-3">
         <div className="text-2xl font-bold text-slate-900">{item.title}</div>
         <div className="text-base text-slate-400">{formatDate(item.timestamp)}</div>
      </div>

      {/* Body: Specs */}
      <div className="pl-3">
        <div className="flex flex-col gap-1.5 text-lg text-slate-600">
          <div>규격: 두께 {item.specs.t}㎜ · 폭 {item.specs.w}㎜ · 길이 {item.specs.l}㎜</div>
          <div>단가: {item.unitPrice.toLocaleString()}원</div>
          <div>수량: {item.totalQuantity.toLocaleString()}장</div>
          <div>면적(평): {(item.totalAreaM2 / PYEONG_TO_M2).toFixed(1)}평</div>
          <div>면적(m²): {item.totalAreaM2.toFixed(2)}m²</div>
        </div>
      </div>

      {/* Total Price */}
      <div className="text-right mt-3 pr-2">
        <div className="text-3xl font-bold text-[#004225] whitespace-nowrap">
          총액 {item.totalPrice.toLocaleString()}원
        </div>
        <div className="text-sm text-slate-400 mt-1 font-medium">
          (부가세 및 운임 별도)
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-slate-100 bg-white pl-3 pr-2 flex justify-between items-end">
          <div className="text-xs text-slate-300 leading-tight max-w-[60%] break-keep">
            ※ 본 견적은 참고용이며 실제 시공 비용은 현장 조건에 따라 달라질 수 있습니다.
          </div>
          <div className="flex flex-col items-end gap-1">
            <img 
              src={LOGO_URL}
              alt="Logo 데크센터" 
              className="h-7 w-auto object-contain mb-2" 
              loading="eager"
            />
            <div className="text-xs text-slate-400">https://deckctr.com</div>
          </div>
      </div>
    </div>
  );
});

const App: React.FC = () => {
  // --- State ---
  const [customTitle, setCustomTitle] = useState('');
  
  // Dimensions
  const [thickness, setThickness] = useState<number>(25);
  const [width, setWidth] = useState<number>(150);
  const [length, setLength] = useState<number>(3000);

  // Price & Input
  const [unitPrice, setUnitPrice] = useState<number>(15000);
  const [mode, setMode] = useState<CalcMode>('quantity');
  const [inputValue, setInputValue] = useState<string>('');

  // Saved Items - Initialized empty for performance
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isSavedItemsLoaded, setIsSavedItemsLoaded] = useState(false);

  // Refs
  const savedListRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Preload Logo
  useEffect(() => {
    const img = new Image();
    img.src = LOGO_URL;
  }, []);

  // Lazy Load Saved Items
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: SavedItem[] = JSON.parse(stored);
        const now = Date.now();
        const validItems = parsed
          .filter(item => (now - item.timestamp) < STORAGE_DURATION_MS)
          .sort((a, b) => b.timestamp - a.timestamp);
        setSavedItems(validItems);
      }
    } catch (e) {
      console.error("Failed to parse saved items", e);
    } finally {
      setIsSavedItemsLoaded(true);
    }
  }, []);

  // Save to LocalStorage (only after initial load is complete)
  useEffect(() => {
    if (isSavedItemsLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedItems));
    }
  }, [savedItems, isSavedItemsLoaded]);

  // --- Calculations ---

  const results = useMemo(() => {
    const areaPerBoardM2 = (width * length) / 1_000_000;
    const pricePerM2 = unitPrice > 0 && areaPerBoardM2 > 0 ? unitPrice / areaPerBoardM2 : 0;
    const pricePerPyeong = pricePerM2 * PYEONG_TO_M2;

    const inputNum = parseFloat(inputValue);

    if (!inputValue || isNaN(inputNum) || inputNum <= 0 || width <= 0 || length <= 0) {
      return {
        isValid: false,
        areaPerBoardM2,
        pricePerM2,
        pricePerPyeong,
        totalQuantity: 0,
        totalArea: 0,
        totalPrice: 0,
        inputLabel: ''
      };
    }

    let totalQuantity = 0;
    let totalArea = 0;
    let totalPrice = 0;
    let inputLabel = '';

    if (mode === 'quantity') {
      totalQuantity = inputNum;
      totalArea = inputNum * areaPerBoardM2;
      totalPrice = inputNum * unitPrice;
      inputLabel = `${inputNum.toLocaleString()}장`;
    } else if (mode === 'area_m2') {
      totalQuantity = Math.ceil(inputNum / areaPerBoardM2);
      totalArea = totalQuantity * areaPerBoardM2;
      totalPrice = totalQuantity * unitPrice;
      inputLabel = `${inputNum.toLocaleString()}m²`;
    } else if (mode === 'area_pyeong') {
      const targetM2 = inputNum * PYEONG_TO_M2;
      totalQuantity = Math.ceil(targetM2 / areaPerBoardM2);
      totalArea = totalQuantity * areaPerBoardM2;
      totalPrice = totalQuantity * unitPrice;
      inputLabel = `${inputNum.toLocaleString()}평`;
    }

    return {
      isValid: true,
      areaPerBoardM2,
      pricePerM2,
      pricePerPyeong,
      totalQuantity,
      totalArea,
      totalPrice,
      inputLabel
    };
  }, [width, length, unitPrice, mode, inputValue]);

  // --- Handlers ---

  const moveCursorToEnd = useCallback((e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const val = target.value;
    setTimeout(() => {
      try {
        target.setSelectionRange(val.length, val.length);
      } catch (err) {}
    }, 0);
  }, []);

  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (!rawValue) {
      setUnitPrice(0);
      return;
    }
    const val = parseInt(rawValue, 10);
    if (!isNaN(val)) {
      setUnitPrice(val);
    }
  }, []);

  const handleInputValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/,/g, '');
    if (rawVal === '' || /^\d*\.?\d*$/.test(rawVal)) {
      setInputValue(rawVal);
    }
  }, []);

  const handleSave = () => {
    if (!results.isValid) return;

    const autoTitle = `${thickness}T ${width}x${length}`;
    const finalTitle = customTitle.trim() || autoTitle;

    const newItem: SavedItem = {
      id: Date.now(),
      title: finalTitle,
      specs: { t: thickness, w: width, l: length },
      inputLabel: results.inputLabel,
      totalQuantity: results.totalQuantity,
      totalAreaM2: results.totalArea,
      totalPrice: results.totalPrice,
      unitPrice: unitPrice,
      timestamp: Date.now(),
    };

    setSavedItems(prev => [newItem, ...prev]);
    
    setTimeout(() => {
      savedListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Memoized handlers for SavedItemCard to prevent re-creation on every render
  const handleDelete = useCallback((id: number) => {
    setSavedItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleDownload = useCallback(async (id: number, title: string) => {
    const element = document.getElementById(`saved-item-${id}`);
    if (!element) return;

    try {
      if (!window.html2canvas) {
        await loadHtml2Canvas();
      }

      const canvas = await window.html2canvas(element, { 
        scale: 2, 
        backgroundColor: null,
        logging: false,
        useCORS: true
      });
      
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) return;
        const safeTitle = title.replace(/[^a-z0-9가-힣]/gi, '_');
        const fileName = `견적_${safeTitle}_${id}.png`;

        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], fileName, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: '데크 견적서 공유',
              });
              return;
            }
          } catch (error) {
            console.log('Share API skipped or failed, falling back to download', error);
          }
        }
        
        const link = document.createElement('a');
        link.download = fileName;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

      }, 'image/png');
    } catch (error) {
      console.error(error);
      alert("이미지 저장 중 오류가 발생했습니다.");
    }
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-3 bg-slate-100 font-sans pb-10">
      <div className="w-full max-w-[400px] mx-auto space-y-4">
        
        {/* Main Calculator Card */}
        <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200">
          
          {/* Header */}
          <div className="bg-[#004225]/10 p-5 border-b border-[#004225]/10">
            <h1 className="text-2xl font-bold text-center text-[#004225]">데크 수량/면적 산출기</h1>
          </div>

          <div className="p-4 space-y-6">
            
            {/* 1. Title Input */}
            <div>
              <label className="block text-base font-bold text-slate-500 mb-1.5">제목 (선택사항)</label>
              <input 
                type="text" 
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="회사명, 제품명, 시공면적 등 작성하세요."
                className="w-full rounded-lg border border-[#004225]/20 bg-white py-2.5 px-3 text-lg text-slate-900 focus:border-[#004225] focus:outline-none placeholder:text-slate-300"
              />
            </div>

            {/* 2. Specs */}
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <h3 className="text-base font-bold text-slate-500">규격</h3>
                <span className="text-sm text-slate-400">단위 : mm</span>
              </div>
              <section className="grid grid-cols-3 gap-2">
                <DimensionControl 
                  label="두께 (T)" 
                  options={THICKNESS_OPTS} 
                  value={thickness} 
                  onChange={setThickness} 
                  unit=""
                />
                <DimensionControl 
                  label="폭 (W)" 
                  options={WIDTH_OPTS} 
                  value={width} 
                  onChange={setWidth} 
                  unit=""
                />
                <DimensionControl 
                  label="길이 (L)" 
                  options={LENGTH_OPTS} 
                  value={length} 
                  onChange={setLength} 
                  unit=""
                />
              </section>
            </div>

            {/* 3. Unit Price */}
            <section className="bg-[#004225]/5 rounded-lg p-4 border border-[#004225]/10 space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                   <div className="text-slate-500 text-sm mb-1">단가 (1장) <span className="text-[#004225]/70 text-xs">*수정가능</span></div>
                   <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={unitPrice === 0 ? '' : unitPrice.toLocaleString()}
                      onFocus={moveCursorToEnd}
                      onClick={moveCursorToEnd}
                      onChange={handlePriceChange}
                      className="block w-full p-1.5 text-xl font-bold text-[#004225] bg-white border border-[#004225]/20 rounded px-2 focus:border-[#004225] focus:outline-none no-spinner"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-base text-slate-400 pointer-events-none">원</span>
                  </div>
                </div>
                <div className="flex-1 text-right">
                  <div className="text-slate-400 text-sm mb-1">m²당 단가</div>
                  <div className="font-semibold text-slate-600 text-lg">
                    {results.areaPerBoardM2 > 0 ? `${Math.round(results.pricePerM2).toLocaleString()} 원` : '-'}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center border-t border-[#004225]/10 pt-3">
                 <div className="text-slate-500 text-lg">1장 면적: {results.areaPerBoardM2 > 0 ? `${results.areaPerBoardM2.toFixed(2)} m²` : '-'}</div>
                 <div className="text-right">
                    <div className="text-slate-400 text-sm">평당 단가</div>
                    <div className="font-semibold text-slate-600 text-lg">
                       {results.pricePerPyeong > 0 ? `${Math.round(results.pricePerPyeong).toLocaleString()} 원` : '-'}
                    </div>
                 </div>
              </div>
            </section>

            {/* 4. Calc Mode & Input */}
            <section>
              <div className="flex rounded-lg bg-[#004225]/10 p-1 mb-3">
                <button
                  onClick={() => setMode('quantity')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    mode === 'quantity' ? 'bg-white text-[#004225] shadow-sm' : 'text-[#004225]/60 hover:text-[#004225]'
                  }`}
                >
                  수량
                </button>
                <button
                  onClick={() => setMode('area_m2')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    mode === 'area_m2' ? 'bg-white text-[#004225] shadow-sm' : 'text-[#004225]/60 hover:text-[#004225]'
                  }`}
                >
                  면적(m²)
                </button>
                <button
                  onClick={() => setMode('area_pyeong')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    mode === 'area_pyeong' ? 'bg-white text-[#004225] shadow-sm' : 'text-[#004225]/60 hover:text-[#004225]'
                  }`}
                >
                  면적(평)
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={getDisplayValue(inputValue)}
                  onChange={handleInputValueChange}
                  onFocus={moveCursorToEnd}
                  onClick={moveCursorToEnd}
                  placeholder="0"
                  className="block w-full rounded-lg border border-[#004225]/20 bg-white py-3.5 pl-3 pr-10 text-xl font-bold text-slate-900 shadow-sm focus:border-[#004225] focus:ring-[#004225] no-spinner text-right"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                  <span className="text-slate-500 font-medium text-lg">
                    {mode === 'quantity' ? '장' : mode === 'area_m2' ? 'm²' : '평'}
                  </span>
                </div>
              </div>
            </section>

            {/* 5. Results */}
            <section className="animate-fade-in-up space-y-3 pt-2 border-t border-[#004225]/10">
              
              {mode === 'quantity' && (
                <>
                  <ResultRow
                    label="면적(m²)"
                    value={results.isValid ? `${formatNumber(results.totalArea, 1)} m²` : '-'}
                    highlight={true}
                  />
                  <ResultRow
                    label="면적(평)"
                    value={results.isValid ? `${formatNumber(results.totalArea / PYEONG_TO_M2, 1)} 평` : '-'}
                    highlight={true}
                  />
                </>
              )}

              {mode === 'area_m2' && (
                <>
                  <ResultRow
                    label="수량"
                    value={results.isValid ? `${results.totalQuantity.toLocaleString()} 장` : '-'}
                    highlight={true}
                  />
                  <ResultRow
                    label="면적(평)"
                    value={results.isValid ? `${formatNumber(results.totalArea / PYEONG_TO_M2, 1)} 평` : '-'}
                    highlight={true}
                  />
                </>
              )}

              {mode === 'area_pyeong' && (
                <>
                  <ResultRow
                    label="수량"
                    value={results.isValid ? `${results.totalQuantity.toLocaleString()} 장` : '-'}
                    highlight={true}
                  />
                  <ResultRow
                    label="면적(m²)"
                    value={results.isValid ? `${formatNumber(results.totalArea, 1)} m²` : '-'}
                    highlight={true}
                  />
                </>
              )}

              <ResultRow
                label="총 자재비"
                value={results.isValid ? `${results.totalPrice.toLocaleString()} 원` : '-'}
                subValue="(부가세/운임 별도)"
                highlight={true}
              />

              <button
                onClick={handleSave}
                disabled={!results.isValid}
                className={`w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-lg text-lg font-bold transition-colors shadow-lg active:scale-95 ${
                  results.isValid 
                    ? 'bg-[#004225] hover:opacity-90 text-white' 
                    : 'bg-[#004225]/10 text-[#004225]/50 cursor-not-allowed shadow-none'
                }`}
              >
                <SaveIcon />
                저장하기
              </button>
            </section>
          </div>
        </div>
        
        {/* Saved List - Lazy Loaded */}
        {savedItems.length > 0 && (
          <div className="w-full animate-fade-in-up" ref={savedListRef}>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-lg font-bold text-slate-700">저장된 견적</h3>
              <button 
                onClick={() => setSavedItems([])}
                className="text-sm text-red-400 hover:text-red-600 underline"
              >
                전체 삭제
              </button>
            </div>
            
            <div className="space-y-4">
              {savedItems.map((item) => (
                <SavedItemCard 
                  key={item.id} 
                  item={item} 
                  onDownload={handleDownload} 
                  onDelete={handleDelete} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="pt-6 pb-12 px-2 text-left space-y-2">
          <p className="text-sm text-slate-500 leading-relaxed break-keep">
            본 계산기는 참고용 자동 산출 도구이며, 
            <br />
            실제 시공 비용은 현장 조건, 자재 사양, 인건비, 시공 환경 등에 따라 달라질 수 있습니다. 
            <br />
            본 계산 결과를 근거로 한 계약, 발주, 시공 결과에 대해 데크센터는 법적 책임을 지지 않습니다.
          </p>
          <p className="text-xs text-slate-500 font-bold">
            Copyright © 2025 데크센터 | DeckCenter. All rights reserved.
          </p>
        </footer>

      </div>
    </div>
  );
};

export default App;