(() => {
    "use strict";
    
    const particleVS = `#version 300 es
    layout(location = 0) in vec2 a_pos;
    layout(location = 1) in float a_size;
    layout(location = 2) in vec4 a_color;
    layout(location = 3) in float a_type;
    layout(location = 4) in float a_seed;

    uniform float u_pixelRatio;

    out vec4 v_color;
    flat out float v_type;
    out float v_seed;

    void main() {
      v_color = a_color;
      v_type = a_type;
      v_seed = a_seed;
      gl_Position = vec4(a_pos, 0.0, 1.0);
      gl_PointSize = clamp(a_size * u_pixelRatio, 1.0, 128.0);
    }`;

    const particleFS = `#version 300 es
    precision highp float;

    in vec4 v_color;
    flat in float v_type;
    in float v_seed;

    uniform float u_time;
    uniform sampler2D u_sparkTex;

    out vec4 outColor;

    void main() {
      vec2 uv = gl_PointCoord;
      vec2 p = uv * 2.0 - 1.0;
      float r = length(p);

      if (v_type < 0.5) {
        vec4 tex = texture(u_sparkTex, uv);
        float flicker = 0.86 + 0.14 * sin(u_time * 18.0 + v_seed);
        outColor = vec4(v_color.rgb * tex.rgb, v_color.a * tex.a * flicker);
        return;
      }

      float shape = 0.0;
      if (v_type < 1.5) {
        float core = smoothstep(1.1, 0.0, r);
        float glow = smoothstep(1.0, 0.3, r) * 0.4;
        shape = core + glow;
      } else if (v_type < 2.5) {
        float x = abs(p.x);
        float y = uv.y;
        float body = smoothstep(0.18, 0.0, x);
        float tail = smoothstep(1.0, 0.2, y) * smoothstep(0.0, 0.2, y);
        shape = body * tail;
      } else if (v_type < 3.5) {
        float core = smoothstep(1.0, 0.15, r);
        float tw = 0.92 + 0.08 * sin(u_time * 6.0 + v_seed);
        shape = core * tw;
      } else {
        float core = smoothstep(1.0, 0.15, r);
        float glow = pow(max(0.0, 1.0 - r), 2.0);
        shape = core * 0.6 + glow * 0.4;
      }

      if (shape <= 0.01) discard;
      vec4 c = v_color;
      c.a *= shape;
      outColor = c;
    }`;

    const quadVS = `#version 300 es
    layout(location = 0) in vec2 a_pos;           // particle position
    layout(location = 1) in float a_size;         // particle size
    layout(location = 2) in vec4 a_color;         // particle color
    layout(location = 3) in float a_type;         // particle type
    layout(location = 4) in float a_seed;         // particle seed

    out vec4 v_color;
    flat out float v_type;
    out float v_seed;
    out vec2 v_uv;

    void main() {
      v_color = a_color;
      v_type = a_type;
      v_seed = a_seed;
      
      int vid = gl_VertexID % 4;
      vec2 a_local_pos;
      if (vid == 0) a_local_pos = vec2(-0.5, -0.5);
      else if (vid == 1) a_local_pos = vec2(0.5, -0.5);
      else if (vid == 2) a_local_pos = vec2(-0.5, 0.5);
      else a_local_pos = vec2(0.5, 0.5);
      
      v_uv = a_local_pos + 0.5;
      vec2 world_pos = a_pos + a_local_pos * (a_size * 0.01);
      gl_Position = vec4(world_pos, 0.0, 1.0);
    }`;

    const quadVS_instanced = `#version 300 es
    layout(location = 0) in vec2 a_local_pos;
    layout(location = 1) in vec2 a_pos;
    layout(location = 2) in float a_size;
    layout(location = 3) in vec4 a_color;
    layout(location = 4) in float a_type;
    layout(location = 5) in float a_seed;

    out vec4 v_color;
    flat out float v_type;
    out float v_seed;
    out vec2 v_uv;

    void main() {
      v_color = a_color;
      v_type = a_type;
      v_seed = a_seed;
      v_uv = a_local_pos + 0.5;

      vec2 world_pos = a_pos + a_local_pos * (a_size * 0.01);
      gl_Position = vec4(world_pos, 0.0, 1.0);
    }`;

    const quadFS = `#version 300 es
    precision highp float;

    in vec4 v_color;
    flat in float v_type;
    in float v_seed;
    in vec2 v_uv;

    uniform float u_time;

    out vec4 outColor;

    void main() {
      vec2 p = v_uv * 2.0 - 1.0;
      float r = length(p);

      if (r > 1.0) discard;
      float alpha = (1.0 - r * r) * v_color.a;
      
      if (v_type > 0.5) {
        float wobble = 0.8 + 0.2 * sin(u_time * 4.0 + v_seed);
        alpha *= wobble;
      }

      outColor = vec4(v_color.rgb, alpha);
    }`;

    const trailVS = `#version 300 es
    layout(location = 0) in vec2 a_pos;
    layout(location = 1) in vec4 a_color;

    out vec4 v_color;

    void main() {
      v_color = a_color;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

    const trailFS = `#version 300 es
    precision highp float;

    in vec4 v_color;
    out vec4 outColor;

    void main() {
      outColor = v_color;
    }`;

    const backgroundVS = `#version 300 es
    void main() {
      vec2 pos;
      if (gl_VertexID == 0) {
        pos = vec2(-1.0, -1.0);
      } else if (gl_VertexID == 1) {
        pos = vec2( 3.0, -1.0);
      } else {
        pos = vec2(-1.0,  3.0);
      }
      gl_Position = vec4(pos, 0.0, 1.0);
    }`;

    const backgroundFS = `#version 300 es
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;

    out vec4 outColor;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;

      vec3 top = vec3(0.025, 0.045, 0.085);
      vec3 bottom = vec3(0.075, 0.095, 0.155);
      vec3 col = mix(bottom, top, smoothstep(0.0, 1.0, uv.y));

      float horizon = exp(-12.0 * pow(uv.y - 0.18, 2.0));
      col += horizon * vec3(0.06, 0.04, 0.02);

      vec2 grid = vec2(180.0, 110.0);
      vec2 cell = uv * grid;
      vec2 g = floor(cell);
      vec2 f = fract(cell) - 0.5;

      float h = hash(g);
      if (h > 0.9945) {
        vec2 off = vec2(hash(g + 1.3), hash(g + 7.1)) * 0.18 - 0.09;
        float d = length(f - off);
        float star = exp(-140.0 * d * d);
        float twinkle = 0.65 + 0.35 * sin(u_time * 2.2 + h * 40.0);
        col += star * twinkle * vec3(1.0, 1.0, 1.0);
      }

      if (h > 0.9990) {
        vec2 off2 = vec2(hash(g + 12.7), hash(g + 31.8)) * 0.08 - 0.04;
        float d2 = length(f - off2);
        float glow = exp(-60.0 * d2 * d2);
        col += glow * vec3(0.9, 0.95, 1.0) * 0.7;
      }

      outColor = vec4(col, 1.0);
    }`;

    let canvas, gl, modeButtons, clearBtn, statsLine;

    function initializeDOM() {
      canvas = document.getElementById("glcanvas");
      gl = canvas.getContext("webgl2", { antialias: true, alpha: false });

      if (!gl) {
        alert("WebGL2 не поддерживается в этом браузере.");
        return false;
      }

      modeButtons = document.getElementById("ui");
      clearBtn = document.getElementById("clearBtn");
      statsLine = document.getElementById("statsLine");
      
      return true;
    }

    const MODE = {
      SPARKLER: "sparkler",
      SMOKE: "smoke",
      RAIN: "rain",
      SNOW: "snow",
      STEAM: "steam",
      VOID_SINGULARITY: "void_singularity",
      FIREWORK: "firework",
      SMOKE_5K_STD: "smoke_std",
      SMOKE_5K_INST: "smoke_inst",
      SMOKE_5K_QUAD_STD: "smoke_quad_std",
      SMOKE_5K_QUAD_INST: "smoke_quad_inst",
    };

    const MAX_PARTICLES = 100000;
    const MAX_TRAILS = 14000;
    const ATTRS_PER_PARTICLE = 9; // x, y, size, r, g, b, a, type, seed
    const TRAIL_FLOATS_PER_SEGMENT = 12; // 2 vertices * (x,y,r,g,b,a)
    const QUAD_VERTS_PER_PARTICLE = 4;

    const particles = [];
    const trails = [];

    const alphaData = new Float32Array(MAX_PARTICLES * ATTRS_PER_PARTICLE);
    const addData = new Float32Array(MAX_PARTICLES * ATTRS_PER_PARTICLE);
    const trailData = new Float32Array(MAX_TRAILS * TRAIL_FLOATS_PER_SEGMENT);
    
    const alphaDataQuad = new Float32Array(MAX_PARTICLES * QUAD_VERTS_PER_PARTICLE * ATTRS_PER_PARTICLE);
    const addDataQuad = new Float32Array(MAX_PARTICLES * QUAD_VERTS_PER_PARTICLE * ATTRS_PER_PARTICLE);

    const spawnAcc = {
      sparkler: 0,
      smoke: 0,
      steam: 0,
      cloud: 0,
      void_singularity: 0,
      rain: 0,
      snow: 0,
    };

    let mode = MODE.SPARKLER;
    let precipMode = "rain";
    let lastTime = performance.now();
    let elapsed = 0;
    let fireworkTimer = 0.0;
    let fireworkInterval = 1.7;
    
    let fps = 0;
    let frameCount = 0;
    let fpsTime = 0;
    
    let drawCallsLastFrame = 0;
    let drawCallsThisFrame = 0;

    function rand(min = 0, max = 1) {
      return min + Math.random() * (max - min);
    }

    function clamp(v, lo, hi) {
      return Math.max(lo, Math.min(hi, v));
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function smoothstep(edge0, edge1, x) {
      const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
      return t * t * (3 - 2 * t);
    }

    function compileShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader) || "Unknown shader compile error";
        gl.deleteShader(shader);
        throw new Error(info);
      }
      return shader;
    }

    function createProgram(gl, vsSource, fsSource) {
      const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      gl.deleteShader(vs);
      gl.deleteShader(fs);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program) || "Unknown program link error";
        throw new Error(info);
      }
      return program;
    }

    function makeFallbackSparkTexture(gl) {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d");

      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0.00, "rgba(255,255,255,1.0)");
      g.addColorStop(0.16, "rgba(255,245,210,0.96)");
      g.addColorStop(0.35, "rgba(255,190,80,0.70)");
      g.addColorStop(0.68, "rgba(255,120,30,0.18)");
      g.addColorStop(1.00, "rgba(0,0,0,0.0)");

      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);

      return tex;
    }

    function tryLoadSparkTexture(gl, texture) {
      const img = new Image();
      img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
      };
      img.onerror = () => {
      };
      img.src = "spark.png";
    }

    let particleProgram, trailProgram, backgroundProgram, instancedParticleProgram;
    let quadProgram, quadProgram_instanced;
    let particleVAO, particleVBO, trailVAO, trailVBO, backgroundVAO, instancedVAO, instancedVBO;
    let quadVAO, quadVBO, quadInstancedVBO, quadTemplateVAO, quadTemplateVBO;
    let bgUniforms, pUniforms, pInstancedUniforms, sparkTexture;
    let quadUniforms, quadInstancedUniforms;

    function initializeWebGL() {
      particleProgram = createProgram(gl, particleVS, particleFS);
      instancedParticleProgram = createProgram(gl, particleVS, particleFS);
      quadProgram = createProgram(gl, quadVS, quadFS);
      quadProgram_instanced = createProgram(gl, quadVS_instanced, quadFS);
      trailProgram = createProgram(gl, trailVS, trailFS);
      backgroundProgram = createProgram(gl, backgroundVS, backgroundFS);

      particleVAO = gl.createVertexArray();
      particleVBO = gl.createBuffer();

      instancedVAO = gl.createVertexArray();
      instancedVBO = gl.createBuffer();

      trailVAO = gl.createVertexArray();
      trailVBO = gl.createBuffer();

      backgroundVAO = gl.createVertexArray();

      gl.bindVertexArray(particleVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, particleVBO);
      gl.bufferData(gl.ARRAY_BUFFER, MAX_PARTICLES * ATTRS_PER_PARTICLE * 4, gl.DYNAMIC_DRAW);

      const particleStride = ATTRS_PER_PARTICLE * 4;

      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, particleStride, 0);

      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, particleStride, 2 * 4);

      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, particleStride, 3 * 4);

      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 1, gl.FLOAT, false, particleStride, 7 * 4);

      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 1, gl.FLOAT, false, particleStride, 8 * 4);

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      gl.bindVertexArray(instancedVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, instancedVBO);
      gl.bufferData(gl.ARRAY_BUFFER, MAX_PARTICLES * ATTRS_PER_PARTICLE * 4, gl.DYNAMIC_DRAW);

      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, particleStride, 0);
      gl.vertexAttribDivisor(0, 1);

      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, particleStride, 2 * 4);
      gl.vertexAttribDivisor(1, 1);

      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, particleStride, 3 * 4);
      gl.vertexAttribDivisor(2, 1);

      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 1, gl.FLOAT, false, particleStride, 7 * 4);
      gl.vertexAttribDivisor(3, 1);

      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 1, gl.FLOAT, false, particleStride, 8 * 4);
      gl.vertexAttribDivisor(4, 1);

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      gl.bindVertexArray(trailVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, trailVBO);
      gl.bufferData(gl.ARRAY_BUFFER, trailData.byteLength, gl.DYNAMIC_DRAW);

      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, TRAIL_FLOATS_PER_SEGMENT / 2 * 4, 0);

      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, TRAIL_FLOATS_PER_SEGMENT / 2 * 4, 2 * 4);

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      bgUniforms = {
        uResolution: gl.getUniformLocation(backgroundProgram, "u_resolution"),
        uTime: gl.getUniformLocation(backgroundProgram, "u_time"),
      };

      pUniforms = {
        uPixelRatio: gl.getUniformLocation(particleProgram, "u_pixelRatio"),
        uTime: gl.getUniformLocation(particleProgram, "u_time"),
        uSparkTex: gl.getUniformLocation(particleProgram, "u_sparkTex"),
      };

      pInstancedUniforms = {
        uPixelRatio: gl.getUniformLocation(instancedParticleProgram, "u_pixelRatio"),
        uTime: gl.getUniformLocation(instancedParticleProgram, "u_time"),
        uSparkTex: gl.getUniformLocation(instancedParticleProgram, "u_sparkTex"),
      };

      quadUniforms = {
        uTime: gl.getUniformLocation(quadProgram, "u_time"),
      };

      quadInstancedUniforms = {
        uTime: gl.getUniformLocation(quadProgram_instanced, "u_time"),
      };

      quadVAO = gl.createVertexArray();
      quadVBO = gl.createBuffer();

      gl.bindVertexArray(quadVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.bufferData(gl.ARRAY_BUFFER, MAX_PARTICLES * QUAD_VERTS_PER_PARTICLE * ATTRS_PER_PARTICLE * 4, gl.DYNAMIC_DRAW);

      const quadStride = ATTRS_PER_PARTICLE * 4;

      // Attribute 0: particle position (vec2)
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, quadStride, 0);

      // Attribute 1: particle size (float)
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, quadStride, 2 * 4);

      // Attribute 2: particle color (vec4)
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, quadStride, 3 * 4);

      // Attribute 3: particle type (float)
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 1, gl.FLOAT, false, quadStride, 7 * 4);

      // Attribute 4: particle seed (float)
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 1, gl.FLOAT, false, quadStride, 8 * 4);

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);


      quadInstancedVBO = gl.createBuffer();
      quadTemplateVAO = gl.createVertexArray();
      quadTemplateVBO = gl.createBuffer();

      const quadTemplate = new Float32Array([
        -0.5, -0.5,
         0.5, -0.5,
        -0.5,  0.5,
         0.5,  0.5,
      ]);

      gl.bindVertexArray(quadTemplateVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadTemplateVBO);
      gl.bufferData(gl.ARRAY_BUFFER, quadTemplate, gl.STATIC_DRAW);

      // Attribute 0: local quad vertex position (divisor=0, per-vertex)
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 2 * 4, 0);
      gl.vertexAttribDivisor(0, 0); // Per-vertex

      // Attribute 1: particle position (divisor=1, per-instance)
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, ATTRS_PER_PARTICLE * 4, 0);
      gl.vertexAttribDivisor(1, 1);

      // Attribute 2: particle size (divisor=1, per-instance)
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, ATTRS_PER_PARTICLE * 4, 2 * 4);
      gl.vertexAttribDivisor(2, 1);

      // Attribute 3: particle color (divisor=1, per-instance)
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, ATTRS_PER_PARTICLE * 4, 3 * 4);
      gl.vertexAttribDivisor(3, 1);

      // Attribute 4: particle type (divisor=1, per-instance)
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 1, gl.FLOAT, false, ATTRS_PER_PARTICLE * 4, 7 * 4);
      gl.vertexAttribDivisor(4, 1);

      // Attribute 5: particle seed (divisor=1, per-instance)
      gl.enableVertexAttribArray(5);
      gl.vertexAttribPointer(5, 1, gl.FLOAT, false, ATTRS_PER_PARTICLE * 4, 8 * 4);
      gl.vertexAttribDivisor(5, 1);

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      gl.bindVertexArray(quadTemplateVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadInstancedVBO);

      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, ATTRS_PER_PARTICLE * 4, 0);
      gl.vertexAttribDivisor(1, 1);

      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, ATTRS_PER_PARTICLE * 4, 2 * 4);
      gl.vertexAttribDivisor(2, 1);

      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, ATTRS_PER_PARTICLE * 4, 3 * 4);
      gl.vertexAttribDivisor(3, 1);

      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 1, gl.FLOAT, false, ATTRS_PER_PARTICLE * 4, 7 * 4);
      gl.vertexAttribDivisor(4, 1);

      gl.enableVertexAttribArray(5);
      gl.vertexAttribPointer(5, 1, gl.FLOAT, false, ATTRS_PER_PARTICLE * 4, 8 * 4);
      gl.vertexAttribDivisor(5, 1);

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      sparkTexture = makeFallbackSparkTexture(gl);
      tryLoadSparkTexture(gl, sparkTexture);

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
    }

    function makeParticle(params) {
      return {
        x: params.x ?? 0,
        y: params.y ?? 0,
        prevX: params.x ?? 0,
        prevY: params.y ?? 0,
        vx: params.vx ?? 0,
        vy: params.vy ?? 0,
        life: params.life ?? 1,
        age: 0,
        type: params.type ?? 0,
        seed: params.seed ?? Math.random() * 1000,
        drag: params.drag ?? 0,
        gravity: params.gravity ?? 0,
        wind: params.wind ?? 0,
        size0: params.size0 ?? 8,
        size1: params.size1 ?? 2,
        c0: params.c0 ?? [1, 1, 1, 1],
        c1: params.c1 ?? [1, 1, 1, 0],
        burstAt: params.burstAt ?? 0.72,
        exploded: false,
        variant: params.variant ?? 0,
        swirl: params.swirl ?? 0,
        wobble: params.wobble ?? 0,
        track: params.track ?? false,
        trailC0: params.trailC0 ?? [1, 1, 1, 1],
        trailC1: params.trailC1 ?? [1, 0.45, 0.12, 1],
        drawSize: params.size0 ?? 8,
        drawColor: params.c0 ?? [1, 1, 1, 1],
      };
    }

    function pushParticle(p) {
      if (particles.length < MAX_PARTICLES) particles.push(p);
    }

    function pushTrail(x0, y0, x1, y1, c0, c1, life = rand(0.10, 0.20)) {
      if (trails.length >= MAX_TRAILS) return;
      trails.push({
        x0, y0, x1, y1,
        c0: c0.slice ? c0.slice() : c0,
        c1: c1.slice ? c1.slice() : c1,
        age: 0,
        life,
      });
    }

    function setMode(newMode) {
      mode = newMode;
      particles.length = 0;
      trails.length = 0;
      for (const k of Object.keys(spawnAcc)) spawnAcc[k] = 0;
      fireworkTimer = 0;
      
      if (newMode === MODE.RAIN) precipMode = "rain";
      if (newMode === MODE.SNOW) precipMode = "snow";

      if (newMode === MODE.SMOKE_5K_STD || newMode === MODE.SMOKE_5K_INST) {
        const modeInfo = newMode === MODE.SMOKE_5K_STD ? 
          "Points: Standard drawArrays (5000 vertices)" : 
          "Points: GPU Instancing (1 vertex × 5000 instances)";
        console.log(`%c[PARTICLE MODE] ${modeInfo}`, "color: #4fa3ff; font-weight: bold;");
      }
      if (newMode === MODE.SMOKE_5K_QUAD_STD || newMode === MODE.SMOKE_5K_QUAD_INST) {
        const modeInfo = newMode === MODE.SMOKE_5K_QUAD_STD ? 
          "Quads: Standard drawArrays (20000 vertices)" : 
          "Quads: GPU Instancing (4 vertices × 5000 instances)";
        console.log(`%c[PARTICLE MODE] ${modeInfo}`, "color: #ff4fa3; font-weight: bold;");
      }
      
      updateUI();
    }

    function updateUI() {
      const names = {
        [MODE.SPARKLER]: "бенгальский огонь",
        [MODE.SMOKE]: "дым",
        [MODE.RAIN]: "дождь",
        [MODE.SNOW]: "снег",
        [MODE.STEAM]: "облако",
        [MODE.VOID_SINGULARITY]: "вакуум",
        [MODE.FIREWORK]: "фейерверк",
        [MODE.SMOKE_5K_STD]: "5000 Points Std",
        [MODE.SMOKE_5K_INST]: "5000 Points Inst",
        [MODE.SMOKE_5K_QUAD_STD]: "5000 Quads Std",
        [MODE.SMOKE_5K_QUAD_INST]: "5000 Quads Inst",
      };
    }

    function emitSparkler(dt) {
      const rate = 820;
      spawnAcc.sparkler += dt * rate;

      while (spawnAcc.sparkler >= 1) {
        spawnAcc.sparkler -= 1;

        const angle = rand(0, Math.PI * 2);
        const elevation = rand(Math.PI * 0.55, Math.PI * 0.70);
        const speed = rand(0.6, 1.0);

        const vx = Math.cos(elevation) * Math.cos(angle) * speed;
        const vy = Math.sin(elevation) * speed;

        pushParticle(makeParticle({
          x: rand(-0.03, 0.03),
          y: rand(-0.03, 0.03),
          vx,
          vy,
          life: rand(0.9, 1.5),
          type: 0,
          size0: rand(16, 24),
          size1: rand(0.3, 1),
          c0: [1.0, rand(0.80, 0.90), rand(0.15, 0.30), 1.0],
          c1: [0.92, 0.25, 0.0, 0.0],
          gravity: -1.4,
          drag: 0.88,
          wind: rand(-0.02, 0.02),
          swirl: rand(0.15, 0.5),
          track: true,
          trailC0: [1.0, 1.0, 1.0, 0.95],
          trailC1: [0.92, 0.25, 0.0, 0.0],
        }));
      }
    }

    function emitSmoke(dt) {
      const rate = 1000;
      spawnAcc.smoke += dt * rate;

      while (spawnAcc.smoke >= 1) {
        spawnAcc.smoke -= 1;
        
        const angle = rand(0, Math.PI);
        const distance = rand(0, 0.02);
        const spread = Math.cos(angle) * distance;
        const ySpread = Math.sin(angle) * distance;
        const spreadFactor = rand(0.04, 0.05);
        
        pushParticle(makeParticle({
          x: spread,
          y: ySpread - 0.3,
          vx: Math.cos(angle) * spreadFactor,
          vy: rand(0.16, 0.28),
          life: rand(2.8, 4.2),
          type: 1,
          size0: rand(24, 40),
          size1: rand(80, 135),
          c0: [0.62, 0.62, 0.65, 0.12],
          c1: [0.10, 0.10, 0.12, 0.0],
          gravity: -0.02,
          drag: 0,
          wind: rand(-0.02, 0.02),
          swirl: rand(0.6, 1.4),
          wobble: rand(7, 13),
        }));
      }
    }

    function emitSteam(dt) {
      const rate = 95;
      spawnAcc.steam += dt * rate;

      while (spawnAcc.steam >= 1) {
        spawnAcc.steam -= 1;
        
        const angle = rand(0, Math.PI * 2);
        const distance = rand(0, 0.05);
        
        pushParticle(makeParticle({
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 0.1,
          vx: Math.cos(angle) * rand(0.01, 0.05),
          vy: rand(0.22, 0.38),
          life: rand(2.2, 3.8),
          type: 1,
          size0: rand(18, 28),
          size1: rand(48, 72),
          c0: [0.92, 0.92, 0.95, 0.28],
          c1: [0.72, 0.78, 0.85, 0.0],
          gravity: -0.12,
          drag: 0.06,
          wind: rand(-0.02, 0.02),
          swirl: rand(0.3, 0.7),
          wobble: rand(7, 12),
        }));
      }
    }

    function emitCloud(dt) {
      const rate = 100;
      spawnAcc.cloud += dt * rate;
      
      while (spawnAcc.cloud >= 1) {
        spawnAcc.cloud -= 1; 
        const xSpread = rand(-0.6, 0.6);
        const ySpread = rand(-0.15, 0.15);
        
        const vx = rand(-0.001, 0.001);
        const vy = rand(-0.001, 0.002);
        
        pushParticle(makeParticle({
          x: xSpread,
          y: ySpread,
          vx,
          vy,
          life: rand(50.0, 75.0),
          type: 1,
          size0: rand(100, 150),
          size1: rand(160, 240),
          c0: [0.96, 0.96, 0.98, 0.06],
          c1: [0.80, 0.82, 0.87, 0.0],
          gravity: -0.001,
          drag: 0.15,
          wind: rand(-0.0008, 0.0008),
          swirl: rand(0.01, 0.04),
          wobble: rand(20, 36),
        }));
      }
    }

    function emitInkCloud(dt) {d
      const rate = 500;
      spawnAcc.void_singularity += dt * rate;
      
      while (spawnAcc.void_singularity >= 1) {
        spawnAcc.void_singularity -= 1;

        const angle = rand(0, Math.PI * 2);
        const distance = rand(0.5, 0.9);
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        
        const inwardSpeed = rand(0.3, 0.5);
        const orbitalSpeed = rand(0.25, 0.45);
        const tangentAngle = angle + Math.PI / 2;
        
        const vx = Math.cos(angle) * (-inwardSpeed) + Math.cos(tangentAngle) * orbitalSpeed;
        const vy = Math.sin(angle) * (-inwardSpeed) + Math.sin(tangentAngle) * orbitalSpeed;
        
        const colorChoice = Math.random();
        let c0, c1;
        if (colorChoice < 0.5) {
          c0 = [0.25, 0.12, 0.38, 0.55];
          c1 = [0.06, 0.02, 0.12, 0.0];
        } else if (colorChoice < 0.8) {
          c0 = [0.12, 0.22, 0.45, 0.52];
          c1 = [0.03, 0.06, 0.15, 0.0];
        } else {
          c0 = [0.15, 0.1, 0.25, 0.48];
          c1 = [0.03, 0.02, 0.08, 0.0];
        }
        
        pushParticle(makeParticle({
          x,
          y,
          vx,
          vy,
          life: rand(4.5, 6.5),
          type: 1,
          size0: rand(55, 95),
          size1: rand(100, 180),
          c0,
          c1,
          gravity: rand(-0.06, -0.01),
          drag: rand(0.08, 0.15),
          wind: 0,
          swirl: rand(0.4, 0.8),
          wobble: rand(6, 12),
        }));
      }
    }

    function emitRainOrSnow(dt) {
      const isRain = precipMode === "rain";
      const rate = isRain ? 320 : 170;
      const key = isRain ? "rain" : "snow";
      spawnAcc[key] += dt * rate;

      while (spawnAcc[key] >= 1) {
        spawnAcc[key] -= 1;

        const x = rand(-1.08, 1.08);
        const y = 1.14;

        if (isRain) {
          pushParticle(makeParticle({
            x,
            y,
            vx: rand(-0.02, 0.02),
            vy: rand(-1.65, -1.15),
            life: rand(0.85, 1.2),
            type: 2,
            size0: rand(8, 12),
            size1: rand(10, 14),
            c0: [0.70, 0.82, 1.0, 0.62],
            c1: [0.70, 0.82, 1.0, 0.0],
            gravity: 0.0,
            drag: 0.0,
            wind: rand(-0.08, 0.08),
          }));
        } else {
          pushParticle(makeParticle({
            x,
            y,
            vx: rand(-0.10, 0.10),
            vy: rand(-0.34, -0.18),
            life: rand(4.4, 6.2),
            type: 3,
            size0: rand(7, 11),
            size1: rand(9, 15),
            c0: [1.0, 1.0, 1.0, 0.84],
            c1: [0.98, 0.98, 1.0, 0.0],
            gravity: 0.0,
            drag: 0.0,
            wind: rand(-0.02, 0.02),
            swirl: rand(0.2, 0.7),
            wobble: rand(3, 7),
          }));
        }
      }
    }

    function emitSmoke5k(dt) {
      const rate = 1500;
      spawnAcc.smoke += dt * rate;

      while (spawnAcc.smoke >= 1) {
        spawnAcc.smoke -= 1;
        
        const angle = rand(0, Math.PI);
        const distance = rand(0, 0.02);
        const spread = Math.cos(angle) * distance;
        const ySpread = Math.sin(angle) * distance;
        
        const spreadFactor = rand(0.04, 0.05);
        
        pushParticle(makeParticle({
          x: spread,
          y: ySpread - 0.3,
          vx: Math.cos(angle) * spreadFactor,
          vy: rand(0.16, 0.28),
          life: rand(2.8, 4.2),
          type: 1,
          size0: rand(24, 40),
          size1: rand(80, 135),
          c0: [0.62, 0.62, 0.65, 0.12],
          c1: [0.10, 0.10, 0.12, 0.0],
          gravity: -0.02,
          drag: 0,
          wind: rand(-0.02, 0.02),
          swirl: rand(0.6, 1.4),
          wobble: rand(7, 13),
        }));
      }
    }

    function spawnRocket(x, variant = 0) {
      pushParticle(makeParticle({
        x,
        y: -1.05,
        vx: rand(-0.05, 0.05),
        vy: rand(1.05, 1.5),
        life: rand(1.2, 1.8),
        type: 4,
        size0: rand(6, 8),
        size1: rand(3, 4),
        c0: [1.0, 0.98, 0.9, 1.0],
        c1: [1.0, 1.0, 1.0, 0.0],
        gravity: -0.12,
        drag: 0.03,
        burstAt: rand(0.55, 0.82),
        variant,
        track: true,
        trailC0: [1.0, 1.0, 1.0, 0.7],
        trailC1: [1.0, 0.8, 0.3, 0.0],
      }));
    }

    const colorPalettes = [
      { name: "gold", colors: [[1.0, 0.84, 0.0], [1.0, 0.94, 0.2], [1.0, 0.7, 0.0]] },
      { name: "red", colors: [[1.0, 0.0, 0.0], [1.0, 0.3, 0.0], [0.8, 0.0, 0.0]] },
      { name: "blue", colors: [[0.0, 0.5, 1.0], [0.3, 0.7, 1.0], [0.0, 0.3, 0.8]] },
      { name: "green", colors: [[0.0, 1.0, 0.3], [0.3, 1.0, 0.5], [0.0, 0.8, 0.2]] },
      { name: "purple", colors: [[0.8, 0.0, 1.0], [1.0, 0.3, 0.8], [0.6, 0.0, 0.8]] },
      { name: "cyan", colors: [[0.0, 1.0, 1.0], [0.2, 0.9, 1.0], [0.0, 0.8, 0.9]] },
      { name: "pink", colors: [[1.0, 0.2, 0.8], [1.0, 0.5, 0.9], [1.0, 0.0, 0.6]] },
      { name: "white", colors: [[1.0, 1.0, 1.0], [0.95, 0.95, 1.0], [0.9, 0.9, 1.0]] },
      { name: "orange", colors: [[1.0, 0.5, 0.0], [1.0, 0.65, 0.1], [1.0, 0.35, 0.0]] },
      { name: "rainbow", colors: [[1.0, 0.0, 0.0], [1.0, 0.5, 0.0], [0.0, 1.0, 0.5]] },
    ];

    function getRandomPalette() {
      return colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
    }

    function getRandomColor(palette) {
      return palette.colors[Math.floor(Math.random() * palette.colors.length)];
    }

    function spawnBurst(x, y, variant = 0) {
      const variant_safe = variant % 12;
      const palette = getRandomPalette();
      const primaryColor = getRandomColor(palette);
      const secondaryColor = getRandomColor(palette);
      
      for (let i = 0; i < 25; i++) {
        const angle = rand(0, Math.PI * 2);
        const distance = rand(0.01, 0.06);
        
        pushParticle(makeParticle({
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance,
          vx: Math.cos(angle) * rand(0.008, 0.03),
          vy: Math.sin(angle) * rand(0.008, 0.03),
          life: rand(1.2, 2.2),
          type: 1,
          size0: rand(25, 40),
          size1: rand(50, 90),
          c0: [0.4, 0.4, 0.4, 0.12],
          c1: [0.15, 0.15, 0.15, 0.0],
          gravity: -0.08,
          drag: 0.2,
          wind: rand(-0.02, 0.02),
          swirl: rand(0.15, 0.35),
          track: false,
        }));
      }
      
      for (let i = 0; i < 3; i++) {
        pushParticle(makeParticle({
          x: x + rand(-0.02, 0.02),
          y: y + rand(-0.02, 0.02),
          vx: rand(-0.03, 0.03),
          vy: rand(-0.03, 0.03),
          life: rand(0.1, 0.2),
          type: 0,
          size0: rand(50, 80),
          size1: rand(10, 20),
          c0: [1.0, 1.0, 1.0, 0.95],
          c1: [1.0, 0.9, 0.5, 0.0],
          gravity: 0.0,
          drag: 0.0,
          track: false,
        }));
      }

      if (variant_safe === 0) {
        for (let i = 0; i < 300; i++) {
          const angle = (i / 300) * Math.PI * 2;
          const speed = rand(0.35, 0.6);
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          
          pushParticle(makeParticle({
            x, y, vx, vy,
            life: rand(0.8, 1.3),
            type: 0,
            size0: rand(8, 14),
            size1: rand(2, 4),
            c0: [...primaryColor, 1.0],
            c1: [...primaryColor, 0.0],
            gravity: -0.8,
            drag: 0.35,
            wind: 0,
            swirl: 0.1,
            track: true,
            trailC0: [1.0, 1.0, 1.0, 0.9],
            trailC1: [...primaryColor, 0.0],
          }));
        }
      } else if (variant_safe === 1) {
        for (let i = 0; i < 200; i++) {
          const angle = (i / 200) * Math.PI * 2;
          const speed1 = rand(0.3, 0.5);
          const speed2 = rand(0.45, 0.7);
          
          pushParticle(makeParticle({
            x, y, 
            vx: Math.cos(angle) * speed1, 
            vy: Math.sin(angle) * speed1,
            life: rand(0.9, 1.4),
            type: 0,
            size0: rand(7, 12),
            size1: rand(1.5, 3),
            c0: [...primaryColor, 1.0],
            c1: [...primaryColor, 0.0],
            gravity: -0.7,
            drag: 0.33,
            track: true,
            trailC0: [1.0, 1.0, 1.0, 0.85],
            trailC1: [...primaryColor, 0.0],
          }));
          
          if (i % 2 === 0) {
            pushParticle(makeParticle({
              x, y,
              vx: Math.cos(angle + 0.26) * speed2,
              vy: Math.sin(angle + 0.26) * speed2,
              life: rand(0.85, 1.35),
              type: 0,
              size0: rand(9, 15),
              size1: rand(2.5, 4.5),
              c0: [...secondaryColor, 0.95],
              c1: [...secondaryColor, 0.0],
              gravity: -0.75,
              drag: 0.35,
              track: true,
              trailC0: [1.0, 1.0, 1.0, 0.8],
              trailC1: [...secondaryColor, 0.0],
            }));
          }
        }
      } else if (variant_safe === 2) {
        const armCount = 6;
        const particlesPerArm = 50;
        
        for (let arm = 0; arm < armCount; arm++) {
          const armAngle = (arm / armCount) * Math.PI * 2;
          
          for (let i = 0; i < particlesPerArm; i++) {
            const spreadAngle = rand(-0.15, 0.15);
            const angle = armAngle + spreadAngle + (i / particlesPerArm) * 0.3;
            const speed = 0.3 + (i / particlesPerArm) * 0.25;
            
            pushParticle(makeParticle({
              x, y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: rand(0.9, 1.4),
              type: 0,
              size0: rand(7, 13),
              size1: rand(1.5, 3.5),
              c0: [...primaryColor, 1.0],
              c1: [...primaryColor, 0.0],
              gravity: -0.65,
              drag: 0.34,
              wind: rand(-0.05, 0.05),
              track: true,
              trailC0: [1.0, 1.0, 1.0, 0.85],
              trailC1: [...primaryColor, 0.0],
            }));
          }
        }
      } else if (variant_safe === 3) {
        for (let i = 0; i < 320; i++) {
          const angle = rand(Math.PI * 0.3, Math.PI * 0.7) + (Math.random() - 0.5) * 0.4;
          const speed = rand(0.35, 0.6);
          
          pushParticle(makeParticle({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: rand(0.8, 1.3),
            type: 0,
            size0: rand(8, 14),
            size1: rand(2, 4),
            c0: [...primaryColor, 1.0],
            c1: [...primaryColor, 0.0],
            gravity: -0.8,
            drag: 0.35,
            wind: rand(-0.1, 0.1),
            swirl: rand(0.3, 0.8),
            track: true,
            trailC0: [1.0, 1.0, 1.0, 0.9],
            trailC1: [...primaryColor, 0.0],
          }));
        }
      } else if (variant_safe === 4) {
        for (let i = 0; i < 380; i++) {
          const angle = rand(0, Math.PI * 2);
          const speed = rand(0.08, 0.25);
          
          pushParticle(makeParticle({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed + rand(-0.1, 0.1),
            life: rand(1.6, 2.2),
            type: 0,
            size0: rand(6, 11),
            size1: rand(1.5, 3),
            c0: [...primaryColor, 0.95],
            c1: [...primaryColor, 0.0],
            gravity: -1.8,
            drag: 0.5,
            wind: rand(-0.05, 0.05),
            track: true,
            trailC0: [1.0, 1.0, 1.0, 0.7],
            trailC1: [...primaryColor, 0.0],
          }));
        }
      } else if (variant_safe === 5) {
        const latSteps = 12;
        const lonSteps = 24;
        
        for (let lat = 0; lat < latSteps; lat++) {
          const theta = (lat / latSteps) * Math.PI;
          
          for (let lon = 0; lon < lonSteps; lon++) {
            const phi = (lon / lonSteps) * Math.PI * 2;
            const speed = rand(0.4, 0.65);
            
            pushParticle(makeParticle({
              x, y,
              vx: Math.cos(phi) * Math.sin(theta) * speed,
              vy: Math.sin(phi) * Math.sin(theta) * speed,
              life: rand(0.85, 1.35),
              type: 0,
              size0: rand(8, 13),
              size1: rand(2, 3.5),
              c0: [...primaryColor, 1.0],
              c1: [...primaryColor, 0.0],
              gravity: -0.7,
              drag: 0.34,
              track: true,
              trailC0: [1.0, 1.0, 1.0, 0.85],
              trailC1: [...primaryColor, 0.0],
            }));
          }
        }
      } else if (variant_safe === 6) {
        for (let i = 0; i < 320; i++) {
          const angle = rand(0, Math.PI * 2);
          const horizontalBias = Math.abs(Math.cos(angle)) > 0.3 ? 1.0 : 0.5;
          const speed = rand(0.35, 0.55) * horizontalBias;
          
          pushParticle(makeParticle({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed * 0.7 + 0.2,
            life: rand(0.85, 1.35),
            type: 0,
            size0: rand(8, 14),
            size1: rand(2, 4),
            c0: [...primaryColor, 1.0],
            c1: [...primaryColor, 0.0],
            gravity: -0.75,
            drag: 0.35,
            track: true,
            trailC0: [1.0, 1.0, 1.0, 0.88],
            trailC1: [...primaryColor, 0.0],
          }));
        }
      } else if (variant_safe === 7) {
        for (let i = 0; i < 280; i++) {
          const angle = rand(0, Math.PI * 2);
          const speed = 0.4 + Math.abs(Math.sin(angle)) * 0.25;
          
          pushParticle(makeParticle({
            x, y,
            vx: Math.cos(angle) * speed * 0.6,
            vy: Math.sin(angle) * speed * 0.4 + 0.5,
            life: rand(0.9, 1.4),
            type: 0,
            size0: rand(9, 15),
            size1: rand(2.5, 4),
            c0: [...primaryColor, 1.0],
            c1: [...primaryColor, 0.0],
            gravity: -0.5,
            drag: 0.32,
            wind: rand(-0.08, 0.08),
            track: true,
            trailC0: [1.0, 1.0, 1.0, 0.9],
            trailC1: [...primaryColor, 0.0],
          }));
        }
      } else if (variant_safe === 8) {
        for (let i = 0; i < 240; i++) {
          const angle = rand(0, Math.PI * 2);
          const speed = rand(0.5, 0.8);
          
          pushParticle(makeParticle({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: rand(0.75, 1.2),
            type: 0,
            size0: rand(10, 16),
            size1: rand(2.5, 4.5),
            c0: [...primaryColor, 1.0],
            c1: [...primaryColor, 0.0],
            gravity: -0.7,
            drag: 0.36,
            track: true,
            trailC0: [1.0, 1.0, 1.0, 1.0],
            trailC1: [...primaryColor, 0.0],
          }));
        }
      } else if (variant_safe === 9) {
        const ringCount = 3;
        const particlesPerRing = 90;
        
        for (let ring = 0; ring < ringCount; ring++) {
          const speedMult = 1.0 - ring * 0.15;
          
          for (let i = 0; i < particlesPerRing; i++) {
            const angle = (i / particlesPerRing) * Math.PI * 2 + rand(-0.1, 0.1);
            const speed = rand(0.3, 0.55) * speedMult;
            
            pushParticle(makeParticle({
              x, y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: rand(0.85, 1.35),
              type: 0,
              size0: rand(7, 12) + ring * 2,
              size1: rand(2, 3.5),
              c0: [
                ring % 2 === 0 ? primaryColor[0] : secondaryColor[0],
                ring % 2 === 0 ? primaryColor[1] : secondaryColor[1],
                ring % 2 === 0 ? primaryColor[2] : secondaryColor[2],
                1.0
              ],
              c1: [
                ring % 2 === 0 ? primaryColor[0] : secondaryColor[0],
                ring % 2 === 0 ? primaryColor[1] : secondaryColor[1],
                ring % 2 === 0 ? primaryColor[2] : secondaryColor[2],
                0.0
              ],
              gravity: -0.65 - ring * 0.1,
              drag: 0.33,
              track: true,
              trailC0: [1.0, 1.0, 1.0, 0.8],
              trailC1: [
                ring % 2 === 0 ? primaryColor[0] : secondaryColor[0],
                ring % 2 === 0 ? primaryColor[1] : secondaryColor[1],
                ring % 2 === 0 ? primaryColor[2] : secondaryColor[2],
                0.0
              ],
            }));
          }
        }
      } else if (variant_safe === 10) {
        const spiralCount = 260;
        
        for (let i = 0; i < spiralCount; i++) {
          const t = i / spiralCount;
          const angle = t * Math.PI * 4;
          const radius = 0.1 + t * 0.4;
          const speed = 0.3 + t * 0.25;
          
          pushParticle(makeParticle({
            x, y,
            vx: Math.cos(angle) * radius + Math.cos(angle) * speed * 0.2,
            vy: Math.sin(angle) * radius + Math.sin(angle) * speed * 0.2 + 0.3,
            life: rand(0.85, 1.35),
            type: 0,
            size0: rand(7, 13),
            size1: rand(1.5, 3),
            c0: [...primaryColor, 1.0],
            c1: [...primaryColor, 0.0],
            gravity: -0.6,
            drag: 0.34,
            wind: rand(-0.08, 0.08),
            track: true,
            trailC0: [1.0, 1.0, 1.0, 0.85],
            trailC1: [...primaryColor, 0.0],
          }));
        }
      } else {
        const branchCount = 8;
        const particlesPerBranch = 40;
        
        for (let branch = 0; branch < branchCount; branch++) {
          const branchAngle = (branch / branchCount) * Math.PI * 2;
          
          for (let i = 0; i < particlesPerBranch; i++) {
            const progress = i / particlesPerBranch;
            const angle = branchAngle + progress * 0.5;
            const speed = 0.4 + progress * 0.2;
            
            pushParticle(makeParticle({
              x, y,
              vx: Math.cos(angle) * speed * 0.7,
              vy: (Math.sin(angle) * speed - progress * 0.6),
              life: rand(1.0, 1.6),
              type: 0,
              size0: rand(7, 12),
              size1: rand(1.5, 3),
              c0: [...primaryColor, 0.95],
              c1: [...primaryColor, 0.0],
              gravity: -1.0 - progress * 0.3,
              drag: 0.4,
              wind: rand(-0.06, 0.06),
              track: true,
              trailC0: [1.0, 1.0, 1.0, 0.75],
              trailC1: [...primaryColor, 0.0],
            }));
          }
        }
      }
    }

    function updateParticles(dt) {
      const active = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age += dt;

        if (p.type === 4 && !p.exploded && (p.age >= p.burstAt || p.vy <= 0.15)) {
          spawnBurst(p.x, p.y, p.variant);
          p.exploded = true;
          continue;
        }

        p.prevX = p.x;
        p.prevY = p.y;

        const t = clamp(p.age / p.life, 0, 1);

        if (p.type === 1) {
          const sway = Math.sin((elapsed * 2.0) + p.seed * 0.013) * p.swirl * 0.06;
          p.vx += (p.wind + sway) * dt;
          p.vy += p.gravity * dt;
        } else if (p.type === 2) {
          p.vx += (p.wind + Math.sin(p.seed * 2.0 + elapsed * 9.0) * 0.04) * dt;
        } else if (p.type === 3) {
          p.vx += (p.wind + Math.sin(elapsed * 2.5 + p.seed) * 0.05) * dt;
        } else if (p.type === 0) {
          p.vx += (p.wind + Math.sin(p.seed + elapsed * 20.0) * 0.03) * dt;
          p.vy += p.gravity * dt;
        } else if (p.type === 4) {
          p.vx += p.wind * dt;
          p.vy += p.gravity * dt;
        }

        p.vx *= Math.max(0, 1 - p.drag * dt);
        p.vy *= Math.max(0, 1 - p.drag * dt);

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        let size = lerp(p.size0, p.size1, easeOutCubic(t));
        let color = [
          lerp(p.c0[0], p.c1[0], t),
          lerp(p.c0[1], p.c1[1], t),
          lerp(p.c0[2], p.c1[2], t),
          lerp(p.c0[3], p.c1[3], t),
        ];

        const fadeIn = smoothstep(0.0, 0.08, t);
        const fadeOut = 1.0 - smoothstep(0.70, 1.0, t);

        if (p.type === 1) {
          size = lerp(p.size0, p.size1, t) * (1.0 + 0.08 * Math.sin(p.seed + elapsed * 1.7));
          color[3] *= fadeOut * 0.95;
        } else if (p.type === 2) {
          size = lerp(p.size0, p.size1, t);
          color[3] *= fadeIn * fadeOut;
        } else if (p.type === 3) {
          size = lerp(p.size0, p.size1, t);
          color[3] *= fadeOut;
        } else if (p.type === 4) {
          size = lerp(p.size0, p.size1, t);
          color[3] *= fadeOut;
        } else {
          color[3] *= fadeIn * fadeOut;
        }

        if (p.track) {
          pushTrail(p.prevX, p.prevY, p.x, p.y, p.trailC0, p.trailC1, p.type === 0 ? rand(0.10, 0.18) : rand(0.08, 0.12));
        }

        const alive =
          p.age < p.life &&
          p.x > -1.5 && p.x < 1.5 &&
          p.y > -1.4 && p.y < 1.4 &&
          color[3] > 0.01;

        if (!alive) continue;

        p.drawSize = size;
        p.drawColor = color;
        active.push(p);
      }

      particles.length = 0;
      for (const p of active) particles.push(p);
    }

    function updateTrails(dt) {
      const alive = [];
      for (let i = 0; i < trails.length; i++) {
        const t = trails[i];
        t.age += dt;
        if (t.age < t.life) alive.push(t);
      }
      trails.length = 0;
      trails.push(...alive);
    }

    function buildDrawBuffers() {
      let alphaCount = 0;
      let addCount = 0;
      let alphaCountQuad = 0;
      let addCountQuad = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const additive = (p.type === 0 || p.type === 4);

        const arr = additive ? addData : alphaData;
        const idx = additive ? addCount++ : alphaCount++;
        const o = idx * ATTRS_PER_PARTICLE;

        arr[o + 0] = p.x;
        arr[o + 1] = p.y;
        arr[o + 2] = p.drawSize;
        arr[o + 3] = p.drawColor[0];
        arr[o + 4] = p.drawColor[1];
        arr[o + 5] = p.drawColor[2];
        arr[o + 6] = p.drawColor[3];
        arr[o + 7] = p.type;
        arr[o + 8] = p.seed;

        const quadArr = additive ? addDataQuad : alphaDataQuad;
        const quadIdx = additive ? addCountQuad++ : alphaCountQuad++;
        const quadBase = quadIdx * 4 * ATTRS_PER_PARTICLE;

        for (let v = 0; v < 4; v++) {
          const oq = quadBase + v * ATTRS_PER_PARTICLE;
          quadArr[oq + 0] = p.x;
          quadArr[oq + 1] = p.y;
          quadArr[oq + 2] = p.drawSize;
          quadArr[oq + 3] = p.drawColor[0];
          quadArr[oq + 4] = p.drawColor[1];
          quadArr[oq + 5] = p.drawColor[2];
          quadArr[oq + 6] = p.drawColor[3];
          quadArr[oq + 7] = p.type;
          quadArr[oq + 8] = p.seed;
        }
      }

      return { alphaCount, addCount, alphaCountQuad, addCountQuad };
    }

    function resizeCanvas() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const displayWidth = Math.floor(canvas.clientWidth * dpr);
      const displayHeight = Math.floor(canvas.clientHeight * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, displayWidth, displayHeight);
      }

      return dpr;
    }

    function drawBackground(timeSec) {
      gl.useProgram(backgroundProgram);
      gl.uniform2f(bgUniforms.uResolution, canvas.width, canvas.height);
      gl.uniform1f(bgUniforms.uTime, timeSec);

      gl.disable(gl.BLEND);
      gl.bindVertexArray(backgroundVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      gl.enable(gl.BLEND);
    }

    function drawTrails(dpr, timeSec) {
      if (trails.length === 0) return;

      let n = 0;
      for (let i = 0; i < trails.length; i++) {
        const t = trails[i];
        const k = Math.max(0, 1 - t.age / t.life);
        const a0 = t.c0[3] * k * k;
        const a1 = t.c1[3] * k * k;

        const o = n * TRAIL_FLOATS_PER_SEGMENT;
        trailData[o + 0] = t.x0;
        trailData[o + 1] = t.y0;
        trailData[o + 2] = t.c0[0];
        trailData[o + 3] = t.c0[1];
        trailData[o + 4] = t.c0[2];
        trailData[o + 5] = a0;

        trailData[o + 6] = t.x1;
        trailData[o + 7] = t.y1;
        trailData[o + 8] = t.c1[0];
        trailData[o + 9] = t.c1[1];
        trailData[o + 10] = t.c1[2];
        trailData[o + 11] = a1;

        n++;
        if (n >= MAX_TRAILS) break;
      }

      gl.useProgram(trailProgram);
      gl.bindVertexArray(trailVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, trailVBO);
      gl.bufferData(gl.ARRAY_BUFFER, trailData.subarray(0, n * TRAIL_FLOATS_PER_SEGMENT), gl.DYNAMIC_DRAW);

      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.lineWidth(1);
      gl.drawArrays(gl.LINES, 0, n * 2);

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    function drawParticles(count, data, blendMode, dpr, timeSec) {
      if (count <= 0) return;

      gl.useProgram(particleProgram);
      gl.uniform1f(pUniforms.uPixelRatio, dpr);
      gl.uniform1f(pUniforms.uTime, timeSec);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sparkTexture);
      gl.uniform1i(pUniforms.uSparkTex, 0);

      gl.bindVertexArray(particleVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, particleVBO);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * ATTRS_PER_PARTICLE), gl.DYNAMIC_DRAW);

      gl.blendFunc(gl.SRC_ALPHA, blendMode);
      
      gl.drawArrays(gl.POINTS, 0, count);
      drawCallsThisFrame += 1;

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    function drawParticlesInstanced(count, data, blendMode, dpr, timeSec) {
      if (count <= 0) return;

      gl.useProgram(instancedParticleProgram);
      gl.uniform1f(pInstancedUniforms.uPixelRatio, dpr);
      gl.uniform1f(pInstancedUniforms.uTime, timeSec);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sparkTexture);
      gl.uniform1i(pInstancedUniforms.uSparkTex, 0);

      gl.bindVertexArray(instancedVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, instancedVBO);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * ATTRS_PER_PARTICLE), gl.DYNAMIC_DRAW);

      gl.blendFunc(gl.SRC_ALPHA, blendMode);
      
      gl.drawArraysInstanced(gl.POINTS, 0, 1, count);
      drawCallsThisFrame += 1;

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    function drawParticlesQuad(count, data, blendMode, timeSec) {
      if (count <= 0) return;

      gl.useProgram(quadProgram);
      gl.uniform1f(quadUniforms.uTime, timeSec);

      gl.bindVertexArray(quadVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);

      const totalVerts = count * QUAD_VERTS_PER_PARTICLE;
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, totalVerts * ATTRS_PER_PARTICLE), gl.DYNAMIC_DRAW);

      gl.blendFunc(gl.SRC_ALPHA, blendMode);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, totalVerts);
      drawCallsThisFrame += 1;

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    function drawParticlesQuadInstanced(count, data, blendMode, timeSec) {
      if (count <= 0) return;

      gl.useProgram(quadProgram_instanced);
      gl.uniform1f(quadInstancedUniforms.uTime, timeSec);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, quadInstancedVBO);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * ATTRS_PER_PARTICLE), gl.DYNAMIC_DRAW);

      gl.bindVertexArray(quadTemplateVAO);
  
      gl.blendFunc(gl.SRC_ALPHA, blendMode);
      
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      drawCallsThisFrame += 1;

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    function emitScene(dt) {
      if (mode === MODE.SPARKLER) emitSparkler(dt);
      if (mode === MODE.SMOKE) emitSmoke(dt);
      if (mode === MODE.RAIN || mode === MODE.SNOW) emitRainOrSnow(dt);
      if (mode === MODE.STEAM) {
        emitCloud(dt);
      }
      if (mode === MODE.VOID_SINGULARITY) {
        emitInkCloud(dt);
      }
      if (mode === MODE.SMOKE_5K_STD || mode === MODE.SMOKE_5K_INST || 
          mode === MODE.SMOKE_5K_QUAD_STD || mode === MODE.SMOKE_5K_QUAD_INST) {
        emitSmoke5k(dt);
      }

      if (mode === MODE.FIREWORK) {
        fireworkTimer -= dt;
        if (fireworkTimer <= 0) {
          const x = rand(-0.65, 0.65);
          spawnRocket(x, Math.floor(rand(0, 12)));
          fireworkTimer = fireworkInterval + rand(-0.25, 0.55);
        }
      }
    }

    function launchFireworkFromClick(clientX) {
      const rect = canvas.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      spawnRocket(clamp(nx, -0.85, 0.85), Math.floor(rand(0, 12)));
      if (mode !== MODE.FIREWORK) {
        setMode(MODE.FIREWORK);
      }
    }

    function clearScene() {
      particles.length = 0;
      trails.length = 0;
      fireworkTimer = 0;
    }

    const emitters = {
      sparkler: { x: -0.72, y: -0.70 },
      smoke: { x: -0.08, y: -0.78 },
      steam: { x: 0.62, y: -0.73 },
      cloud: { x: 0.58, y: 0.52 },
    };

    function render(now) {
      const dpr = resizeCanvas();
      const rawDt = (now - lastTime) * 0.001;
      const dt = Math.min(0.033, Math.max(0.001, rawDt));
      lastTime = now;
      elapsed += dt;

      frameCount++;
      fpsTime += rawDt;
      if (fpsTime >= 1.0) {
        fps = Math.round(frameCount / fpsTime);
        frameCount = 0;
        fpsTime = 0;
      }

      drawCallsThisFrame = 0;

      emitScene(dt);
      updateParticles(dt);
      updateTrails(dt);
      const counts = buildDrawBuffers();

      gl.viewport(0, 0, canvas.width, canvas.height);
      drawBackground(elapsed);
      drawCallsThisFrame += 1;

      drawTrails(dpr, elapsed);
      if (trails.length > 0) drawCallsThisFrame += 1;

      gl.enable(gl.BLEND);
      
      const useInstancing = mode === MODE.SMOKE_5K_INST || mode === MODE.SMOKE_5K_QUAD_INST;
      const useQuad = mode === MODE.SMOKE_5K_QUAD_STD || mode === MODE.SMOKE_5K_QUAD_INST;
      
      if (useQuad) {
        if (useInstancing) {
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          drawParticlesQuadInstanced(counts.alphaCount, alphaData, gl.ONE_MINUS_SRC_ALPHA, elapsed);

          gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
          drawParticlesQuadInstanced(counts.addCount, addData, gl.ONE, elapsed);
        } else {
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          drawParticlesQuad(counts.alphaCount, alphaDataQuad, gl.ONE_MINUS_SRC_ALPHA, elapsed);

          gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
          drawParticlesQuad(counts.addCount, addDataQuad, gl.ONE, elapsed);
        }
      } else {
        if (useInstancing) {
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          drawParticlesInstanced(counts.alphaCount, alphaData, gl.ONE_MINUS_SRC_ALPHA, dpr, elapsed);

          gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
          drawParticlesInstanced(counts.addCount, addData, gl.ONE, dpr, elapsed);
        } else {
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          drawParticles(counts.alphaCount, alphaData, gl.ONE_MINUS_SRC_ALPHA, dpr, elapsed);

          gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
          drawParticles(counts.addCount, addData, gl.ONE, dpr, elapsed);
        }
      }

      drawCallsLastFrame = drawCallsThisFrame;
      const modeStr = mode === MODE.SMOKE_5K_STD ? "Points-STD" : 
                      mode === MODE.SMOKE_5K_INST ? "Points-INST" : 
                      mode === MODE.SMOKE_5K_QUAD_STD ? "Quads-STD" :
                      mode === MODE.SMOKE_5K_QUAD_INST ? "Quads-INST" : "";
      statsLine.textContent = `FPS: ${fps} | DC: ${drawCallsLastFrame} | particles: ${particles.length} | alpha: ${counts.alphaCount} | add: ${counts.addCount} ${modeStr}`;

      requestAnimationFrame(render);
    }

    function setupEventListeners() {
      modeButtons.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-mode]");
        if (!btn) return;

        const selectedMode = btn.dataset.mode;
        setMode(selectedMode);
      });

      clearBtn.addEventListener("click", clearScene);

      canvas.addEventListener("pointerdown", (e) => {
        launchFireworkFromClick(e.clientX);
      });

      window.addEventListener("resize", resizeCanvas);

      function updateButtonsActive() {
        [...modeButtons.querySelectorAll("button[data-mode]")].forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.mode === mode);
        });
      }

      const _updateUIOriginal = updateUI;
      updateUI = function() {
        _updateUIOriginal();
        updateButtonsActive();
      };

      updateButtonsActive();
      updateUI();
      requestAnimationFrame(render);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        if (initializeDOM()) {
          initializeWebGL();
          setupEventListeners();
        }
      });
    } else {
      if (initializeDOM()) {
        initializeWebGL();
        setupEventListeners();
      }
    }
  })();