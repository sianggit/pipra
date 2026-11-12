/**
 * Pipra 3D Animated Loading Screen & Page Transition Engine
 * Real extruded geometry wing flapping with Three.js
 */

import { D } from './loading-data.js';

let fullScreenBirdScene = null;
let msgIntervalId = null;

/**
 * Reusable 3D Pipra Bird scene factory
 */
export function createBirdScene(canvas, options = {}) {
  if (!canvas || typeof window.THREE === 'undefined') return null;
  const THREE = window.THREE;
  const scale = options.scale || 0.0108;
  const showRing = options.showRing !== false;
  const enablePointer = options.enablePointer !== false;
  const shadowEl = options.shadowEl || null;

  const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (THREE.sRGBEncoding) R.outputEncoding = THREE.sRGBEncoding;

  const S = new THREE.Scene();
  const C = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  C.position.set(0, 0.2, options.cameraZ || 25);

  S.add(new THREE.HemisphereLight(0xdbe8ff, 0x1b1f66, 0.95));
  const L = new THREE.DirectionalLight(0xffffff, 1);
  L.position.set(-4, 7, 9);
  S.add(L);

  const r1 = new THREE.PointLight(0x6EA8FE, 2.2, 40);
  const r2 = new THREE.PointLight(0x8B5CF6, 2, 40);
  S.add(r1, r2);

  const tex = new THREE.TextureLoader().load(D.tex);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  if (R.capabilities && R.capabilities.getMaxAnisotropy) {
    tex.anisotropy = R.capabilities.getMaxAnisotropy();
  }

  const BX = 145, BY = 130, BS = 960, CX = 626, CY = 610;
  const AX = new THREE.Vector3(0.68, -0.733, 0).normalize();
  const cap = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.55,
    roughness: 0.4,
    metalness: 0.1,
  });

  const bird = new THREE.Group();
  const rig = new THREE.Group();
  rig.position.set(-CX, CY, 0);
  bird.add(rig);
  bird.scale.setScalar(scale);
  S.add(bird);

  const cfg = {
    upper: { p: [845, 665], z: 16, a: 0.62, ph: 0, bias: 0.12 },
    mid: { p: [792, 728], z: 2, a: 0.55, ph: 0.5, bias: 0.08 },
    lower: { p: [792, 728], z: -12, a: 0.46, ph: 1, bias: 0.04 },
    head: { p: [800, 640], z: 6 },
  };

  const P = {};
  const geometries = [];
  const materials = [cap];

  D.parts.forEach(pt => {
    const c = cfg[pt.n];
    const sh = new THREE.Shape(pt.pts.map(q => new THREE.Vector2(q[0], -q[1])));
    const dep = pt.n === 'head' ? 24 : 18;
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: dep,
      bevelEnabled: true,
      bevelThickness: 4,
      bevelSize: 2,
      bevelSegments: 2,
      curveSegments: 1,
    });
    geometries.push(g);
    const ps = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < ps.count; i++) {
      uv.setXY(i, (ps.getX(i) - BX) / BS, 1 - (-ps.getY(i) - BY) / BS);
    }
    g.translate(-c.p[0], c.p[1], -dep / 2);
    const side = new THREE.MeshStandardMaterial({
      color: pt.col,
      emissive: pt.col,
      emissiveIntensity: 0.3,
      roughness: 0.5,
      metalness: 0.15,
    });
    materials.push(side);
    const m = new THREE.Mesh(g, [cap, side]);
    const piv = new THREE.Group();
    piv.position.set(c.p[0], -c.p[1], c.z);
    piv.add(m);
    rig.add(piv);
    P[pt.n] = { piv, g, base: ps.array.slice(), c };
  });

  let ring = null;
  let dot = null;
  if (showRing) {
    ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.6, 0.012, 8, 160),
      new THREE.MeshBasicMaterial({ color: 0x6EA8FE, transparent: true, opacity: 0.35 })
    );
    ring.rotation.x = 1.25;
    S.add(ring);

    dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x9BC5FF })
    );
    S.add(dot);
  }

  function size() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth || canvas.clientWidth || 300;
    const h = parent.clientHeight || canvas.clientHeight || 200;
    if (w === 0 || h === 0) return;
    R.setSize(w, h, false);
    C.aspect = w / h;
    C.position.z = (w / h < 1.2) ? (options.cameraZ || 25) * 1.2 : (options.cameraZ || 25);
    C.updateProjectionMatrix();
  }

  let resizeObserver = null;
  if (window.ResizeObserver && canvas.parentElement) {
    resizeObserver = new ResizeObserver(size);
    resizeObserver.observe(canvas.parentElement);
  }
  size();

  let px = 0, py = 0, tx = 0, ty = 0;
  let pointerListener = null;
  if (enablePointer) {
    pointerListener = (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', pointerListener);
  }

  const W = 2 * Math.PI / 1.35;

  function pose(t) {
    const w = W * t;
    ['upper', 'mid', 'lower'].forEach(k => {
      const o = P[k];
      if (!o) return;
      const c = o.c;
      const a = c.bias + c.a * (Math.sin(w - c.ph) + 0.22 * Math.sin(2 * w - 2 * c.ph + 0.9));
      o.piv.quaternion.setFromAxisAngle(AX, a);
      const ps = o.g.attributes.position;
      const b = o.base;
      for (let i = 0; i < ps.count; i++) {
        const x = b[i * 3];
        const y = b[i * 3 + 1];
        const r = Math.abs(x * AX.y - y * AX.x);
        const u = r * 0.012;
        ps.array[i * 3 + 2] = b[i * 3 + 2] + 1.1 * u * u * Math.sin(w - c.ph - r * 0.004);
      }
      ps.needsUpdate = true;
    });

    if (P.head && P.head.piv) {
      const h = P.head.piv;
      h.rotation.z = 0.05 * Math.sin(w - 1.1);
      h.rotation.y = 0.12 * Math.sin(w * 0.5);
      h.position.y = -640 + 4 * Math.sin(w - 0.8);
    }

    px += (tx - px) * 0.06;
    py += (ty - py) * 0.06;

    bird.rotation.set(
      0.1 * Math.sin(w + 0.6) + py * 0.18,
      0.5 * Math.sin(t * 0.55) + px * 0.3,
      0.07 * Math.sin(t * 0.55 + 1.3) + 0.05 * Math.sin(w + 1.8)
    );
    bird.position.set(0.12 * Math.sin(t * 0.55), 0.2 * Math.sin(w - 0.7) + 0.05, 0);

    r1.position.set(Math.cos(t * 0.9) * 7, Math.sin(t * 0.7) * 3 + 2, 5);
    r2.position.set(-Math.cos(t * 0.8) * 7, -2, 4 + Math.sin(t) * 2);

    if (dot && ring) {
      const a = t * 1.15;
      dot.position.set(5.6 * Math.cos(a), 0, 5.6 * Math.sin(a)).applyEuler(ring.rotation);
    }

    if (shadowEl) {
      shadowEl.style.transform = `scale(${1 - 0.25 * Math.sin(w - 0.7)}, 1)`;
      shadowEl.style.opacity = String(0.85 - 0.2 * Math.sin(w - 0.7));
    }
  }

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();
  let frameId = null;
  let isRunning = true;

  function loop(now) {
    if (!isRunning) return;
    const t = (now - t0) / 1000;
    pose(t);
    R.render(S, C);
    if (!reduceMotion) {
      frameId = requestAnimationFrame(loop);
    }
  }

  pose(0.6);
  R.render(S, C);
  if (!reduceMotion) {
    frameId = requestAnimationFrame(loop);
  }

  return {
    resize: size,
    destroy: () => {
      isRunning = false;
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (pointerListener) {
        window.removeEventListener('pointermove', pointerListener);
        pointerListener = null;
      }
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      if (tex) tex.dispose();
      R.dispose();
    }
  };
}

