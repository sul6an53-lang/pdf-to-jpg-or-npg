
import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  Download, 
  Settings, 
  Image as ImageIcon, 
  Loader2, 
  Trash2, 
  Cpu, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  PlayCircle,
  FileText,
  X,
  Sliders,
  Layers
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { PDFPageData, ConversionSettings, DocumentAnalysis } from './types';
import { analyzeDocument } from './services/geminiService';

// توحيد نسخة الـ Worker مع النسخة المستخدمة في Import Map
const PDFJS_VERSION = '4.10.38';
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

const App: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PDFPageData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReadyToConvert, setIsReadyToConvert] = useState(false);
  const [settings, setSettings] = useState<ConversionSettings>({ 
    format: 'png', 
    scale: 2.0,
    pageRange: "",
    quality: 0.92
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [totalPagesCount, setTotalPagesCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsePageRange = (range: string, max: number): number[] => {
    if (!range || range.trim() === "") {
      return Array.from({ length: max }, (_, i) => i + 1);
    }
    const result: Set<number> = new Set();
    const parts = range.split(',');
    parts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = Number(startStr);
        const end = Number(endStr);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(max, end); i++) {
            result.add(i);
          }
        }
      } else {
        const num = Number(trimmed);
        if (!isNaN(num) && num >= 1 && num <= max) {
          result.add(num);
        }
      }
    });
    return Array.from(result).sort((a, b) => a - b);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      if (file) alert("يرجى اختيار ملف PDF صالح.");
      return;
    }

    try {
      setIsProcessing(true);
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      setTotalPagesCount(pdf.numPages);
      setPdfFile(file);
      setPages([]);
      setAnalysis(null);
      setIsReadyToConvert(true);
      setProgress(0);
    } catch (e) {
      console.error("PDF load error:", e);
      alert("فشل تحميل الملف. قد يكون تالفاً أو محمياً.");
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdf = async () => {
    if (!pdfFile) return;
    
    setIsProcessing(true);
    setIsReadyToConvert(false);
    setProgress(0);
    
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      const targetPages = parsePageRange(settings.pageRange, pdf.numPages);
      if (targetPages.length === 0) {
        alert("نطاق الصفحات المحدد غير صالح.");
        setIsReadyToConvert(true);
        setIsProcessing(false);
        return;
      }

      const loadedPages: PDFPageData[] = [];
      let fullText = "";

      for (let i = 0; i < targetPages.length; i++) {
        const pageNum = targetPages[i];
        const page = await pdf.getPage(pageNum);
        
        // جلب النص للتحليل (أول 3 صفحات مستهدفة)
        if (i < 3) {
          try {
            const content = await page.getTextContent();
            fullText += content.items.map((item: any) => item.str).join(" ") + " ";
          } catch (err) {
            console.warn("Could not extract text from page", pageNum);
          }
        }

        const viewport = page.getViewport({ scale: settings.scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;

          loadedPages.push({
            pageNumber: pageNum,
            dataUrl: canvas.toDataURL(`image/${settings.format}`, settings.format === 'jpeg' ? settings.quality : undefined),
            width: viewport.width,
            height: viewport.height
          });
        }
        setProgress(Math.round(((i + 1) / targetPages.length) * 100));
      }

      setPages(loadedPages);
      setActivePageIndex(0);
      
      if (fullText.trim()) {
        analyzeDocument(fullText.slice(0, 1500)).then(setAnalysis).catch(console.error);
      }
    } catch (error) {
      console.error("PDF conversion error:", error);
      alert("حدث خطأ أثناء معالجة الصفحات.");
      setIsReadyToConvert(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = (page: PDFPageData) => {
    const link = document.createElement('a');
    link.href = page.dataUrl;
    link.download = `${pdfFile?.name.replace('.pdf', '') || 'file'}-page-${page.pageNumber}.${settings.format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setPdfFile(null);
    setPages([]);
    setAnalysis(null);
    setIsReadyToConvert(false);
    setProgress(0);
    setTotalPagesCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen text-slate-900 pb-20 selection:bg-indigo-100 bg-[#f8fafc]">
      {/* Header */}
      <nav className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-sm border-b border-slate-200/50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
            <ImageIcon size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">محول PDF الذكي</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>معالجة محلية آمنة</span>
          </div>
          {pdfFile && (
            <button 
              onClick={reset}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 mt-10">
        {!pdfFile ? (
          <div className="mt-12 max-w-2xl mx-auto animate-in fade-in zoom-in duration-500">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative border-2 border-dashed border-slate-300 rounded-[2.5rem] p-20 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition-all duration-500 shadow-xl shadow-slate-200/50 bg-white"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="application/pdf" 
                className="hidden" 
              />
              <div className="bg-indigo-50 p-8 rounded-3xl shadow-inner group-hover:scale-110 transition-transform duration-500 ease-out">
                {isProcessing && !pdfFile ? <Loader2 size={56} className="text-indigo-600 animate-spin" /> : <FileUp size={56} className="text-indigo-600" />}
              </div>
              <h2 className="mt-8 text-2xl font-bold text-slate-800">ارفع ملف PDF هنا</h2>
              <p className="mt-3 text-slate-500 text-center max-w-sm font-medium">حوّل مستنداتك إلى صور فائقة الجودة للاستخدام المهني</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Sidebar / Settings */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
                    <FileText size={28} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate" title={pdfFile.name}>{pdfFile.name}</h3>
                    <p className="text-xs text-slate-400 font-bold">{totalPagesCount} صفحة • {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {isReadyToConvert && (
                    <button 
                      onClick={processPdf}
                      className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      <PlayCircle size={24} />
                      ابدأ التحويل الآن
                    </button>
                  )}
                  
                  <button 
                    onClick={() => setShowAdvanced(true)}
                    className="w-full bg-slate-50 text-slate-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-100 transition-all border border-slate-200"
                  >
                    <Sliders size={20} />
                    إعدادات متقدمة
                  </button>
                </div>
              </div>

              {pages.length > 0 && (
                <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 mb-6">
                    <Settings size={20} className="text-indigo-600" />
                    <h3 className="font-bold">خيارات سريعة</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {(['png', 'jpeg'] as const).map(fmt => (
                        <button
                          key={fmt}
                          onClick={() => setSettings(s => ({ ...s, format: fmt }))}
                          className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all ${settings.format === fmt ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>

                    <div className="pt-2">
                       <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">مستوى الوضوح</label>
                        <span className="text-xs font-black text-indigo-600">x{settings.scale}</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" step="0.5" value={settings.scale}
                        onChange={(e) => setSettings(s => ({ ...s, scale: parseFloat(e.target.value) }))}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>

                    <button 
                      onClick={processPdf}
                      disabled={isProcessing}
                      className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                      تحديث الصور
                    </button>
                  </div>
                </section>
              )}

              {analysis && (
                <section className="bg-indigo-900 text-white p-7 rounded-[2rem] shadow-xl relative overflow-hidden animate-in zoom-in duration-500">
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu size={18} className="text-indigo-300" />
                    <h3 className="font-bold text-sm">تحليل ذكي</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-indigo-100 font-medium mb-4 italic">"{analysis.summary}"</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.suggestedTags.map((tag, i) => (
                      <span key={i} className="bg-white/10 px-2 py-1 rounded-lg text-[10px] font-bold border border-white/5">#{tag}</span>
                    ))}
                  </div>
                </section>
              )}

              {pages.length > 0 && (
                <button 
                  onClick={() => pages.forEach(p => downloadImage(p))}
                  className="w-full bg-emerald-600 text-white py-5 rounded-[2rem] font-black flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
                >
                  <Download size={24} />
                  تحميل الكل ({pages.length})
                </button>
              )}
            </div>

            {/* Main Preview Area */}
            <div className="lg:col-span-8">
              {isProcessing ? (
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-slate-100 shadow-xl">
                  <div className="relative mb-8">
                    <svg className="w-24 h-24 rotate-[-90deg]">
                      <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                      <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * progress) / 100} className="text-indigo-600 transition-all duration-300" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-black text-indigo-600">{progress}%</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-slate-800">جاري المعالجة...</h3>
                  <p className="mt-2 text-slate-400 text-sm">يتم تحويل صفحات PDF إلى صور عالية الدقة</p>
                </div>
              ) : pages.length > 0 ? (
                <div className="space-y-8 animate-in fade-in duration-700">
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 group relative">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-300 uppercase tracking-widest">معاينة مباشرة</span>
                        <span className="text-sm font-bold text-slate-600">الصفحة {pages[activePageIndex].pageNumber}</span>
                      </div>
                      <button 
                        onClick={() => downloadImage(pages[activePageIndex])}
                        className="bg-indigo-50 text-indigo-600 px-6 py-3 rounded-2xl text-sm font-black flex items-center gap-2 hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        <Download size={18} />
                        حفظ كصورة
                      </button>
                    </div>
                    
                    <div className="relative aspect-[1/1.4] bg-slate-50 rounded-3xl overflow-hidden flex items-center justify-center border border-slate-100 shadow-inner group-hover:shadow-indigo-100 transition-all duration-500">
                      <img src={pages[activePageIndex].dataUrl} className="max-w-[95%] max-h-[95%] object-contain shadow-2xl rounded-sm" alt={`Page ${pages[activePageIndex].pageNumber}`} />
                      
                      <div className="absolute inset-x-0 bottom-8 flex justify-center gap-4">
                        <button disabled={activePageIndex === 0} onClick={() => setActivePageIndex(p => Math.max(0, p - 1))} className="bg-white/95 p-4 rounded-full shadow-2xl disabled:opacity-20 hover:scale-110 active:scale-95 transition-all text-indigo-600">
                          <ChevronRight size={24} />
                        </button>
                        <button disabled={activePageIndex === pages.length - 1} onClick={() => setActivePageIndex(p => Math.min(pages.length - 1, p + 1))} className="bg-white/95 p-4 rounded-full shadow-2xl disabled:opacity-20 hover:scale-110 active:scale-95 transition-all text-indigo-600">
                          <ChevronLeft size={24} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/40 p-4 rounded-[2rem] border border-white">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                      {pages.map((page, idx) => (
                        <button key={idx} onClick={() => setActivePageIndex(idx)} className={`group aspect-[1/1.4] rounded-2xl overflow-hidden border-4 transition-all duration-300 relative ${activePageIndex === idx ? 'border-indigo-600 ring-8 ring-indigo-50 scale-105 z-10' : 'border-white hover:border-indigo-200'}`}>
                          <img src={page.dataUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded-md font-bold backdrop-blur-sm">{page.pageNumber}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : isReadyToConvert ? (
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-4 border-dashed border-indigo-100 animate-pulse">
                   <PlayCircle size={64} className="text-indigo-200 mb-6" />
                   <h3 className="text-lg font-bold text-slate-400 italic text-center px-4">تم تحميل الملف بنجاح!<br/>اضغط على "ابدأ التحويل" لمعالجته</h3>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>

      {/* Advanced Settings Modal */}
      {showAdvanced && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAdvanced(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-8 border-b flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <Sliders className="text-indigo-600" />
                <h3 className="text-xl font-bold">إعدادات متقدمة</h3>
              </div>
              <button onClick={() => setShowAdvanced(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              {/* Page Range */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-slate-400" />
                  <label className="text-sm font-bold text-slate-700">نطاق الصفحات</label>
                </div>
                <input 
                  type="text" 
                  placeholder="مثال: 1-5, 8, 10-12" 
                  value={settings.pageRange}
                  onChange={(e) => setSettings(s => ({ ...s, pageRange: e.target.value }))}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                />
                <p className="text-[10px] text-slate-400 font-bold px-1">اترك الحقل فارغاً لتحويل جميع الصفحات ({totalPagesCount > 0 ? totalPagesCount : '...'})</p>
              </div>

              {/* Quality Settings (Conditional for JPEG) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700">جودة الضغط (لصيغة JPEG)</label>
                  <span className="text-sm font-black text-indigo-600">{Math.round(settings.quality * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.1" max="1" step="0.01" value={settings.quality}
                  onChange={(e) => setSettings(s => ({ ...s, quality: parseFloat(e.target.value) }))}
                  disabled={settings.format === 'png'}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-30"
                />
                {settings.format === 'png' && (
                  <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-2 rounded-lg">صيغة PNG تستخدم ضغطاً بدون فقدان، إعداد الجودة متاح فقط للـ JPEG.</p>
                )}
              </div>

              {/* Action */}
              <button 
                onClick={() => { setShowAdvanced(false); if(pdfFile) processPdf(); }}
                className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-bold shadow-lg hover:shadow-slate-200 transition-all"
              >
                حفظ الإعدادات وتطبيقها
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 inset-x-0 bg-white/60 backdrop-blur-xl border-t border-slate-200/50 text-center py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest z-[60]">
        <p>Advanced PDF Engine • Ultra High Fidelity Conversion</p>
      </footer>
    </div>
  );
};

export default App;
