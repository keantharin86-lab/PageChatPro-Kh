import React, { useState } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Wand2, 
  Upload, 
  Download, 
  Send, 
  Plus, 
  Check, 
  Layers, 
  Sliders, 
  Ratio, 
  Maximize2, 
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  Tag,
  ArrowRight
} from 'lucide-react';
import { ProductItem } from '../types';

interface ImageStudioViewProps {
  language: 'kh' | 'en';
  products: ProductItem[];
  onAddProductWithImage?: (newProduct: Partial<ProductItem>) => void;
  onSendImageToChat?: (imageUrl: string, caption: string) => void;
}

interface GeneratedImageRecord {
  id: string;
  url: string;
  prompt: string;
  mode: 'create' | 'edit';
  aspectRatio: string;
  imageSize: string;
  timestamp: string;
}

export const ImageStudioView: React.FC<ImageStudioViewProps> = ({
  language,
  products,
  onAddProductWithImage,
  onSendImageToChat,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'edit'>('create');
  const [prompt, setPrompt] = useState('');
  const [selectedProductSource, setSelectedProductSource] = useState<ProductItem | null>(products[0] || null);
  const [customUploadedImage, setCustomUploadedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [imageSize, setImageSize] = useState<string>('1K');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result state
  const [currentResultImage, setCurrentResultImage] = useState<string | null>(null);
  const [resultDescription, setResultDescription] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Gallery of generated images
  const [history, setHistory] = useState<GeneratedImageRecord[]>([
    {
      id: 'demo_1',
      url: products[0]?.imageUrl || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
      prompt: 'Modern Khmer silk dress with golden embroidery in luxury boutique',
      mode: 'create',
      aspectRatio: '1:1',
      imageSize: '1K',
      timestamp: 'Today',
    },
  ]);

  const aspectRatios = [
    { value: '1:1', label: '1:1', desc: 'Square (Feed)' },
    { value: '3:4', label: '3:4', desc: 'Portrait (Card)' },
    { value: '4:3', label: '4:3', desc: 'Landscape (Standard)' },
    { value: '9:16', label: '9:16', desc: 'Story / TikTok' },
    { value: '16:9', label: '16:9', desc: 'Wide Banner' },
    { value: '4:1', label: '4:1', desc: 'Header Banner' },
  ];

  const sizeOptions = [
    { value: '1K', label: '1K Standard', desc: 'Fast & Crisp' },
    { value: '2K', label: '2K High-Res', desc: 'HD Quality' },
    { value: '4K', label: '4K Ultra-Res', desc: 'Print & Billboard' },
  ];

  const promptSuggestions = [
    {
      labelKh: 'តុថ្មម៉ាប និងពន្លឺព្រះអាទិត្យ',
      labelEn: 'Luxury marble counter with soft daylight',
      text: 'Place this product on a sleek white Italian marble table with soft golden morning sunlight and gentle shadows, professional commercial studio product photography.',
    },
    {
      labelKh: 'បន្ថែមស្លាក 30% OFF ពណ៌មាស',
      labelEn: 'Add 30% OFF sale badge with golden trim',
      text: 'Add an elegant golden circular badge in the top right corner saying "30% OFF SPECIAL PROMO" with tasteful luxury Khmer decorative motifs and a soft ribbon.',
    },
    {
      labelKh: 'ទិដ្ឋភាពបុណ្យចូលឆ្នាំខ្មែរ Festive Sale',
      labelEn: 'Khmer New Year festive promotion background',
      text: 'Create a festive celebration banner for Cambodian New Year featuring golden romduol flower petals, warm holiday festival lights, and elegant celebratory atmosphere.',
    },
    {
      labelKh: 'ពន្លឺភ្លឺថ្លា Studio ដំណក់ទឹក',
      labelEn: 'Studio lighting with fresh water splash',
      text: 'High-end beauty cosmetics commercial visual with crystal clear water splashes, floating jasmine petals, glowing backlight, and crisp ultra-detailed reflections.',
    },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCustomUploadedImage(reader.result as string);
      setSelectedProductSource(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    setActionSuccessMessage(null);

    try {
      let sourceBase64: string | undefined = undefined;
      if (activeTab === 'edit') {
        if (customUploadedImage) {
          sourceBase64 = customUploadedImage;
        } else if (selectedProductSource) {
          try {
            const res = await fetch(selectedProductSource.imageUrl);
            const blob = await res.blob();
            sourceBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch (fetchErr) {
            console.warn('Could not read product image as base64, proceeding with prompt only');
          }
        }
      }

      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mode: activeTab,
          sourceImageBase64: sourceBase64,
          aspectRatio,
          imageSize,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      if (data.imageUrl) {
        setCurrentResultImage(data.imageUrl);
        setResultDescription(data.textDescription || null);
        const newRecord: GeneratedImageRecord = {
          id: `img_${Date.now()}`,
          url: data.imageUrl,
          prompt,
          mode: activeTab,
          aspectRatio,
          imageSize,
          timestamp: 'Just now',
        };
        setHistory((prev) => [newRecord, ...prev]);
      }
    } catch (err: any) {
      console.error('Image generation error:', err);
      setErrorMessage(err.message || 'Image creation failed. Please check server settings.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCatalogProduct = () => {
    if (!currentResultImage) return;
    if (onAddProductWithImage) {
      onAddProductWithImage({
        name: prompt.slice(0, 30) || 'AI Generated Product',
        nameKh: 'ទំនិញ AI Gemini ' + new Date().toLocaleDateString(),
        price: 29.0,
        priceKhr: 118900,
        stock: 50,
        sku: `AI-${Math.floor(1000 + Math.random() * 9000)}`,
        category: 'Promotions',
        imageUrl: currentResultImage,
        description: prompt,
      });
      setActionSuccessMessage(
        language === 'kh'
          ? 'បានបង្កើតទំនិញថ្មី និងរក្សាទុកក្នុងកាតាឡុកដោយជោគជ័យ!'
          : 'Product created and added to store catalog successfully!'
      );
      setTimeout(() => setActionSuccessMessage(null), 3000);
    }
  };

  const handleSendToChat = () => {
    if (!currentResultImage) return;
    if (onSendImageToChat) {
      onSendImageToChat(currentResultImage, prompt);
      setActionSuccessMessage(
        language === 'kh'
          ? 'បានផ្ញើរូបភាពនេះទៅកាន់ប្រអប់សារអតិថិជនរួចរាល់!'
          : 'Sent image attachment to active customer chat!'
      );
      setTimeout(() => setActionSuccessMessage(null), 3000);
    }
  };

  const handleDownload = () => {
    if (!currentResultImage) return;
    const link = document.createElement('a');
    link.href = currentResultImage;
    link.download = `pagechat-gemini-nano-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUseAsSource = () => {
    if (!currentResultImage) return;
    setCustomUploadedImage(currentResultImage);
    setActiveTab('edit');
    setPrompt('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">
                {language === 'kh' ? 'ស្ទូឌីយោរូបភាព AI (gemini-nano-banana-2.1)' : 'AI Image Studio (gemini-nano-banana-2.1)'}
              </h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                Nano Banana 2.1
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {language === 'kh'
                ? 'បង្កើត និងកែប្រែរូបភាពផលិតផលផ្សាយពាណិជ្ជកម្មតាមការបញ្ជាជាអក្សរ (Text Prompts)'
                : 'Create and edit product images using text prompts powered by gemini-nano-banana-2.1'}
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'bg-white text-purple-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>{language === 'kh' ? 'បង្កើតរូបភាពថ្មី' : 'Create Image'}</span>
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-white text-pink-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{language === 'kh' ? 'កែប្រែរូបភាព' : 'Edit Image'}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form & Settings (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* If Edit Mode: Select Source Image */}
            {activeTab === 'edit' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {language === 'kh' ? 'ជ្រើសរើសរូបដើមដើម្បីកែប្រែ (Source Image to Edit):' : 'Select Source Image to Edit:'}
                </label>
                {/* Store Products selector */}
                <div className="grid grid-cols-3 gap-2">
                  {products.map((p) => {
                    const isSelected = selectedProductSource?.id === p.id && !customUploadedImage;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProductSource(p);
                          setCustomUploadedImage(null);
                        }}
                        className={`relative rounded-xl overflow-hidden border text-left transition-all group cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-purple-600 border-transparent shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-18 object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="p-1 bg-white/95 text-[10px] font-medium text-slate-800 truncate">
                          {p.nameKh}
                        </div>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Upload Custom Image option */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {language === 'kh' ? 'ឬបង្ហោះរូបភាពផ្ទាល់ខ្លួន:' : 'Or upload custom image:'}
                  </span>
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{language === 'kh' ? 'បង្ហោះរូប' : 'Upload File'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {customUploadedImage && (
                  <div className="relative rounded-xl overflow-hidden border border-purple-300">
                    <img
                      src={customUploadedImage}
                      alt="Uploaded"
                      className="w-full h-28 object-cover"
                    />
                    <span className="absolute top-1.5 left-1.5 text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded font-medium">
                      {language === 'kh' ? 'រូបភាពផ្ទាល់ខ្លួន' : 'Custom Upload'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Prompt Input */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>{language === 'kh' ? 'បញ្ជាជាអក្សរ Prompt (ការពិពណ៌នារូបភាព):' : 'Image Prompt Instructions:'}</span>
                <span className="text-[11px] font-normal text-purple-600">Khmer / English</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder={
                  activeTab === 'create'
                    ? (language === 'kh'
                        ? 'ឧ. រ៉ូបហូលខ្មែរម៉ូដសម័យពណ៌មាស ដាក់តាំងក្នុងហាងប្រណិត មានពន្លឺ Studio ស្រទន់...'
                        : 'E.g., Modern Cambodian silk blouse displayed in luxury boutique showroom with soft golden studio lighting...')
                    : (language === 'kh'
                        ? 'ឧ. ដាក់ទំនិញនេះលើតុថ្មម៉ាប បន្ថែមផ្លាក 30% OFF ពណ៌មាស និងផ្កាចំប៉ី...'
                        : 'E.g., Place this product on luxury marble counter, add festive 30% OFF banner with gold ribbon...')
                }
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />

              {/* Prompt Suggestions */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  {language === 'kh' ? 'គំរូពាក្យបញ្ជាបន្ថែម (Prompt Enhancers):' : 'Quick Prompt Ideas:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {promptSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt((prev) => (prev ? `${prev}, ${s.text}` : s.text))}
                      className="text-[11px] bg-slate-100 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600 transition-colors text-left cursor-pointer"
                    >
                      + {language === 'kh' ? s.labelKh : s.labelEn}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Model Aspect Ratio & Resolution Configs */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Ratio className="w-3.5 h-3.5 text-purple-600" />
                  <span>{language === 'kh' ? 'សមាមាត្ររូបភាព (Aspect Ratio):' : 'Aspect Ratio:'}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {aspectRatios.map((ar) => (
                    <button
                      key={ar.value}
                      type="button"
                      onClick={() => setAspectRatio(ar.value)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        aspectRatio === ar.value
                          ? 'bg-purple-50 border-purple-500 text-purple-700 font-bold shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-xs font-mono">{ar.label}</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">{ar.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>{language === 'kh' ? 'កម្រិតច្បាស់រូបភាព (Image Size):' : 'Image Resolution:'}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {sizeOptions.map((sz) => (
                    <button
                      key={sz.value}
                      type="button"
                      onClick={() => setImageSize(sz.value)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        imageSize === sz.value
                          ? 'bg-purple-50 border-purple-500 text-purple-700 font-bold shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-xs font-mono">{sz.label}</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">{sz.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 disabled:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    {language === 'kh'
                      ? 'Gemini Nano Banana 2.1 កំពុងគូររូបភាព...'
                      : 'Rendering via gemini-nano-banana-2.1...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {activeTab === 'create'
                      ? (language === 'kh' ? 'បង្កើតរូបភាព (Render Image)' : 'Generate Image')
                      : (language === 'kh' ? 'កែប្រែលើរូបភាព (Apply Edit)' : 'Apply Image Edit')}
                  </span>
                </>
              )}
            </button>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {errorMessage}
              </div>
            )}

            {actionSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{actionSuccessMessage}</span>
              </div>
            )}
          </div>

          {/* Right Column: Canvas Preview & Quick Action Bar (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    <span>{language === 'kh' ? 'ផ្ទាំងរូបភាពលទ្ធផល (Preview Stage)' : 'Rendered Image Output'}</span>
                  </span>
                  <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    gemini-nano-banana-2.1 • {aspectRatio} • {imageSize}
                  </span>
                </div>

                {/* Display Image or Placeholder */}
                <div className="relative min-h-[360px] bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden border border-slate-800 group">
                  {currentResultImage ? (
                    <img
                      src={currentResultImage}
                      alt="Generated"
                      className="max-h-[500px] w-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-center p-8 max-w-sm">
                      <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-500 mx-auto flex items-center justify-center mb-3">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-semibold text-slate-300">
                        {language === 'kh' ? 'មិនទាន់មានរូបភាពត្រូវបានបង្កើតនៅឡើយ' : 'No image rendered yet'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {language === 'kh'
                          ? 'សរសេរការពិពណ៌នា Prompt នៅខាងឆ្វេង ហើយចុចប៊ូតុងបង្កើតដើម្បីឱ្យ gemini-nano-banana-2.1 បង្កើតរូបភាពជូន។'
                          : 'Write a prompt on the left and click Generate Image to produce high-fidelity visuals.'}
                      </p>
                    </div>
                  )}

                  {isLoading && (
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4">
                      <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mb-3"></div>
                      <p className="text-sm font-semibold text-purple-200">
                        {language === 'kh' ? 'gemini-nano-banana-2.1 កំពុងគូររូប...' : 'Generating image...'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {language === 'kh' ? 'កម្រិតច្បាស់ ' + imageSize : 'Rendering at ' + imageSize + ' resolution'}
                      </p>
                    </div>
                  )}
                </div>

                {resultDescription && (
                  <p className="mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {resultDescription}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              {currentResultImage && (
                <div className="pt-4 mt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={handleAddCatalogProduct}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    title="បន្ថែមទៅក្នុងកាតាឡុកទំនិញហាង"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'kh' ? 'ថែមទៅស្តុក' : 'Add to Catalog'}</span>
                  </button>
                  <button
                    onClick={handleSendToChat}
                    className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    title="ផ្ញើភ្ជាប់ទៅការជជែករបស់អតិថិជន"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{language === 'kh' ? 'ផ្ញើទៅឆាត' : 'Send to Chat'}</span>
                  </button>
                  <button
                    onClick={handleUseAsSource}
                    className="p-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="យករូបនេះជាប្រភពដើម្បីកែប្រែបន្ត"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{language === 'kh' ? 'កែប្រែបន្ត' : 'Edit Further'}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{language === 'kh' ? 'ទាញយករូប' : 'Download'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* History Gallery */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {language === 'kh' ? 'ប្រវត្តិនៃការបង្កើត (Gallery History):' : 'Creation History:'}
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentResultImage(item.url);
                      setPrompt(item.prompt);
                    }}
                    className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-200 hover:border-purple-500 transition-all group cursor-pointer"
                  >
                    <img
                      src={item.url}
                      alt={item.prompt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