export function renderLoadingScreenHtml() {
  return `
    <div id="pipra-loading-screen" class="pipra-loading-wrapper" aria-busy="true">
      <div class="world" aria-hidden="true">
        <div class="halo"></div>
        <div class="floor"></div>
        <div id="pipra-loading-sks"></div>
      </div>
      <main class="stage">
        <div class="scene" id="pipra-loading-scene" role="img" aria-label="Pipra bird logo flying">
          <div class="shd" id="pipra-loading-shd"></div>
          <canvas id="pipra-loading-canvas"></canvas>
        </div>
        <svg class="wm" viewBox="0 0 1368 448" role="img" aria-label="Pipra">
          <path fill-rule="evenodd" fill="currentColor" d="M388 121L383 124L381 130L381 371L386 377L389 378L455 378L462 373L463 368L462 126L457 121ZM1053 114L1047 112L1018 112L989 120L966 135L949 153L945 153L943 151L942 123L936 118L869 118L864 122L863 371L867 377L935 378L941 375L943 370L943 244L951 222L956 213L973 196L994 185L1004 183L1052 183L1056 181L1058 177L1058 121ZM784 143L768 131L748 120L713 112L673 112L635 122L631 126L613 136L594 154L589 155L586 150L587 127L581 120L517 119L510 122L508 126L508 447L589 447L588 358L589 350L593 345L597 346L619 365L660 382L717 383L728 381L764 366L778 356L799 335L806 326L822 293L828 255L828 238L822 202L816 187L806 168ZM656 176L677 176L708 186L724 198L734 210L743 231L743 264L732 288L718 302L705 310L680 318L649 317L629 311L614 302L602 290L594 278L588 254L588 242L592 221L605 202L614 193L626 185ZM1098 134L1096 139L1096 181L1097 185L1101 188L1110 184L1124 181L1132 176L1164 169L1188 167L1239 168L1261 175L1277 189L1281 198L1282 206L1281 209L1275 214L1180 214L1145 217L1132 222L1116 225L1088 240L1074 254L1067 264L1063 274L1060 293L1060 306L1064 330L1074 346L1084 357L1104 370L1136 382L1201 383L1211 381L1245 368L1266 354L1276 344L1283 342L1286 349L1285 369L1287 374L1291 377L1367 377L1367 190L1361 185L1358 169L1351 156L1334 136L1314 122L1291 113L1264 106L1226 104L1192 105L1151 113L1142 117L1125 120L1111 128L1103 130ZM1143 301L1142 288L1145 278L1154 269L1165 263L1193 257L1276 256L1280 257L1285 262L1285 274L1278 293L1261 310L1241 319L1210 325L1183 324L1157 317L1145 306ZM280 41L245 27L230 24L13 23L0 26L0 374L12 378L75 378L83 374L84 274L88 266L93 264L218 264L236 262L277 246L295 233L308 220L325 193L328 178L334 165L335 126L326 93L318 78L299 55ZM85 95L92 89L197 89L218 94L233 104L239 110L245 121L248 136L246 163L238 177L233 182L218 192L204 196L183 198L91 197L86 193L84 188ZM405 9L390 18L383 26L378 36L376 58L381 73L394 87L410 94L433 94L451 87L462 75L471 56L470 41L462 26L452 15L440 9L427 7Z"/>
        </svg>
        <div class="st">
          <div class="msg" id="pipra-loading-msg"></div>
          <div class="tr" role="progressbar" aria-label="Loading Pipra control plane"><i></i></div>
        </div>
      </main>
      <div class="tag">Build with confidence. Ship with control.</div>
    </div>
  `;
}

