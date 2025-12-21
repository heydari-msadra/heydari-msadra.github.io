import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, RotateCcw, RefreshCw, Info, Settings2, BookOpen, X, Lightbulb, ArrowRight, ArrowLeft } from 'lucide-react';

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
    let u = Math.random();
    while (u === 0) u = Math.random(); // Prevent log(0)
    return gamma(1 + alpha) * Math.pow(u, 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    const z = randn_bm();
    const v = 1 + c * z;
    if (v <= 0) continue;
    const v3 = v * v * v;
    let u = Math.random();
    while (u === 0) u = Math.random(); // Prevent log(0)
    
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
  const [publicKnowledge, setPublicKnowledge] = useState(0); // A^p
  const [showModelInfo, setShowModelInfo] = useState(false);
  
  // Simulation State
  const [history, setHistory] = useState([]); 
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [knowledgeAppliedStep, setKnowledgeAppliedStep] = useState(null); // Track when knowledge was applied
  const timerRef = useRef(null);

  // --- Logic ---

  const calculateThreshold = (activeItems) => {
    const k = activeItems.length;
    if (k <= sigma + 1) return 0;
    const sumReciprocal = activeItems.reduce((acc, val) => acc + (1 / val.value), 0);
    return (k - sigma - 1) / sumReciprocal;
  };

  const runSimulationSteps = (initialSet, startStepCount) => {
    const steps = [];
    let currentSet = initialSet.map(d => ({...d}));
    let stepCount = startStepCount;
    let stable = false;
    let iterations = 0;

    // First, record the state as it is handed to us
    steps.push({
      step: stepCount,
      data: JSON.parse(JSON.stringify(currentSet)),
      threshold: calculateThreshold(currentSet.filter(d => d.status === 'active')),
      survivorCount: currentSet.filter(d => d.status === 'active').length,
      eliminatedCount: 0,
      isShockStep: true
    });

    while (!stable && iterations < 50) {
      stepCount++;
      iterations++;
      
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

      steps.push({
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
    return steps;
  };

  const generateData = () => {
    // Generate firms with productivity A_i (value)
    const newData = Array.from({ length: n }, (_, i) => ({
      id: i,
      value: beta(alpha, betaParam), // This is A_i
      status: 'active',
      jitterY: Math.random() * 0.8 + 0.1
    }));
    
    // Reset Public Knowledge on Regenerate
    setPublicKnowledge(0);
    setKnowledgeAppliedStep(null);

    // Run initial simulation
    const steps = runSimulationSteps(newData, 0);
    setHistory(steps);
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  const handleApplyKnowledge = () => {
    // 1. Get current state's data
    const currentStepData = history[currentStepIndex];
    if (!currentStepData) return;

    // 2. Modify currently active firms
    const modifiedData = currentStepData.data.map(firm => {
      if (firm.status === 'active' || firm.status === 'eliminated_now') {
        if (firm.value < publicKnowledge) {
            return { ...firm, value: publicKnowledge, status: 'active' }; // Revive/Boost
        }
        return { ...firm, status: 'active' }; // Ensure status is active (clear eliminated_now)
      }
      return firm;
    });

    // 3. Run simulation forward from here
    const newSteps = runSimulationSteps(modifiedData, currentStepData.step + 1);

    // 4. Update History: Keep history up to current point, then append new path
    const previousHistory = history.slice(0, currentStepIndex + 1);
    
    // Mark the transition point for UI
    setKnowledgeAppliedStep(previousHistory.length);
    
    setHistory([...previousHistory, ...newSteps]);
    
    // 5. Advance one step to show the immediate effect of the shock
    setCurrentStepIndex(previousHistory.length);
    setIsPlaying(false);
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
  const isKnowledgeActive = knowledgeAppliedStep !== null && currentStepIndex >= knowledgeAppliedStep;

  // Histogram Calculations
  const binCount = 50;
  const activeBins = new Array(binCount).fill(0);
  const totalBins = new Array(binCount).fill(0);

  if (currentStepData.data) {
    currentStepData.data.forEach(d => {
      const binIdx = Math.min(Math.floor(d.value * binCount), binCount - 1);
      totalBins[binIdx]++;
      if (d.status === 'active' || d.status === 'eliminated_now') {
        activeBins[binIdx]++;
      }
    });
  }

  // Calculate PDF Curve (Fixed to initial parameters)
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
      {/* Custom Header matching User Request */}
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center gap-6">
          <a 
            href="https://heydari-msadra.github.io/pages/research" 
            className="group flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all duration-200"
            title="Back to Research"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </a>
          
          <div className="flex flex-col">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">Sadra Heydari</div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Endogeneous Entry Simulation</h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
           {/* Compact Status Display */}
           <div className="flex flex-col items-end border-r border-slate-200 pr-6 mr-2">
             <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Step</span>
             <span className="font-mono text-lg font-bold text-slate-700">
               {currentStepIndex}<span className="text-slate-300 text-sm">/{history.length - 1}</span>
             </span>
           </div>
           
           <div className="flex flex-col items-end">
             <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status</span>
             <span className={`text-sm font-bold ${isFinished ? 'text-green-600' : 'text-amber-600'}`}>
               {isFinished ? 'Equilibrium' : 'Converging...'}
             </span>
           </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Model Info Modal - Expanded Details */}
        {showModelInfo && (
          <div className="absolute inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-6 h-8 text-indigo-600" />
                  Theoretical Framework
                </h2>
                <button onClick={() => setShowModelInfo(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-8 text-slate-700 leading-relaxed overflow-y-auto">
                <section>
                  <h3 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">1. Household Optimization</h3>
                  <p className="mb-4">
                    The representative household maximizes discounted expected lifetime utility:
                  </p>
                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex justify-center mb-4">
                    <Latex>{`U\\big(\\{c_t\\}_{t=0}^{\\infty}\\big) = \\mathbb{E}_0 \\sum_{t=0}^{\\infty} \\beta^t \\, \\frac{c_t^{1-\\sigma} - 1}{1 - \\sigma}`}</Latex>
                  </div>
                  <p className="mb-4">
                    Subject to the budget constraint <Latex>{`p_t c_t + b_{t+1} = (1+r_t) b_t + E_t`}</Latex>. The Lagrangian for this problem is:
                  </p>
                   <div className="bg-slate-50 p-4 rounded border border-slate-200 flex justify-center mb-4 overflow-x-auto">
                    <Latex>{`\\mathcal{L} = \\mathbb{E}_0 \\sum_{t=0}^{\\infty} \\beta^t \\left[ \\frac{c_t^{1-\\sigma} - 1}{1 - \\sigma} - \\lambda_t\\Big( p_t c_t + b_{t+1} -(1+r_t) b_t - E_t\\Big)\\right]`}</Latex>
                  </div>
                  <p>
                    The first-order condition with respect to consumption yields the inverse demand function:
                  </p>
                  <div className="flex justify-center my-2">
                      <Latex>{`p_t = \\frac{c_t^{-\\sigma}}{\\lambda_t},`}</Latex>
                  </div>
                  <p>
                    where <Latex>{`\\lambda_t`}</Latex> is the marginal utility of wealth, and <Latex>{`\\sigma > 0`}</Latex> is the elasticity of intertemporal substitution.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">2. Firm Production & Competition</h3>
                  <p className="mb-4">
                    Firms engage in Cournot competition. Each firm <Latex>{'i'}</Latex> has productivity <Latex>{'A_i'}</Latex> and production function <Latex>{`y_i = A_i \\cdot l_i`}</Latex>, where <Latex>{'l_i'}</Latex> is labour input, with given wage <Latex>{`\\omega_t`}</Latex>. 
                    Assuming perfect substitution, total supply is <Latex>{`Y_t = \\sum y_i`}</Latex>.
                  </p>
                  <p className="mb-2">Firm <Latex>i</Latex> maximizes profit:</p>
                  <div className="flex justify-center my-2 mb-4">
                      <Latex>{`\\max_{l_i} \\Big\\{ p_t(Y_t) \\cdot y_i - \\omega_t \\cdot l_i \\Big\\}`}</Latex>
                  </div>
                  <p>
                      Solving for equilibrium price yields:
                  </p>
                  <div className="bg-slate-50 p-4 rounded border border-slate-200 flex justify-center mb-4">
                    <Latex>{`p_t^* = \\omega_t \\frac{\\sum_{i=1}^n A_i^{-1}}{n-\\sigma}`}</Latex>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">3. Endogenous Entry Condition</h3>
                  <p className="mb-4">
                    For a firm to operate (<Latex>{`y^*_i > 0`}</Latex>), the equilibrium price must exceed its marginal cost. This implies a productivity threshold derived from the structural parameters:
                  </p>
                  <div className="bg-indigo-50 p-6 rounded-lg border-l-4 border-indigo-600 flex flex-col items-center gap-2 shadow-sm">
                    <span className="text-sm font-semibold text-indigo-900 uppercase tracking-wide">Survival Condition</span>
                    <Latex displayMode={true}>{`A_i > \\frac{n - \\sigma - 1}{\\sum_{j=1}^{n} 1/A_j}`}</Latex>
                  </div>
                  <p className="mt-4 text-sm text-slate-500 italic">
                    Note: In this simulation, <Latex>n</Latex> represents the number of surviving firms at any given iteration.
                  </p>
                </section>
              </div>
              
              {/* <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
                 <button 
                  onClick={() => setShowModelInfo(false)}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                 >
                   Return to Simulation
                 </button>
              </div> */}
            </div>
          </div>
        )}

        {/* Sidebar Controls */}
        <aside className="w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto flex-shrink-0 z-10">
          
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Parameters</h2>
            <button 
              onClick={() => setShowModelInfo(true)}
              className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium transition-colors bg-indigo-50 px-2 py-1 rounded"
            >
              <BookOpen className="w-3 h-3" />
              Full Model Info
            </button>
          </div>

          <div className="space-y-3 p-3 bg-slate-50 rounded border border-slate-200">
             <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>Survival Rule:</span>
             </div>
             <div className="flex justify-center bg-white p-2 rounded border border-slate-100 shadow-sm">
                <Latex>{`A_i \\ge \\frac{n - \\sigma - 1}{\\sum A_j^{-1}}`}</Latex>
             </div>
          </div>

          {/* Public Knowledge Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-slate-400" />
              Public Knowledge
            </h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-slate-700">Level (<Latex>{'A^p'}</Latex>)</label>
                <span className="text-sm font-mono text-slate-500">{publicKnowledge.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.005" 
                value={publicKnowledge} 
                onChange={(e) => setPublicKnowledge(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-black"
              />
            </div>
            
            <button
              onClick={handleApplyKnowledge}
              className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
              title="Boost productivity of low-performing firms"
            >
              Apply Knowledge
              <ArrowRight className="w-3 h-3" />
            </button>
            <p className="text-[10px] text-slate-400 leading-tight">
              Sets <Latex>{'A_i = \\max(A_i, A^p)'}</Latex> for all active firms.
            </p>
          </div>
            
          {/* General Params */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-slate-700">Firms (<Latex>{'n'}</Latex>)</label>
                <span className="text-sm font-mono text-slate-500">{n}</span>
              </div>
              <input 
                type="range" min="50" max="5000" step="50" 
                value={n} 
                onChange={(e) => setN(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-slate-700">Intertemporal Elasticity (<Latex>{'\\sigma'}</Latex>)</label>
                <span className="text-sm font-mono text-slate-500">{sigma}</span>
              </div>
              <input 
                type="range" min="1" max="5" step="0.1" 
                value={sigma} 
                onChange={(e) => setSigma(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-slate-700">Distribution <Latex>{'\\Beta(\\alpha, \\beta)'}</Latex></label>
              </div>
            </div>

            <div className="space-y-1">
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
            </div>

            <div className="space-y-1">
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
          </div>

          <button 
            onClick={handleReset}
            className="w-full py-2 px-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md font-medium transition-colors flex items-center justify-center gap-2 mt-2"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate Market
          </button>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 mt-4">
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
                    className={`absolute top-0 bottom-0 border-l-2 ${isKnowledgeActive ? 'border-dashed' : ''} border-red-500/30 z-20 transition-all duration-500 ease-in-out`}
                    style={{ left: `${currentStepData.threshold * 100}%`, opacity: currentStepData.threshold > 1 || currentStepData.threshold < 0 ? 0 : 1 }}
                  />

                  {/* Public Knowledge Line (Top) */}
                   <div 
                    className="absolute top-0 bottom-0 border-l-2 border-dashed border-black z-20 transition-all duration-500 ease-in-out"
                    style={{ left: `${publicKnowledge * 100}%` }}
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
                  className={`absolute top-0 bottom-0 border-l-2 ${isKnowledgeActive ? 'border-dashed' : ''} border-red-500 z-20 transition-all duration-500 ease-in-out flex flex-col justify-end pb-2`}
                  style={{ left: `${currentStepData.threshold * 100}%`, opacity: currentStepData.threshold > 1 || currentStepData.threshold < 0 ? 0 : 1 }}
                >
                  <span className="text-xs font-bold text-red-500 bg-white/80 px-1 ml-1 whitespace-nowrap flex items-center">
                    <Latex>{`A^* = `}</Latex> {currentStepData.threshold.toFixed(3)}
                  </span>
                </div>

                {/* Public Knowledge Line (Bottom) */}
                <div 
                  className="absolute top-0 bottom-0 border-l-2 border-dashed border-black z-20 transition-all duration-500 ease-in-out flex flex-col justify-end pb-8"
                  style={{ left: `${publicKnowledge * 100}%` }}
                >
                  <span className="text-xs font-bold text-black bg-white/80 px-1 ml-1 whitespace-nowrap flex items-center">
                    <Latex>{`A^p`}</Latex>
                  </span>
                </div>

                {/* Particles */}
                {currentStepData.data.map((point) => {
                  let colorClass = "bg-indigo-500";
                  let opacity = 1;
                  let scale = 1;
                  
                  if (point.status === 'eliminated_now') {
                    colorClass = "bg-red-500";
                    scale = 1.2;
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