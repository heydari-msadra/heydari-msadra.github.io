import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, RotateCcw, RefreshCw, Info, Settings2, BookOpen, X } from 'lucide-react';

/**
 * COMPONENT: Latex Renderer
 * Loads KaTeX from CDN and renders math string
 */
const Latex = ({ children, displayMode = false, className = "" }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    // Check if katex is already loaded globally
    if (window.katex) {
      setIsLoaded(true);
      return;
    }

    // Load CSS
    if (!document.querySelector('#katex-css')) {
      const link = document.createElement("link");
      link.id = 'katex-css';
      link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    // Load JS
    if (!window.katex && !document.querySelector('#katex-js')) {
      const script = document.createElement("script");
      script.id = 'katex-js';
      script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
      script.onload = () => setIsLoaded(true);
      document.head.appendChild(script);
    } else if (window.katex) {
      setIsLoaded(true);
    } else {
      // Script tag exists but hasn't loaded yet, poll for it or wait for existing onload
      const interval = setInterval(() => {
        if (window.katex) {
          setIsLoaded(true);
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && containerRef.current && window.katex) {
      try {
        window.katex.render(children, containerRef.current, {
          displayMode: displayMode,
          throwOnError: false
        });
      } catch (e) {
        console.error("KaTeX error:", e);
        containerRef.current.textContent = children;
      }
    } else {
      // Fallback text while loading
      containerRef.current.textContent = children;
    }
  }, [children, isLoaded, displayMode]);

  return <span ref={containerRef} className={className} />;
};

/**
 * UTILITY: Math & Random Number Generators
 */

// Lanczos approximation for log-gamma function needed for Beta PDF
const logGamma = (z) => {
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = p[0];
  for (let i = 1; i < p.length; i++) x += p[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};

// Beta Probability Density Function
const betaPdf = (x, alpha, beta) => {
  if (x <= 0.001 || x >= 0.999) return 0; // Clamp edges to avoid infinity with alpha/beta < 1
  const logBeta = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logBeta);
};

// Standard Normal variate using Box-Muller transform
const randn_bm = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

// Gamma variate generator
const gamma = (alpha) => {
  if (alpha < 1) {
    return gamma(1 + alpha) * Math.pow(Math.random(), 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    const z = randn_bm();
    const v = 1 + c * z;
    if (v <= 0) continue;
    const v3 = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (z * z * z * z)) return d * v3;
    if (Math.log(u) < 0.5 * z * z + d * (1 - v3 + Math.log(v3))) return d * v3;
  }
};

// Beta variate generator
const beta = (a, b) => {
  const x = gamma(a);
  const y = gamma(b);
  return x / (x + y);
};

const EntryDynamic = () => {
  // --- State ---
  const [n, setN] = useState(100);
  const [alpha, setAlpha] = useState(2);
  const [betaParam, setBetaParam] = useState(5);
  const [sigma, setSigma] = useState(1);
  const [showModelInfo, setShowModelInfo] = useState(false);
  
  // Simulation State
  const [history, setHistory] = useState([]); 
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef(null);

  // --- Logic ---

  const generateData = () => {
    // Generate firms with productivity A_i (value)
    const newData = Array.from({ length: n }, (_, i) => ({
      id: i,
      value: beta(alpha, betaParam), // This is A_i
      status: 'active',
      jitterY: Math.random() * 0.8 + 0.1
    }));
    
    const simSteps = [];
    let currentSet = newData.map(d => ({...d}));
    let stepCount = 0;
    let stable = false;

    // Initial State (Step 0)
    simSteps.push({
      step: 0,
      data: JSON.parse(JSON.stringify(currentSet)),
      threshold: calculateThreshold(currentSet.filter(d => d.status === 'active')),
      survivorCount: n,
      eliminatedCount: 0
    });

    while (!stable && stepCount < 100) {
      stepCount++;
      const activeData = currentSet.filter(d => d.status === 'active');
      const k = activeData.length;
      let threshold = 0;
      
      // LOGIC: A_i > (k - sigma - 1) / sum(1/A)
      if (k > sigma + 1) {
        const sumReciprocal = activeData.reduce((acc, val) => acc + (1 / val.value), 0);
        threshold = (k - sigma - 1) / sumReciprocal;
      } else {
        threshold = 0;
      }

      let eliminatedInThisRound = 0;
      const nextSet = currentSet.map(item => {
        if (item.status !== 'active') return item;
        // Firm exits if Productivity < Threshold
        if (item.value < threshold) {
          eliminatedInThisRound++;
          return { ...item, status: 'eliminated_now' };
        }
        return item;
      });

      simSteps.push({
        step: stepCount,
        data: JSON.parse(JSON.stringify(nextSet)),
        threshold: threshold,
        survivorCount: k - eliminatedInThisRound,
        eliminatedCount: eliminatedInThisRound
      });

      currentSet = nextSet.map(item => ({
        ...item,
        status: item.status === 'eliminated_now' ? 'eliminated' : item.status
      }));

      if (eliminatedInThisRound === 0) stable = true;
    }

    setHistory(simSteps);
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  const calculateThreshold = (activeItems) => {
    const k = activeItems.length;
    if (k <= sigma + 1) return 0;
    const sumReciprocal = activeItems.reduce((acc, val) => acc + (1 / val.value), 0);
    return (k - sigma - 1) / sumReciprocal;
  };

  // --- Effects ---

  useEffect(() => {
    generateData();
  }, []);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentStepIndex(prev => {
          if (prev < history.length - 1) return prev + 1;
          setIsPlaying(false);
          return prev;
        });
      }, 800);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, history]);

  // --- Handlers ---
  
  const handleReset = () => generateData();
  const handleStepForward = () => {
    if (currentStepIndex < history.length - 1) setCurrentStepIndex(prev => prev + 1);
  };
  const handleRestart = () => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  // --- Helpers for Visualization ---

  const currentStepData = history[currentStepIndex] || { data: [], threshold: 0, survivorCount: 0 };
  const isFinished = currentStepIndex === history.length - 1;
  const activeSet = currentStepData.data.filter(d => d.status === 'active' || d.status === 'eliminated_now');

  // Histogram Calculations
  const binCount = 40;
  const activeBins = new Array(binCount).fill(0);
  const totalBins = new Array(binCount).fill(0);

  currentStepData.data.forEach(d => {
    const binIdx = Math.min(Math.floor(d.value * binCount), binCount - 1);
    totalBins[binIdx]++;
    if (d.status === 'active' || d.status === 'eliminated_now') {
      activeBins[binIdx]++;
    }
  });

  // Calculate PDF Curve
  const pdfPoints = [];
  const resolution = 100;
  let maxPdfVal = 0;
  for (let i = 0; i <= resolution; i++) {
    const x = i / resolution;
    const y = betaPdf(x, alpha, betaParam);
    if (y > maxPdfVal) maxPdfVal = y;
    pdfPoints.push({ x, y });
  }

  const scaleFactor = n * (1 / binCount);
  const maxTotalBinHeight = Math.max(...totalBins);
  const maxPdfHeight = maxPdfVal * scaleFactor;
  const yMax = Math.max(1, maxPdfHeight * 1.2, maxTotalBinHeight); 

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-600" />
            Cournot Competition Dynamics
          </h1>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>Firm Survival Condition:</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded">
              <Latex>{`A_i \\ge \\frac{n - \\sigma - 1}{\\sum A_j^{-1}}`}</Latex>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end">
             <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Market Status</span>
             <span className={`text-sm font-medium ${isFinished ? 'text-green-600' : 'text-amber-600'}`}>
               {isFinished ? 'Equilibrium Reached' : `Step ${currentStepIndex} of ${history.length - 1}`}
             </span>
           </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Model Info Modal/Overlay */}
        {showModelInfo && (
          <div className="absolute inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-8 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-full overflow-y-auto flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Economic Model: Cournot Competition
                </h2>
                <button onClick={() => setShowModelInfo(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6 text-slate-600 text-sm leading-relaxed overflow-y-auto">
                <section>
                  <h3 className="font-bold text-slate-900 mb-2">1. The Representative Household</h3>
                  <p className="mb-2">
                    A representative household maximizes discounted expected lifetime utility:
                  </p>
                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex justify-center mb-2">
                    <Latex>{`U\\big(\\{c_t\\}_{t=0}^{\\infty}\\big) = \\mathbb{E}_0 \\sum_{t=0}^{\\infty} \\beta^t \\, \\frac{c_t^{1-\\sigma} - 1}{1 - \\sigma}`}</Latex>
                  </div>
                  <p>
                    Solving the first-order optimization problem yields the inverse demand function for the final good, relating price <Latex>{'p_t'}</Latex> to consumption <Latex>{'c_t'}</Latex> and the shadow price of wealth <Latex>{'\\lambda_t'}</Latex>.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-slate-900 mb-2">2. Intermediate Firms</h3>
                  <p className="mb-2">
                    Firms engage in Cournot (quantity) competition. Each firm <Latex>{'i'}</Latex> has a specific productivity <Latex>{'A_i'}</Latex> and operates with linear technology:
                  </p>
                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex justify-center mb-2">
                    <Latex>{`y_t(i) = A_t(i) \\cdot l_t(i)`}</Latex>
                  </div>
                  <p>
                    Firms set production quantities strategically, taking into account the aggregate demand but acting as price-takers in the labor market.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-slate-900 mb-2">3. Market Equilibrium & Survival</h3>
                  <p className="mb-2">
                    Assuming goods are perfect substitutes, the equilibrium price is determined by the sum of marginal costs relative to the number of firms. For a firm to produce a non-negative quantity (<Latex>{`y^*_t(i) > 0`}</Latex>), its productivity must be sufficiently high relative to the competition.
                  </p>
                  <p className="mb-2">The survival condition derived is:</p>
                  <div className="bg-slate-50 p-4 rounded border-l-4 border-indigo-500 flex justify-center">
                    <Latex>{`A_t(i) > \\frac{n - \\sigma - 1}{\\sum_{j\\ne i} 1/A_t(j)}`}</Latex>
                  </div>
                  <p className="mt-2 text-xs italic text-slate-500">
                    Simulation Note: In this visualization, firms that fail this condition are eliminated in waves until a stable set of surviving firms remains.
                  </p>
                </section>
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
                 <button 
                  onClick={() => setShowModelInfo(false)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm font-medium"
                 >
                   Return to Simulation
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar Controls */}
        <aside className="w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 overflow-y-auto flex-shrink-0 z-10">
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Parameters</h2>
              <button 
                onClick={() => setShowModelInfo(true)}
                className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                Model Info
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-slate-700">Initial Firms (<Latex>{'n'}</Latex>)</label>
                <span className="text-sm font-mono text-slate-500">{n}</span>
              </div>
              <input 
                type="range" min="50" max="1000" step="10" 
                value={n} 
                onChange={(e) => setN(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-slate-700">Elasticity Param (<Latex>{'\\sigma'}</Latex>)</label>
                <span className="text-sm font-mono text-slate-500">{sigma}</span>
              </div>
              <input 
                type="range" min="1" max="5" step="0.1" 
                value={sigma} 
                onChange={(e) => setSigma(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <p className="text-xs text-slate-400">Inverse IES</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-slate-700">Shape <Latex>{'\\alpha'}</Latex></label>
                <span className="text-sm font-mono text-slate-500">{alpha}</span>
              </div>
              <input 
                type="range" min="0.1" max="10" step="0.1" 
                value={alpha} 
                onChange={(e) => setAlpha(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <p className="text-xs text-slate-400">Low <Latex>{'\\alpha'}</Latex> = More low-productivity firms</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-slate-700">Shape <Latex>{'\\beta'}</Latex></label>
                <span className="text-sm font-mono text-slate-500">{betaParam}</span>
              </div>
              <input 
                type="range" min="0.1" max="10" step="0.1" 
                value={betaParam} 
                onChange={(e) => setBetaParam(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <button 
              onClick={handleReset}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate Market
            </button>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
             <h2 className="text-xs font-bold text-slate-500 uppercase">Step {currentStepIndex} Analysis</h2>
             <div className="flex justify-between items-center">
               <span className="text-sm text-slate-600">Active Firms (<Latex>{'n'}</Latex>)</span>
               <span className="font-mono font-bold text-indigo-600">{currentStepData.survivorCount}</span>
             </div>
             <div className="flex justify-between items-center">
               <span className="text-sm text-slate-600">Threshold (<Latex>{'A^*'}</Latex>)</span>
               <span className="font-mono font-bold text-red-500">
                 {currentStepData.threshold.toFixed(4)}
               </span>
             </div>
             <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between items-center">
                  <span>Num (<Latex>{`n - \\sigma - 1`}</Latex>):</span>
                  <span>{Math.max(0, currentStepData.survivorCount - sigma - 1).toFixed(2)}</span>
                </div>
             </div>
          </div>
        </aside>

        {/* Main Visualization Area */}
        <main className="flex-1 flex flex-col bg-slate-50 p-6 relative min-h-0">
          
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden flex flex-col min-h-0">
            
            {/* Controls */}
            <div className="absolute top-6 right-6 z-20 flex gap-2">
              <button 
                onClick={handleRestart}
                disabled={currentStepIndex === 0}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors"
                title="Restart"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={isFinished}
                className="p-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 disabled:opacity-50 transition-colors"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button 
                onClick={handleStepForward}
                disabled={isFinished || isPlaying}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors"
                title="Next Step"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* --- TOP CHART: HISTOGRAM --- */}
            <div className="h-1/2 min-h-[200px] w-full relative mb-4 border-b border-slate-100 pb-4">
               <h3 className="text-sm font-semibold text-slate-400 absolute top-0 left-0 uppercase tracking-wider">Productivity Distribution (<Latex>{'A_i'}</Latex>)</h3>
               
               {/* Histogram Container */}
               <div className="absolute inset-0 top-8 bottom-0 flex items-end justify-between px-8">
                  {/* Bars */}
                  {Array.from({ length: binCount }).map((_, idx) => {
                    const totalCount = totalBins[idx];
                    const activeCount = activeBins[idx];
                    
                    const totalHeightPct = (totalCount / yMax) * 100;
                    const activeHeightPct = (activeCount / yMax) * 100;
                    const xPct = (idx / binCount) * 100;
                    const widthPct = (1 / binCount) * 100;
                    
                    return (
                      <React.Fragment key={idx}>
                        {/* 1. Total (Ghost/Background) Bar */}
                        <div 
                          className="bg-slate-200 absolute bottom-0 border-r border-white"
                          style={{
                            left: `${xPct}%`,
                            width: `${widthPct}%`,
                            height: `${Math.min(totalHeightPct, 100)}%`,
                          }}
                        />
                        {/* 2. Active (Foreground) Bar */}
                        <div 
                          className="bg-indigo-400 absolute bottom-0 transition-all duration-300 border-r border-white"
                          style={{
                            left: `${xPct}%`,
                            width: `${widthPct}%`,
                            height: `${Math.min(activeHeightPct, 100)}%`,
                            opacity: 0.9
                          }}
                        />
                      </React.Fragment>
                    );
                  })}
                  
                  {/* PDF Curve Overlay */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
                    <path 
                      d={pdfPoints.map((p, i) => {
                         const plotX = p.x * 100;
                         // Match scaling of bars
                         const val = (p.y * scaleFactor); 
                         const plotY = (val / yMax) * 100;
                         return `${i === 0 ? 'M' : 'L'} ${plotX}% ${100 - plotY}%`;
                      }).join(' ')}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      className="opacity-60"
                    />
                  </svg>
                  
                  {/* Threshold Line Extension (Top) */}
                   <div 
                    className="absolute top-0 bottom-0 border-l-2 border-red-500/30 z-20 transition-all duration-500 ease-in-out"
                    style={{ left: `${currentStepData.threshold * 100}%`, opacity: currentStepData.threshold > 1 || currentStepData.threshold < 0 ? 0 : 1 }}
                  />
               </div>
            </div>

            {/* --- BOTTOM CHART: PARTICLES --- */}
            <div className="flex-1 relative w-full min-h-[150px]">
               <h3 className="text-sm font-semibold text-slate-400 absolute top-0 left-0 uppercase tracking-wider">Firm Productivity Timeline</h3>

              {/* Plot Area */}
              <div className="absolute inset-0 top-8 bottom-8 left-8 right-8">
                
                {/* Grid Lines */}
                <div className="absolute top-0 bottom-0 left-0 w-px bg-slate-200"></div>
                <div className="absolute top-0 bottom-0 left-1/4 w-px bg-slate-100 border-l border-dashed border-slate-200"></div>
                <div className="absolute top-0 bottom-0 left-2/4 w-px bg-slate-100 border-l border-dashed border-slate-200"></div>
                <div className="absolute top-0 bottom-0 left-3/4 w-px bg-slate-100 border-l border-dashed border-slate-200"></div>
                <div className="absolute top-0 bottom-0 right-0 w-px bg-slate-200"></div>

                {/* X Axis Labels */}
                <div className="absolute -bottom-6 left-0 -translate-x-1/2 text-xs text-slate-400">0.0</div>
                <div className="absolute -bottom-6 left-1/4 -translate-x-1/2 text-xs text-slate-400">0.25</div>
                <div className="absolute -bottom-6 left-2/4 -translate-x-1/2 text-xs text-slate-400">0.5</div>
                <div className="absolute -bottom-6 left-3/4 -translate-x-1/2 text-xs text-slate-400">0.75</div>
                <div className="absolute -bottom-6 left-full -translate-x-1/2 text-xs text-slate-400">1.0</div>

                {/* Threshold Line (Bottom) */}
                <div 
                  className="absolute top-0 bottom-0 border-l-2 border-red-500 z-20 transition-all duration-500 ease-in-out flex flex-col justify-end pb-2"
                  style={{ left: `${currentStepData.threshold * 100}%`, opacity: currentStepData.threshold > 1 || currentStepData.threshold < 0 ? 0 : 1 }}
                >
                  <span className="text-xs font-bold text-red-500 bg-white/80 px-1 ml-1 whitespace-nowrap flex items-center">
                    <Latex>{`A^* = `}</Latex> {currentStepData.threshold.toFixed(3)}
                  </span>
                </div>

                {/* Particles */}
                {currentStepData.data.map((point) => {
                  let colorClass = "bg-indigo-500";
                  let opacity = 1;
                  let scale = 1;
                  
                  if (point.status === 'eliminated_now') {
                    colorClass = "bg-red-500";
                    scale = 1.3;
                  } else if (point.status === 'eliminated') {
                    colorClass = "bg-slate-300";
                    opacity = 0.2;
                    scale = 0.7;
                  } else {
                    colorClass = "bg-emerald-500";
                  }

                  return (
                    <div
                      key={point.id}
                      className={`absolute rounded-full transition-all duration-500 ease-in-out ${colorClass}`}
                      style={{
                        left: `${point.value * 100}%`,
                        top: `${point.jitterY * 100}%`,
                        width: '10px',
                        height: '10px',
                        transform: `translate(-50%, -50%) scale(${scale})`,
                        opacity: opacity,
                        zIndex: point.status === 'active' ? 10 : 1
                      }}
                      title={`Firm ${point.id}: Productivity A=${point.value.toFixed(3)}`}
                    />
                  );
                })}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default EntryDynamic;