export function initLoadingScreen() {
  const skContainer = document.getElementById('pipra-loading-sks');
  if (skContainer && skContainer.children.length === 0) {
    for (let i = 0; i < 14; i++) {
      const d = document.createElement('div');
      d.className = 'sk';
      d.style.cssText = `top:${12 + Math.random() * 70}%;left:${70 + Math.random() * 40}%;width:${90 + Math.random() * 190}px;animation-duration:${1.1 + Math.random() * 1.6}s;animation-delay:${-Math.random() * 3}s`;
      skContainer.appendChild(d);
    }
  }

  const M = [
    'Connecting to control plane',
    'Checking execution agent heartbeats',
    'Loading deployment ledger',
    'Verifying environment health',
  ];
  const mg = document.getElementById('pipra-loading-msg');
  if (mg && mg.children.length === 0) {
    M.forEach((t, i) => {
      const s = document.createElement('span');
      s.textContent = t;
      if (!i) s.className = 'on';
      mg.appendChild(s);
    });
    let n = 0;
    if (msgIntervalId) clearInterval(msgIntervalId);
    msgIntervalId = setInterval(() => {
      const a = mg.children;
      if (!a || a.length === 0) return;
      a[n].classList.remove('on');
      n = (n + 1) % a.length;
      a[n].classList.add('on');
    }, 2200);
  }

  const cv = document.getElementById('pipra-loading-canvas');
  const shd = document.getElementById('pipra-loading-shd');
  if (cv && typeof window.THREE !== 'undefined') {
    fullScreenBirdScene = createBirdScene(cv, {
      scale: 0.0108,
      cameraZ: 25,
      showRing: true,
      enablePointer: true,
      shadowEl: shd,
    });
  }
}

