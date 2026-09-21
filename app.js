/**
 * ROYAL CASHEW | 3D CINEMATIC SCROLL EXPERIENCE
 * High-performance canvas scrubbing engine with LERP physics & scroll-synced typography.
 */

(function () {
  'use strict';

  // --- CONFIGURATION ---
  const TOTAL_FRAMES = 300;
  // Default to false: directly uses images under 3D VIDEO HEROSECTION/ezgif-frame-xxx.png
  let useOptimizedAssets = false;

  function getFrameUrl(index, optimized = useOptimizedAssets) {
    const num = String(index + 1).padStart(3, '0');
    if (optimized) {
      return `frames_opt/frame-${num}.jpg`;
    } else {
      return encodeURI(`3D VIDEO HEROSECTION/ezgif-frame-${num}.png`);
    }
  }

  // --- DOM ELEMENTS ---
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const heroTrack = document.getElementById('heroScrollTrack');
  const scrollProgressLine = document.getElementById('scrollProgressLine');
  const meterBar = document.getElementById('meterBar');
  const statusPercent = document.getElementById('statusPercent');
  const preloader = document.getElementById('preloader');
  const heroPrompt = document.getElementById('heroPrompt');

  // Hero narrative card
  const heroCard = document.getElementById('heroCard') || document.getElementById('phase1');

  // HUD elements
  const hudFrame = document.getElementById('hudFrame');
  const hudScene = document.getElementById('hudScene');
  const timelineScrubber = document.getElementById('timelineScrubber');
  const autoplayBtn = document.getElementById('autoplayBtn');
  const playIcon = document.getElementById('playIcon');
  const playLabel = document.getElementById('playLabel');
  const qualityToggle = document.getElementById('qualityToggle');
  const qualityLabel = document.getElementById('qualityLabel');
  const soundToggle = document.getElementById('soundToggle');
  const soundIcon = document.getElementById('soundIcon');
  const replayHeroBtn = document.getElementById('replayHeroBtn');

  // --- STATE ---
  const images = new Array(TOTAL_FRAMES);
  let loadedCount = 0;
  let targetFrame = 0;
  let renderedFrame = 0;
  let isAutoplaying = false;
  let isScrubbing = false;
  let autoplayDirection = 1;
  let lastDrawnIndex = -1;

  // --- CANVAS RESIZE & RETINA SCALING ---
  let dpr = 1;
  let canvasWidth = 0;
  let canvasHeight = 0;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = Math.floor(canvasWidth * dpr);
    canvas.height = Math.floor(canvasHeight * dpr);
    ctx.scale(dpr, dpr);
    drawFrame(Math.round(renderedFrame), true);
  }

  window.addEventListener('resize', resizeCanvas);

  // --- FRAME DRAWING WITH OBJECT-FIT: COVER MATH ---
  function drawFrame(index, force = false) {
    const safeIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, index));
    if (!force && safeIndex === lastDrawnIndex) return;

    // Find the closest loaded frame if current isn't ready
    let img = images[safeIndex];
    if (!img || !img.complete || img.naturalWidth === 0) {
      // Look nearby
      for (let offset = 1; offset < 20; offset++) {
        const prev = images[safeIndex - offset];
        if (prev && prev.complete && prev.naturalWidth !== 0) {
          img = prev;
          break;
        }
        const next = images[safeIndex + offset];
        if (next && next.complete && next.naturalWidth !== 0) {
          img = next;
          break;
        }
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let drawW, drawH, drawX, drawY;

    if (canvasRatio > imgRatio) {
      drawW = canvasWidth;
      drawH = canvasWidth / imgRatio;
      drawX = 0;
      drawY = (canvasHeight - drawH) / 2;
    } else {
      drawH = canvasHeight;
      drawW = canvasHeight * imgRatio;
      drawX = (canvasWidth - drawW) / 2;
      drawY = 0;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    if (img === images[safeIndex]) {
      lastDrawnIndex = safeIndex;
    } else {
      lastDrawnIndex = -1;
    }
  }

  // --- PROGRESSIVE TWO-PHASE PRELOADER ---
  // Phase A: Preload Frame 1 immediately + initial keyframe set so scrub is instantly active
  // Phase B: Stream remaining frames smoothly in background with on-demand proximity boost
  const loadingStatus = new Uint8Array(TOTAL_FRAMES); // 0 = not started, 1 = loading, 2 = loaded, 3 = failed

  function loadSingleImage(index, onDone) {
    if (loadingStatus[index] >= 1) {
      if (onDone) onDone();
      return;
    }
    loadingStatus[index] = 1; // mark loading

    const img = new Image();
    img.decoding = 'async';
    img.src = getFrameUrl(index);
    img.onload = () => {
      images[index] = img;
      loadingStatus[index] = 2; // mark loaded
      loadedCount++;
      const pct = Math.min(100, Math.round((loadedCount / 15) * 100));
      if (meterBar) meterBar.style.width = `${pct}%`;
      if (statusPercent) statusPercent.textContent = `${pct}%`;

      if (loadedCount >= 15 && preloader && !preloader.classList.contains('hidden')) {
        preloader.classList.add('hidden');
      }
      if (Math.round(renderedFrame) === index) {
        drawFrame(index, true);
      }
      if (onDone) onDone();
    };
    img.onerror = () => {
      loadingStatus[index] = 3; // mark failed
      loadedCount++;
      if (onDone) onDone();
    };
  }

  // Priority window loading: fetch nearby frames around user's active frame
  function requestFramesNear(centerIdx, radius = 12) {
    const min = Math.max(0, centerIdx - radius);
    const max = Math.min(TOTAL_FRAMES - 1, centerIdx + radius);
    for (let i = min; i <= max; i++) {
      if (loadingStatus[i] === 0) {
        loadSingleImage(i);
      }
    }
  }

  function preloadImages() {
    loadedCount = 0;

    // Step 1: Preload Frame 1 immediately and paint to canvas
    const firstImg = new Image();
    firstImg.decoding = 'async';
    firstImg.src = getFrameUrl(0);
    images[0] = firstImg;
    loadingStatus[0] = 1;

    firstImg.onload = () => {
      loadingStatus[0] = 2;
      loadedCount++;
      resizeCanvas();
      drawFrame(0, true);
    };

    // Step 2: Queue first 25 frames + keyframe indices across the whole sequence
    const keyframes = [];
    for (let i = 1; i < Math.min(30, TOTAL_FRAMES); i++) {
      keyframes.push(i);
    }
    for (let i = 30; i < TOTAL_FRAMES; i += 4) {
      keyframes.push(i);
    }

    let keyIdx = 0;
    const concurrency = 6;
    function nextKey() {
      if (keyIdx >= keyframes.length) {
        // Once keyframes are underway, queue remaining frames in background
        loadRemainingBatch();
        return;
      }
      const cur = keyframes[keyIdx++];
      loadSingleImage(cur, nextKey);
    }

    for (let c = 0; c < concurrency; c++) {
      nextKey();
    }

    function loadRemainingBatch() {
      let remIdx = 0;
      function nextRem() {
        if (remIdx >= TOTAL_FRAMES) return;
        const cur = remIdx++;
        if (loadingStatus[cur] === 0) {
          loadSingleImage(cur, nextRem);
        } else {
          nextRem();
        }
      }
      for (let c = 0; c < 4; c++) {
        nextRem();
      }
    }
  }

  // --- SCROLL CALCULATION & SYNC ---
  function computeScrollProgress() {
    const trackRect = heroTrack.getBoundingClientRect();
    const scrollableDistance = trackRect.height - window.innerHeight;
    if (scrollableDistance <= 0) return 0;
    const scrolled = -trackRect.top;
    return Math.max(0, Math.min(1, scrolled / scrollableDistance));
  }

  window.addEventListener('scroll', () => {
    if (isAutoplaying || isScrubbing) return;
    const progress = computeScrollProgress();
    targetFrame = progress * (TOTAL_FRAMES - 1);
    requestFramesNear(Math.round(targetFrame), 10);
  }, { passive: true });

  // --- TIMELINE SCRUBBER DRAG INTERACTION ---
  if (timelineScrubber) {
    timelineScrubber.addEventListener('input', (e) => {
      isScrubbing = true;
      if (isAutoplaying) stopAutoplay();

      const val = parseFloat(e.target.value);
      targetFrame = val;
      renderedFrame = val;
      requestFramesNear(Math.round(val), 15);

      // Synchronize page scroll to match scrubber position
      const trackRect = heroTrack.getBoundingClientRect();
      const scrollableDist = trackRect.height - window.innerHeight;
      const targetScrollY = window.scrollY + trackRect.top + (val / (TOTAL_FRAMES - 1)) * scrollableDist;
      window.scrollTo({ top: targetScrollY, behavior: 'instant' });
    });

    timelineScrubber.addEventListener('change', () => {
      isScrubbing = false;
    });
  }

  // --- AUTOPLAY / CINEMATIC PLAYBACK ---
  if (autoplayBtn) {
    autoplayBtn.addEventListener('click', () => {
      if (isAutoplaying) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    });
  }

  function startAutoplay() {
    isAutoplaying = true;
    if (playIcon) playIcon.textContent = '⏸';
    if (playLabel) playLabel.textContent = 'PAUSE';
    if (autoplayBtn) autoplayBtn.style.borderColor = 'var(--gold-primary)';
  }

  function stopAutoplay() {
    isAutoplaying = false;
    if (playIcon) playIcon.textContent = '▶';
    if (playLabel) playLabel.textContent = 'AUTOPLAY';
    if (autoplayBtn) autoplayBtn.style.borderColor = '';
  }

  // Replay Story button
  if (replayHeroBtn) {
    replayHeroBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // --- QUALITY TOGGLE (3D VIDEO PNG vs OPTIMIZED JPG) ---
  qualityToggle.addEventListener('click', () => {
    useOptimizedAssets = !useOptimizedAssets;
    const dot = qualityToggle.querySelector('.pill-dot');
    if (useOptimizedAssets) {
      qualityLabel.textContent = 'OPTIMIZED HD (JPG)';
      if (dot) {
        dot.style.background = '#34d399';
        dot.style.boxShadow = '0 0 6px #34d399';
      }
    } else {
      qualityLabel.textContent = '3D VIDEO (PNG)';
      if (dot) {
        dot.style.background = '#e5aa42';
        dot.style.boxShadow = '0 0 6px #e5aa42';
      }
    }
    // Reload active frame in new quality
    const curIdx = Math.round(renderedFrame);
    const newImg = new Image();
    newImg.src = getFrameUrl(curIdx, useOptimizedAssets);
    newImg.onload = () => {
      images[curIdx] = newImg;
      drawFrame(curIdx, true);
    };
  });

  // --- SYNTHETIC ORCHARD AMBIENT AUDIO (Web Audio API) ---
  let audioCtx = null;
  let isAudioPlaying = false;
  let ambientGain = null;

  function initAmbientAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      // Create pink noise buffer for warm orchard wind breeze
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Filter to simulate soft leaves rustling
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, audioCtx.currentTime);

      ambientGain = audioCtx.createGain();
      ambientGain.gain.setValueAtTime(0.3, audioCtx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(ambientGain);
      ambientGain.connect(audioCtx.destination);
      whiteNoise.start();

      isAudioPlaying = true;
      soundIcon.textContent = '🔊';
      soundToggle.style.color = 'var(--gold-light)';
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  soundToggle.addEventListener('click', () => {
    if (!audioCtx) {
      initAmbientAudio();
    } else if (audioCtx.state === 'suspended') {
      audioCtx.resume();
      soundIcon.textContent = '🔊';
      soundToggle.style.color = 'var(--gold-light)';
    } else if (audioCtx.state === 'running') {
      audioCtx.suspend();
      soundIcon.textContent = '🔇';
      soundToggle.style.color = '';
    }
  });

  // --- SCROLL-DRIVEN HERO CARD ANIMATION ---
  // 0.00 - 0.20: Clean 3D Video Scrubbing (zero text overlay, pure 3D rotating cashew)
  // At 0.20: Hero card pops up and stays pinned for the remainder of the hero track (no text scrolling)
  function updateScrollDrivenText(progress) {
    // 1. Initial Hero Prompt (visible only at 0 scroll, vanishes smoothly as user begins scrolling)
    if (heroPrompt) {
      if (progress < 0.06) {
        const promptOpacity = Math.max(0, 1 - progress / 0.05);
        heroPrompt.style.opacity = promptOpacity.toFixed(2);
        heroPrompt.style.transform = `translateX(-50%) translateY(${(progress * 120).toFixed(1)}px)`;
        heroPrompt.style.visibility = promptOpacity > 0.02 ? 'visible' : 'hidden';
      } else {
        heroPrompt.style.opacity = '0';
        heroPrompt.style.visibility = 'hidden';
      }
    }

    // 2. Determine HUD scene label based on scroll progress
    let currentSceneLabel = '00 / 01 • THE ORCHARD';

    // 3. Scroll-Driven Hero Card Animation
    if (heroCard) {
      if (progress < 0.20) {
        // Below 20%: zero text on screen
        heroCard.style.opacity = '0';
        heroCard.style.visibility = 'hidden';
        heroCard.style.pointerEvents = 'none';
        heroCard.style.transform = 'translateY(40px) scale(0.96)';
        heroCard.style.filter = 'blur(8px)';
        heroCard.classList.remove('active');
      } else if (progress >= 0.20 && progress < 0.25) {
        // Entrance / Popup: punchy, smooth scale & fade up from bottom
        currentSceneLabel = '01 / 01 • ROYAL CASHEW';
        const t = (progress - 0.20) / (0.25 - 0.20);
        const easeOut = 1 - Math.pow(1 - t, 3);
        const y = (1 - easeOut) * 36;
        const blur = (1 - easeOut) * 8;
        const scale = 0.96 + easeOut * 0.04;
        heroCard.style.opacity = easeOut.toFixed(3);
        heroCard.style.visibility = 'visible';
        heroCard.style.transform = `translateY(${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
        heroCard.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
        heroCard.style.pointerEvents = easeOut > 0.7 ? 'auto' : 'none';
        if (easeOut > 0.5) heroCard.classList.add('active'); else heroCard.classList.remove('active');
      } else {
        // Peak Focus: full clarity and hold - firmly pinned, no scrolling text
        currentSceneLabel = '01 / 01 • ROYAL CASHEW';
        heroCard.style.opacity = '1';
        heroCard.style.visibility = 'visible';
        heroCard.style.transform = 'translateY(0px) scale(1)';
        heroCard.style.filter = 'none';
        heroCard.style.pointerEvents = 'auto';
        heroCard.classList.add('active');
      }
    }

    // Update HUD scene
    if (hudScene) {
      hudScene.textContent = currentSceneLabel;
    }
  }

  // --- MAIN ANIMATION & RENDER LOOP (60/120 FPS LERP) ---
  function animate() {
    // Autoplay progression
    if (isAutoplaying) {
      targetFrame += autoplayDirection * 0.6;
      if (targetFrame >= TOTAL_FRAMES - 1) {
        targetFrame = TOTAL_FRAMES - 1;
        autoplayDirection = -1; // Gentle ping-pong or wrap
      } else if (targetFrame <= 0) {
        targetFrame = 0;
        autoplayDirection = 1;
      }

      // Synchronize window scroll
      const trackRect = heroTrack.getBoundingClientRect();
      const scrollableDist = trackRect.height - window.innerHeight;
      const targetScrollY = window.scrollY + trackRect.top + (targetFrame / (TOTAL_FRAMES - 1)) * scrollableDist;
      window.scrollTo({ top: targetScrollY, behavior: 'instant' });
    }

    // LERP (Linear Interpolation) for buttery smooth frame transitions
    const diff = targetFrame - renderedFrame;
    if (Math.abs(diff) > 0.002) {
      renderedFrame += diff * 0.12;
    } else {
      renderedFrame = targetFrame;
    }

    const currentFrameInt = Math.round(renderedFrame);
    drawFrame(currentFrameInt);

    // Update HUD frame number
    if (hudFrame) {
      hudFrame.textContent = `${String(currentFrameInt + 1).padStart(3, '0')} / ${TOTAL_FRAMES}`;
    }

    // Update top progress line & scrubber slider
    const progress = renderedFrame / (TOTAL_FRAMES - 1);
    if (scrollProgressLine) {
      scrollProgressLine.style.width = `${(progress * 100).toFixed(2)}%`;
    }
    if (timelineScrubber && !isScrubbing) {
      timelineScrubber.value = currentFrameInt;
    }

    // Update synchronized continuous scroll-driven text
    updateScrollDrivenText(progress);

    requestAnimationFrame(animate);
  }

  // --- CART NOTIFICATION & FEEDBACK ENGINE ---
  function showToast(msg) {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    if (!toast) return;
    if (toastMsg) toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  function initProductsSection() {
    // 1. Filter Tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    const productCards = document.querySelectorAll('.products-grid .product-card');

    filterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        filterTabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');

        const filter = tab.getAttribute('data-filter');
        productCards.forEach((card) => {
          const category = card.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            card.classList.remove('hidden-category');
          } else {
            card.classList.add('hidden-category');
          }
        });
      });
    });

    // 2. Product Card Interactive Controls
    productCards.forEach((card) => {
      const priceAmount = card.querySelector('.price-amount');
      const selectedWeightLabel = card.querySelector('.selected-weight-label');
      const weightPills = card.querySelectorAll('.weight-pill');
      const qtyVal = card.querySelector('.qty-val');
      const minusBtn = card.querySelector('.qty-btn.minus');
      const plusBtn = card.querySelector('.qty-btn.plus');
      const addCartBtn = card.querySelector('.btn-add-cart');

      let currentUnitPrice = parseFloat(priceAmount ? priceAmount.getAttribute('data-unit-price') || '24.00' : '24.00');
      let currentWeight = selectedWeightLabel ? selectedWeightLabel.textContent.trim() : '500g Eco Pouch';
      let currentQty = 1;

      function updateCardPrice() {
        if (!priceAmount) return;
        const total = (currentUnitPrice * currentQty).toFixed(2);
        priceAmount.textContent = total;
      }

      // Weight selection
      weightPills.forEach((pill) => {
        pill.addEventListener('click', () => {
          weightPills.forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');

          currentWeight = pill.getAttribute('data-weight') || pill.textContent.trim();
          currentUnitPrice = parseFloat(pill.getAttribute('data-price') || '24.00');
          if (priceAmount) priceAmount.setAttribute('data-unit-price', currentUnitPrice.toFixed(2));
          if (selectedWeightLabel) selectedWeightLabel.textContent = currentWeight;
          updateCardPrice();
        });
      });

      // Quantity Stepper
      if (minusBtn) {
        minusBtn.addEventListener('click', () => {
          if (currentQty > 1) {
            currentQty--;
            if (qtyVal) qtyVal.textContent = currentQty;
            updateCardPrice();
          }
        });
      }

      if (plusBtn) {
        plusBtn.addEventListener('click', () => {
          if (currentQty < 99) {
            currentQty++;
            if (qtyVal) qtyVal.textContent = currentQty;
            updateCardPrice();
          }
        });
      }

      // Add to Cart
      if (addCartBtn) {
        addCartBtn.addEventListener('click', () => {
          const productName = card.getAttribute('data-name') || 'Royal Cashew Harvest';
          const totalAmount = (currentUnitPrice * currentQty).toFixed(2);

          showToast(`Added ${currentQty}× ${productName} (${currentWeight}) — $${totalAmount}`);

          // Visual feedback on button
          const originalContent = addCartBtn.innerHTML;
          addCartBtn.classList.add('added');
          addCartBtn.innerHTML = '<span class="btn-cart-icon">✓</span><span>Added to Cart</span>';

          setTimeout(() => {
            addCartBtn.classList.remove('added');
            addCartBtn.innerHTML = originalContent;
          }, 1800);
        });
      }
    });
  }

  // --- INITIALIZATION ---
  window.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    preloadImages();
    initProductsSection();
    requestAnimationFrame(animate);
  });

})();
