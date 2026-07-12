(() => {
  const canvas = document.querySelector('#blackhole-canvas');
  if (!canvas) return;

  const massInput = document.querySelector('#mass-control');
  const spinInput = document.querySelector('#spin-control');
  const diskInput = document.querySelector('#disk-control');
  const massReadout = document.querySelector('[data-mass-readout]');
  const spinReadout = document.querySelector('[data-spin-readout]');
  const fpsReadout = document.querySelector('[data-fps-readout]');
  const panel = document.querySelector('[data-sim-panel]');
  const panelToggle = document.querySelector('[data-panel-toggle]');
  const pauseButton = document.querySelector('[data-sim-pause]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const captureMode = new URLSearchParams(window.location.search).has('capture');

  const state = {
    mass: Number(massInput?.value || 1.15),
    spin: Number(spinInput?.value || 0.68),
    brightness: Number(diskInput?.value || 1),
    running: !reduceMotion,
    elapsed: 0,
    lastFrame: performance.now(),
    renderScale: 1
  };

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  });

  if (!gl) {
    canvas.hidden = true;
    document.documentElement.classList.add('no-webgl');
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform vec2 u_center;
    uniform float u_time;
    uniform float u_mass;
    uniform float u_spin;
    uniform float u_brightness;

    #define PI 3.141592653589793
    #define TAU 6.283185307179586
    #define STEPS 88

    float hash11(float p) {
      p = fract(p * 0.1031);
      p *= p + 33.33;
      p *= p + p;
      return fract(p);
    }

    float hash21(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float noise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amp = 0.5;
      mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
      for (int i = 0; i < 5; i++) {
        value += amp * noise2(p);
        p = rot * p * 2.02 + 17.17;
        amp *= 0.5;
      }
      return value;
    }

    vec2 sphereUv(vec3 d) {
      d = normalize(d);
      return vec2(atan(d.z, d.x) / TAU + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
    }

    float starLayer(vec2 uv, float scale, float seed) {
      uv.x *= 2.0;
      vec2 p = uv * scale;
      vec2 id = floor(p);
      vec2 gv = fract(p) - 0.5;
      float n = hash21(id + seed);
      vec2 offset = vec2(hash21(id + seed + 3.1), hash21(id + seed + 9.7)) - 0.5;
      float d = length(gv - offset * 0.72);
      float size = mix(0.010, 0.040, pow(n, 12.0));
      float star = smoothstep(size, 0.0, d) * smoothstep(0.973, 0.9995, n);
      float flare = smoothstep(size * 4.0, 0.0, abs(gv.x - offset.x * 0.72))
                  * smoothstep(size * 0.7, 0.0, abs(gv.y - offset.y * 0.72));
      flare += smoothstep(size * 4.0, 0.0, abs(gv.y - offset.y * 0.72))
             * smoothstep(size * 0.7, 0.0, abs(gv.x - offset.x * 0.72));
      return star + flare * 0.08 * smoothstep(0.997, 1.0, n);
    }

    vec3 sky(vec3 dir) {
      vec2 uv = sphereUv(dir);
      float s1 = starLayer(uv, 110.0, 1.0);
      float s2 = starLayer(uv + vec2(0.173, 0.317), 210.0, 17.0) * 0.55;
      float s3 = starLayer(uv + vec2(0.417, 0.093), 390.0, 43.0) * 0.28;

      float galactic = exp(-pow((dir.y + 0.11 * sin(dir.x * 4.0)) / 0.20, 2.0));
      float nebula = fbm(uv * vec2(4.0, 7.0) + vec2(3.2, -1.6));
      nebula = smoothstep(0.38, 0.82, nebula) * galactic;

      vec3 col = vec3(0.0007, 0.0010, 0.0021);
      col += vec3(0.006, 0.010, 0.021) * galactic * (0.35 + 0.65 * nebula);
      col += vec3(0.58, 0.70, 1.00) * (s1 + s2 + s3);
      return col;
    }

    vec3 blackbody(float t) {
      t = clamp(t, 0.0, 1.25);
      vec3 deep = vec3(0.16, 0.008, 0.001);
      vec3 red = vec3(0.75, 0.055, 0.006);
      vec3 amber = vec3(1.00, 0.28, 0.025);
      vec3 white = vec3(1.00, 0.91, 0.72);
      vec3 blueWhite = vec3(0.74, 0.86, 1.00);
      vec3 col = mix(deep, red, smoothstep(0.03, 0.28, t));
      col = mix(col, amber, smoothstep(0.24, 0.58, t));
      col = mix(col, white, smoothstep(0.54, 0.91, t));
      col = mix(col, blueWhite, smoothstep(0.93, 1.18, t));
      return col;
    }

    float diskDensity(vec3 hit, float innerR, float outerR, float spin, float time) {
      float r = length(hit.xz);
      float a = atan(hit.z, hit.x);
      float radial = clamp((r - innerR) / max(outerR - innerR, 0.001), 0.0, 1.0);
      float orbital = time * (0.40 + spin * 0.55) / max(pow(r, 1.45), 0.45);
      float spiralA = a - orbital;

      float coarse = fbm(vec2(log(max(r, 0.001)) * 5.2 - spiralA * 1.7, spiralA * 2.5));
      float fine = fbm(vec2(log(max(r, 0.001)) * 16.0 + spiralA * 3.0, spiralA * 7.0 - time * 0.13));
      float strands = 0.5 + 0.5 * sin(log(max(r, 0.001)) * 44.0 - spiralA * (9.0 + spin * 8.0) + coarse * 4.8);
      strands = smoothstep(0.16, 0.94, strands);

      float taper = smoothstep(innerR, innerR * 1.18, r)
                  * (1.0 - smoothstep(outerR * 0.80, outerR, r));
      float body = mix(0.45, 1.0, coarse) * mix(0.68, 1.0, fine);
      body *= mix(0.70, 1.15, strands);
      body *= mix(1.08, 0.56, radial);
      return clamp(body * taper, 0.0, 1.25);
    }

    vec3 diskEmission(vec3 hit, vec3 photonDir, float rs, float innerR, float outerR, float spin, float brightness, float time, out float alpha) {
      float r = length(hit.xz);
      float radial = clamp((r - innerR) / max(outerR - innerR, 0.001), 0.0, 1.0);
      float density = diskDensity(hit, innerR, outerR, spin, time);

      float nt = pow(max(innerR / max(r, innerR), 0.0), 0.75)
               * pow(max(1.0 - sqrt(innerR / max(r, innerR + 0.001)), 0.0), 0.25);
      nt = clamp(nt * 2.35, 0.0, 1.0);

      vec3 orbitalDir = normalize(vec3(-hit.z, 0.0, hit.x));
      float beta = clamp(0.22 + 0.46 * sqrt(rs / max(2.0 * (r - rs * 0.62), 0.25)), 0.18, 0.72);
      beta *= mix(0.86, 1.10, spin);
      float gamma = inversesqrt(max(1.0 - beta * beta, 0.08));
      float mu = dot(orbitalDir, -normalize(photonDir));
      float doppler = 1.0 / max(gamma * (1.0 - beta * mu), 0.18);
      float grav = sqrt(max(1.0 - rs / max(r, rs + 0.001), 0.03));
      float shift = clamp(doppler * grav, 0.38, 1.65);

      float heat = clamp(nt * (0.72 + 0.46 * shift), 0.0, 1.22);
      vec3 col = blackbody(heat);
      float beaming = pow(doppler, 3.0);
      float emissive = density * (0.30 + 1.75 * nt) * beaming * brightness;
      emissive *= mix(0.72, 1.0, 1.0 - radial);

      alpha = clamp(density * (0.48 + 0.48 * nt), 0.18, 0.94);
      return col * emissive;
    }

    void main() {
      vec2 frag = v_uv;
      float aspect = u_resolution.x / max(u_resolution.y, 1.0);
      vec2 screen = (frag - u_center) * vec2(aspect, 1.0);

      float massN = clamp((u_mass - 0.60) / 1.60, 0.0, 1.0);
      float spin = clamp(u_spin, 0.0, 0.99);
      float rs = mix(0.54, 0.72, massN);

      vec3 ro = vec3(0.0, 1.12, 5.65);
      vec3 target = vec3(0.0, 0.02, 0.0);
      vec3 forward = normalize(target - ro);
      vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
      vec3 up = normalize(cross(right, forward));
      vec3 rd = normalize(forward * 1.80 + right * screen.x + up * screen.y);

      float innerR = rs * mix(2.92, 1.42, spin);
      float outerR = rs * 7.20;
      float photonSphere = rs * 1.50;

      vec3 pos = ro;
      vec3 vel = rd;
      vec3 colour = vec3(0.0);
      float transmittance = 1.0;
      float ringPath = 0.0;
      float corona = 0.0;
      vec3 diskGlow = vec3(0.0);
      bool swallowed = false;
      bool escaped = false;
      float previousY = pos.y;

      for (int i = 0; i < STEPS; i++) {
        float r = length(pos);
        if (r < rs * 1.002) {
          swallowed = true;
          break;
        }
        if (r > 8.8 && dot(pos, vel) > 0.0 && i > 18) {
          escaped = true;
          break;
        }

        float stepSize = clamp((r - rs) * 0.055, 0.010, 0.105);
        vec3 angularMomentum = cross(pos, vel);
        float h2 = dot(angularMomentum, angularMomentum);
        vec3 acceleration = -1.5 * rs * h2 * pos / max(pow(r, 5.0), 0.0004);

        // Small frame-dragging-inspired twist. It is deliberately restrained so the lens remains coherent.
        vec3 dragAxis = vec3(0.0, 1.0, 0.0);
        vec3 frameDrag = cross(dragAxis, pos) * (spin * rs * rs / max(pow(r, 4.2), 0.08)) * 0.25;

        vel = normalize(vel + (acceleration + frameDrag) * stepSize);
        vec3 previous = pos;
        pos += vel * stepSize;

        float currentY = pos.y;
        if (previousY * currentY <= 0.0) {
          float crossDenom = previousY - currentY;
          if (abs(crossDenom) < 0.000001) crossDenom = crossDenom < 0.0 ? -0.000001 : 0.000001;
          float crossT = clamp(previousY / crossDenom, 0.0, 1.0);
          vec3 hit = mix(previous, pos, crossT);
          float diskR = length(hit.xz);
          if (diskR > innerR && diskR < outerR && transmittance > 0.02) {
            float alpha;
            vec3 emission = diskEmission(hit, vel, rs, innerR, outerR, spin, u_brightness, u_time, alpha);
            colour += transmittance * emission * alpha;
            transmittance *= (1.0 - alpha * 0.82);
          }
        }
        previousY = currentY;

        float ringWidth = rs * 0.036;
        ringPath += exp(-pow((r - photonSphere) / ringWidth, 2.0)) * stepSize;

        float diskRNow = length(pos.xz);
        float coronaMask = exp(-abs(pos.y) / (rs * 0.18));
        coronaMask *= smoothstep(innerR * 0.80, innerR * 1.22, diskRNow)
                    * (1.0 - smoothstep(outerR * 0.55, outerR, diskRNow));
        corona += coronaMask * stepSize * 0.018;

        float atmosphere = exp(-abs(pos.y) / (rs * 0.095));
        atmosphere *= smoothstep(innerR * 0.88, innerR * 1.18, diskRNow)
                    * (1.0 - smoothstep(outerR * 0.70, outerR, diskRNow));
        if (atmosphere > 0.001) {
          float localHeat = clamp(pow(innerR / max(diskRNow, innerR), 0.82) * 1.16, 0.0, 1.0);
          vec3 localOrbit = normalize(vec3(-pos.z, 0.0, pos.x));
          float localBeam = 0.72 + 0.70 * max(dot(localOrbit, -vel), -0.35) * spin;
          diskGlow += blackbody(localHeat) * atmosphere * stepSize * 0.026 * max(localBeam, 0.35);
        }
      }

      if (!swallowed) {
        colour += transmittance * sky(vel);
      }

      float viewDoppler = 0.5 + 0.5 * dot(normalize(vec3(1.0, 0.0, 0.0)), normalize(vec3(vel.x, 0.0, vel.z)));
      vec3 ringColour = mix(vec3(1.0, 0.31, 0.035), vec3(0.86, 0.94, 1.0), smoothstep(0.62, 0.95, viewDoppler) * spin);
      colour += ringColour * min(ringPath * ringPath * 0.22, 2.2) * u_brightness;
      colour += diskGlow * u_brightness;
      colour += vec3(0.20, 0.30, 0.55) * corona * u_brightness;

      if (swallowed) {
        colour *= 0.12;
      }

      float vignette = 1.0 - smoothstep(0.24, 0.96, length((frag - 0.5) * vec2(0.86, 1.0)));
      colour *= mix(0.48, 1.0, vignette);

      float grain = hash21(gl_FragCoord.xy + fract(u_time) * 113.7) - 0.5;
      colour += grain * 0.0045;

      // Filmic exposure and restrained highlight roll-off.
      colour = 1.0 - exp(-colour * 0.78);
      colour = colour / (colour + vec3(0.155));
      colour = pow(max(colour, 0.0), vec3(0.92));

      gl_FragColor = vec4(colour, 1.0);
    }
  `;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  };

  let program;
  try {
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Unable to link black-hole shader');
    }
  } catch (error) {
    console.error('Black-hole renderer failed:', error);
    canvas.hidden = true;
    document.documentElement.classList.add('no-webgl');
    return;
  }

  gl.useProgram(program);
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    center: gl.getUniformLocation(program, 'u_center'),
    time: gl.getUniformLocation(program, 'u_time'),
    mass: gl.getUniformLocation(program, 'u_mass'),
    spin: gl.getUniformLocation(program, 'u_spin'),
    brightness: gl.getUniformLocation(program, 'u_brightness')
  };

  let cssWidth = 1;
  let cssHeight = 1;
  let frameCount = 0;
  let fpsStart = performance.now();
  let animationFrame = 0;
  let lowFpsWindows = 0;

  const resize = () => {
    cssWidth = Math.max(1, canvas.parentElement?.clientWidth || window.innerWidth);
    cssHeight = Math.max(1, canvas.parentElement?.clientHeight || window.innerHeight);
    const dprCap = cssWidth < 760 ? 0.88 : 1.00;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap) * state.renderScale;
    const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      gl.viewport(0, 0, pixelWidth, pixelHeight);
    }
  };

  const updateReadouts = () => {
    if (massReadout) massReadout.textContent = `${state.mass.toFixed(2)} M⊙`;
    if (spinReadout) spinReadout.textContent = state.spin.toFixed(2);
  };

  const draw = (now) => {
    resize();
    const delta = Math.min(50, now - state.lastFrame) / 1000;
    state.lastFrame = now;
    if (state.running) state.elapsed += delta;

    const centerX = cssWidth < 760 ? 0.57 : 0.665;
    const centerY = cssWidth < 760 ? 0.44 : 0.46;

    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.center, centerX, centerY);
    gl.uniform1f(uniforms.time, state.elapsed);
    gl.uniform1f(uniforms.mass, state.mass);
    gl.uniform1f(uniforms.spin, state.spin);
    gl.uniform1f(uniforms.brightness, state.brightness);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    frameCount += 1;
    if (now - fpsStart >= 900) {
      const fps = Math.round((frameCount * 1000) / (now - fpsStart));
      if (fpsReadout) fpsReadout.textContent = String(fps);

      if (fps < 34 && state.renderScale > 0.72) {
        lowFpsWindows += 1;
        if (lowFpsWindows >= 2) {
          state.renderScale = Math.max(0.72, state.renderScale - 0.10);
          lowFpsWindows = 0;
          resize();
        }
      } else {
        lowFpsWindows = 0;
      }

      frameCount = 0;
      fpsStart = now;
    }

    if (!captureMode) animationFrame = requestAnimationFrame(draw);
  };

  const resetFrameClock = () => {
    state.lastFrame = performance.now();
  };

  massInput?.addEventListener('input', () => {
    state.mass = Number(massInput.value);
    updateReadouts();
  });
  spinInput?.addEventListener('input', () => {
    state.spin = Number(spinInput.value);
    updateReadouts();
  });
  diskInput?.addEventListener('input', () => {
    state.brightness = Number(diskInput.value);
  });
  panelToggle?.addEventListener('click', () => panel?.classList.toggle('is-hidden'));
  pauseButton?.addEventListener('click', () => {
    state.running = !state.running;
    resetFrameClock();
    pauseButton.textContent = state.running ? 'Pause field' : 'Resume field';
    pauseButton.setAttribute('aria-pressed', String(!state.running));
  });

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', resetFrameClock);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    cancelAnimationFrame(animationFrame);
  });

  if (reduceMotion && pauseButton) {
    pauseButton.textContent = 'Resume field';
    pauseButton.setAttribute('aria-pressed', 'true');
  }

  resize();
  updateReadouts();
  animationFrame = requestAnimationFrame(draw);
})();