export function hideLoadingScreen(durationMs = 400) {
  const el = document.getElementById('pipra-loading-screen');
  if (!el) return;

  el.classList.add('fade-out');

  setTimeout(() => {
    if (fullScreenBirdScene) {
      fullScreenBirdScene.destroy();
      fullScreenBirdScene = null;
    }
    if (msgIntervalId) {
      clearInterval(msgIntervalId);
      msgIntervalId = null;
    }
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }, durationMs);
}

/* ==========================================================================
   Page Transition Overlay Controller
   ========================================================================== */

let transitionOverlayEl = null;
let transitionBirdScene = null;
let transitionSafetyTimeoutId = null;

export function showPageTransition(label = 'Loading...') {
  if (!transitionOverlayEl) {
    transitionOverlayEl = document.createElement('div');
    transitionOverlayEl.id = 'pipra-page-transition';
    transitionOverlayEl.className = 'pipra-page-transition';
    transitionOverlayEl.setAttribute('aria-hidden', 'true');
    transitionOverlayEl.innerHTML = `
      <div class="transition-bird">
        <canvas id="transition-bird-canvas"></canvas>
      </div>
      <div class="transition-label">
        <span class="hero-pulse"></span>
        <span id="transition-label-text">${label}</span>
      </div>
    `;
    document.body.appendChild(transitionOverlayEl);
  }

  const labelEl = document.getElementById('transition-label-text');
  if (labelEl) labelEl.textContent = label;

  transitionOverlayEl.classList.add('active');

  const canvas = document.getElementById('transition-bird-canvas');
  if (canvas && !transitionBirdScene && typeof window.THREE !== 'undefined') {
    transitionBirdScene = createBirdScene(canvas, {
      scale: 0.0078,
      cameraZ: 22,
      showRing: false,
      enablePointer: false,
    });
  }

  if (transitionSafetyTimeoutId) clearTimeout(transitionSafetyTimeoutId);
  // Auto-dismiss safety barrier if route navigation stalls
  transitionSafetyTimeoutId = setTimeout(() => {
    hidePageTransition();
  }, 4000);
}

export function hidePageTransition() {
  if (transitionSafetyTimeoutId) {
    clearTimeout(transitionSafetyTimeoutId);
    transitionSafetyTimeoutId = null;
  }
  if (!transitionOverlayEl) return;
  transitionOverlayEl.classList.remove('active');
}
