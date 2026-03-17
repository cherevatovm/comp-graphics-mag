"use strict";

const canvas = document.getElementById("glcanvas");
let gl;

let shaderProgram;
let aPosLoc, aUVLoc;
let uModelViewLoc, uProjectionLoc, uBaseColorLoc;
let uMaterialTexLoc, uNumberTexLoc, uMatWeightLoc, uNumWeightLoc;

let posBuffer = null, uvBuffer = null, indexBuffer = null;
let cubeIndicesCount = 0;
let vao = null;

let angleCube = 0;
let anglePedestalLocal = 0;
let anglePedestalGlobal = 0;
let rotateCubes = false;
let rotatePedestalLocal = false;
let rotatePedestalGlobal = false;

const pedestalPosition = $V([3, 0, -6]);
const cubeOffsets = [
  $V([0, 1.0, 0]),
  $V([-1.0, 0, 0]),
  $V([1.0, 0, 0]),
  $V([0, 0.0, 0])
];
const cubeColors = [
  [1.00, 0.84, 0.00],
  [0.75, 0.75, 0.75],
  [0.80, 0.50, 0.20],
  [1.00, 0.84, 0.00]
];

let materialTexture = null;
let numberTextures = [];
let materialWeight = 0.7;
let numberWeight = 1.0;

const matRange = document.getElementById("matRange");
const numRange = document.getElementById("numRange");
const matVal = document.getElementById("matVal");
const numVal = document.getElementById("numVal");

function initGL() {
  gl = canvas.getContext("webgl2", { antialias: true });
  if (!gl) throw new Error("WebGL2 not supported");
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
}

function createShader(type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s));
  }
  return s;
}

function initShaders() {
  const vs = `#version 300 es
  in vec3 position;
  in vec2 uv;

  uniform mat4 modelView;
  uniform mat4 projection;

  out vec2 vUV;

  void main() {
    vUV = uv;
    gl_Position = projection * modelView * vec4(position, 1.0);
  }`;

  const fs = `#version 300 es
  precision mediump float;
  in vec2 vUV;

  uniform vec3 uBaseColor;
  uniform sampler2D uMaterialTex;
  uniform sampler2D uNumberTex;
  uniform float uMatWeight;
  uniform float uNumWeight;

  out vec4 outColor;

  void main() {
    vec3 mat = texture(uMaterialTex, vUV).rgb;
    vec4 num = texture(uNumberTex, vUV);
    vec3 afterMat = mix(uBaseColor, mat, uMatWeight);
    vec3 finalCol = mix(afterMat, num.rgb, num.a * uNumWeight);
    outColor = vec4(finalCol, 1.0);
  }`;

  const vsS = createShader(gl.VERTEX_SHADER, vs);
  const fsS = createShader(gl.FRAGMENT_SHADER, fs);

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vsS);
  gl.attachShader(shaderProgram, fsS);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw new Error("Program link error: " + gl.getProgramInfoLog(shaderProgram));
  }
  gl.useProgram(shaderProgram);

  aPosLoc = gl.getAttribLocation(shaderProgram, "position");
  aUVLoc = gl.getAttribLocation(shaderProgram, "uv");

  uModelViewLoc = gl.getUniformLocation(shaderProgram, "modelView");
  uProjectionLoc = gl.getUniformLocation(shaderProgram, "projection");
  uBaseColorLoc = gl.getUniformLocation(shaderProgram, "uBaseColor");

  uMaterialTexLoc = gl.getUniformLocation(shaderProgram, "uMaterialTex");
  uNumberTexLoc = gl.getUniformLocation(shaderProgram, "uNumberTex");
  uMatWeightLoc = gl.getUniformLocation(shaderProgram, "uMatWeight");
  uNumWeightLoc = gl.getUniformLocation(shaderProgram, "uNumWeight");
}

function initBuffers() {
  const s = 0.5;
  const positions = new Float32Array([
    -s, -s, s, s, -s, s, s, s, s, -s, s, s,
    -s, -s, -s, -s, s, -s, s, s, -s, s, -s, -s,
    -s, s, -s, -s, s, s, s, s, s, s, s, -s,
    -s, -s, -s, s, -s, -s, s, -s, s, -s, -s, s,
    s, -s, -s, s, s, -s, s, s, s, s, -s, s,
    -s, -s, -s, -s, -s, s, -s, s, s, -s, s, -s
  ]);

  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 0, 1, 1, 1, 1, 0,
    0, 0, 0, 1, 1, 1, 1, 0,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 0, 1, 1, 1, 1, 0,
    0, 0, 1, 0, 1, 1, 0, 1
  ]);

  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23
  ]);
  cubeIndicesCount = indices.length;

  posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

  indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}


function initVAO() {
  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.enableVertexAttribArray(aUVLoc);
  gl.vertexAttribPointer(aUVLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

async function loadTextureFromFile(file) {
  const bitmap = await createImageBitmap(file);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  if (bitmap.close) bitmap.close();
  return tex;
}

function createDefaultMaterialTexture() {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  const pixel = new Uint8Array([200, 180, 150, 255]);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return t;
}

function createTextureFromCanvas(canvasEl) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasEl);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function makeNumberCanvas(n, size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(size / 2, size / 2, size * 0.45, size * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = `${Math.floor(size * 0.6)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), size / 2, size / 2 + size * 0.02);
  return c;
}

function makeBlankCanvas(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function buildNumberTextures() {
  numberTextures = [];
  for (let i = 1; i <= 3; i++) {
    const cn = makeNumberCanvas(i, 512);
    numberTextures.push(createTextureFromCanvas(cn));
  }
  numberTextures.push(createTextureFromCanvas(makeBlankCanvas(512)));
}

function sylvesterToGL(m) {
  const e = m.elements;
  const out = new Float32Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c * 4 + r] = e[r][c];
  return out;
}
function identity() { return $M([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]); }
function translation(v) { return $M([[1, 0, 0, v.e(1)], [0, 1, 0, v.e(2)], [0, 0, 1, v.e(3)], [0, 0, 0, 1]]); }
function rotationY(a) { const c = Math.cos(a), s = Math.sin(a); return $M([[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]]); }
function scaleMatrix(sx, sy, sz) { return $M([[sx, 0, 0, 0], [0, sy, 0, 0], [0, 0, sz, 0], [0, 0, 0, 1]]); }
function perspective(fov, aspect, near, far) {
  const f = 1.0 / Math.tan(fov / 2);
  return $M([[f / aspect, 0, 0, 0], [0, f, 0, 0], [0, 0, (far + near) / (near - far), (2 * far * near) / (near - far)], [0, 0, -1, 0]]);
}
function updateMeshModelFromPosition(mesh) {
  if (!mesh.position) mesh.position = $V([0, 0, 0]);
  mesh.model = translation(mesh.position).x(rotationY(mesh.rotationY || 0));
}

function drawCube(modelSylvester, baseColor, numberTex, matTex, matWeight, numWeight, scale = 1.0) {
  const modelScaled = modelSylvester.x(scaleMatrix(scale, scale, scale));
  const view = translation($V([0, -0.3, 0]));
  const modelView = view.x(modelScaled);
  const aspect = gl.canvas.width / gl.canvas.height;
  const proj = perspective(Math.PI / 4, aspect, 0.1, 100.0);

  gl.uniformMatrix4fv(uProjectionLoc, false, sylvesterToGL(proj));
  gl.uniformMatrix4fv(uModelViewLoc, false, sylvesterToGL(modelView));
  gl.uniform3fv(uBaseColorLoc, new Float32Array(baseColor));
  gl.uniform1f(uMatWeightLoc, matWeight);
  gl.uniform1f(uNumWeightLoc, numWeight);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, matTex);
  gl.uniform1i(uMaterialTexLoc, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, numberTex);
  gl.uniform1i(uNumberTexLoc, 1);

  gl.bindVertexArray(vao);
  gl.drawElements(gl.TRIANGLES, cubeIndicesCount, gl.UNSIGNED_SHORT, 0);
  gl.bindVertexArray(null);

  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width; canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
}

function drawScene() {
  resizeCanvas();
  gl.clearColor(0.07, 0.07, 0.09, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (rotateCubes) angleCube += 0.03;
  if (rotatePedestalLocal) anglePedestalLocal += 0.02;
  if (rotatePedestalGlobal) anglePedestalGlobal += 0.015;

  const Rg = rotationY(anglePedestalGlobal);
  const Tp = translation(pedestalPosition);
  const Rp = rotationY(anglePedestalLocal);
  const Rc = rotationY(angleCube);

  const numberMap = [0, 1, 2, 3];
  for (let i = 0; i < cubeOffsets.length; i++) {
    const Tc = translation(cubeOffsets[i]);
    const model = Rg.x(Tp).x(Rp).x(Tc).x(Rc);

    const numTexIndex = (i <= 2 ? i : 3);
    const numberTex = numberTextures[numTexIndex];
    drawCube(model, cubeColors[i], numberTex, materialTexture, materialWeight, numberWeight, (i === 0 ? 1.12 : 1.0));
  }

  for (let i = 0; i < sceneMeshes.length; i++) {
    const m = sceneMeshes[i];
    const matToUse = (m.useGlobalMaterial || !m.materialTexture) ? materialTexture : m.materialTexture;
    const model = m.model || identity();
    drawMesh(m, model, matToUse, materialWeight, m.baseColor || [0.8, 0.8, 0.8]);
  }
}

function renderLoop() {
  drawScene();
  requestAnimationFrame(renderLoop);
}

function setupUI() {
  matRange.value = Math.floor(materialWeight * 100);
  numRange.value = Math.floor(numberWeight * 100);
  matVal.textContent = materialWeight.toFixed(2);
  numVal.textContent = numberWeight.toFixed(2);

  const globalMatInput = document.getElementById('globalMatFile');
  const globalMatNameSpan = document.getElementById('globalMatName');

  globalMatInput.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const newTex = await loadTextureFromFile(f);
      if (materialTexture) {
        try { gl.deleteTexture(materialTexture); } catch (err) {}
      }
      materialTexture = newTex;
      console.log("Global material texture loaded:", f.name);
    } catch (err) {
      console.error("Failed to load global material texture:", err);
      alert("Failed to load material texture: " + err.message);
    }
  });

  matRange.addEventListener("input", (e) => {
    materialWeight = e.target.value / 100;
    matVal.textContent = materialWeight.toFixed(2);
  });
  numRange.addEventListener("input", (e) => {
    numberWeight = e.target.value / 100;
    numVal.textContent = numberWeight.toFixed(2);
  });

  window.addEventListener("keydown", (e) => {
    if (selectedMeshIndex >= 0 && sceneMeshes[selectedMeshIndex]) {
      const mesh = sceneMeshes[selectedMeshIndex];
      let moved = false;

      switch (e.key) {
        case "ArrowUp": case "w": case "W":
          mesh.position = mesh.position.add($V([0, 0, -MOVE_STEP]));
          moved = true;
          break;
        case "ArrowDown": case "s": case "S":
          mesh.position = mesh.position.add($V([0, 0, MOVE_STEP]));
          moved = true;
          break;
        case "ArrowLeft": case "a": case "A":
          mesh.position = mesh.position.add($V([-MOVE_STEP, 0, 0]));
          moved = true;
          break;
        case "ArrowRight": case "d": case "D":
          mesh.position = mesh.position.add($V([MOVE_STEP, 0, 0]));
          moved = true;
          break;
        case "q": case "Q": case "PageUp":
          mesh.position = mesh.position.add($V([0, MOVE_STEP, 0]));
          moved = true;
          break;
        case "e": case "E": case "PageDown":
          mesh.position = mesh.position.add($V([0, -MOVE_STEP, 0]));
          moved = true;
          break;
      }

      if (moved) {
        updateMeshModelFromPosition(mesh);
        refreshSelectedMeshPosDisplay();
        e.preventDefault();
        return;
      }
    }

    if (e.key === "1") rotateCubes = !rotateCubes;
    if (e.key === "2") rotatePedestalLocal = !rotatePedestalLocal;
    if (e.key === "3") rotatePedestalGlobal = !rotatePedestalGlobal;
    if (e.code === "Space") {
      rotateCubes = rotatePedestalLocal = rotatePedestalGlobal = false;
    }
    if (e.key === "r" || e.key === "R") {
      angleCube = anglePedestalLocal = anglePedestalGlobal = 0.0;
    }
  });
}

const sceneMeshes = [];
let selectedMeshIndex = -1;
const MOVE_STEP = 0.05;

function parseOBJ(text) {
  const lines = text.split('\n');
  const positions = [];
  const normals = [];
  const uvs = [];
  const vertices = [];
  const indices = [];

  const vertMap = new Map();

  function processFaceToken(tok) {
    const parts = tok.split('/');
    const v = parts[0] ? parseInt(parts[0], 10) - 1 : -1;
    const vt = (parts.length > 1 && parts[1] !== '') ? parseInt(parts[1], 10) - 1 : -1;
    const vn = (parts.length > 2 && parts[2] !== '') ? parseInt(parts[2], 10) - 1 : -1;
    return [v, vt, vn];
  }

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const tag = parts[0];
    if (tag === 'v') {
      positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (tag === 'vn') {
      normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (tag === 'vt') {
      const u = parseFloat(parts[1]);
      const v = parseFloat(parts[2]);
      uvs.push([u, v]);
    } else if (tag === 'f') {
      const faceTokens = parts.slice(1);
      for (let i = 2; i < faceTokens.length; i++) {
        const tri = [faceTokens[0], faceTokens[i - 1], faceTokens[i]];
        for (let tok of tri) {
          const [vIdx, vtIdx, vnIdx] = processFaceToken(tok);
          const key = `${vIdx}/${vtIdx}/${vnIdx}`;
          if (!vertMap.has(key)) {
            const pos = (vIdx >= 0 && vIdx < positions.length) ? positions[vIdx] : [0, 0, 0];
            const uv = (vtIdx >= 0 && vtIdx < uvs.length) ? uvs[vtIdx] : [0, 0];
            const nrm = (vnIdx >= 0 && vnIdx < normals.length) ? normals[vnIdx] : [0, 0, 0];
            const newIndex = vertices.length;
            vertices.push({ pos, uv, nrm });
            vertMap.set(key, newIndex);
          }
          indices.push(vertMap.get(key));
        }
      }
    }
  }

  const posFlat = new Float32Array(vertices.length * 3);
  const uvFlat = new Float32Array(vertices.length * 2);
  const normalFlat = new Float32Array(vertices.length * 3);
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    posFlat[i * 3 + 0] = v.pos[0];
    posFlat[i * 3 + 1] = v.pos[1];
    posFlat[i * 3 + 2] = v.pos[2];
    uvFlat[i * 2 + 0] = v.uv[0];
    uvFlat[i * 2 + 1] = v.uv[1];
    normalFlat[i * 3 + 0] = v.nrm[0];
    normalFlat[i * 3 + 1] = v.nrm[1];
    normalFlat[i * 3 + 2] = v.nrm[2];
  }

  const indexArray = (vertices.length > 65535) ? new Uint32Array(indices) : new Uint16Array(indices);

  return {
    positions: posFlat,
    uvs: uvFlat,
    normals: normalFlat,
    indices: indexArray,
    indexType: (indexArray instanceof Uint32Array) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
    vertexCount: vertices.length,
    indexCount: indices.length
  };
}

function createGLMeshFromParsed(parsed) {
  const mesh = {
    vao: null,
    buffers: {},
    indexCount: parsed.indexCount,
    indexType: parsed.indexType,
    boundingBox: null,
  };

  const posB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posB);
  gl.bufferData(gl.ARRAY_BUFFER, parsed.positions, gl.STATIC_DRAW);

  const uvB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvB);
  gl.bufferData(gl.ARRAY_BUFFER, parsed.uvs, gl.STATIC_DRAW);

  const idxB = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxB);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, parsed.indices, gl.STATIC_DRAW);

  const vaoLocal = gl.createVertexArray();
  gl.bindVertexArray(vaoLocal);

  gl.bindBuffer(gl.ARRAY_BUFFER, posB);
  const posLoc = aPosLoc;
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

  const uvLoc = aUVLoc;
  gl.bindBuffer(gl.ARRAY_BUFFER, uvB);
  if (uvLoc !== -1) {
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxB);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  mesh.vao = vaoLocal;
  mesh.buffers.pos = posB;
  mesh.buffers.uv = uvB;
  mesh.buffers.idx = idxB;

  return mesh;
}

function loadOBJFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        const parsed = parseOBJ(text);
        const meshGL = createGLMeshFromParsed(parsed);
        meshGL.position = $V([pedestalPosition.e(1), pedestalPosition.e(2), pedestalPosition.e(3)]);
        meshGL.rotationY = 0;
        updateMeshModelFromPosition(meshGL);
        meshGL.baseColor = [0.8, 0.8, 0.8];
        meshGL.materialTexture = null;
        meshGL.useGlobalMaterial = true;
        sceneMeshes.push(meshGL);
        addMeshControlsUI(meshGL, sceneMeshes.length - 1);
        resolve(meshGL);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}


function createGLTextureFromBitmap(bitmap) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function addMeshControlsUI(mesh, index) {
  const container = document.getElementById("meshControlsContainer");
  if (!container) return;

  const wrap = document.createElement("div");
  wrap.style.padding = "6px";
  wrap.style.border = "1px solid #333";
  wrap.style.borderRadius = "6px";
  wrap.style.background = "rgba(0,0,0,0.15)";
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.gap = "6px";

  const headerRow = document.createElement("div");
  headerRow.style.display = "flex";
  headerRow.style.justifyContent = "space-between";
  headerRow.style.alignItems = "center";

  const title = document.createElement("div");
  title.textContent = `Mesh ${index + 1}`;
  title.style.fontWeight = "600";
  title.style.cursor = "pointer";
  title.onclick = () => selectMesh(index);

  const selectBtn = document.createElement("button");
  selectBtn.textContent = "Select";
  selectBtn.onclick = () => selectMesh(index);

  headerRow.appendChild(title);
  headerRow.appendChild(selectBtn);
  wrap.appendChild(headerRow);

  const matInput = document.createElement("input");
  matInput.type = "file";
  matInput.accept = "image/*";
  matInput.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const tex = await loadTextureFromFile(f);
      if (mesh.materialTexture && mesh.materialTexture !== materialTexture) {
        gl.deleteTexture(mesh.materialTexture);
      }
      mesh.materialTexture = tex;
      mesh.baseColor = [1.0, 1.0, 1.0];
      console.log(`Assigned material to mesh ${index + 1}`);
    } catch (err) {
      console.error("Texture load failed:", err);
      alert("Failed to load texture: " + err.message);
    }
  });

  const matLabel = document.createElement("div");
  matLabel.textContent = "Material texture:";
  matLabel.style.marginBottom = "4px";
  wrap.appendChild(matLabel);
  wrap.appendChild(matInput);

  const checkWrap = document.createElement("div");
  checkWrap.style.marginTop = "6px";
  const useGlobalCheckbox = document.createElement("input");
  useGlobalCheckbox.type = "checkbox";
  useGlobalCheckbox.checked = true;
  useGlobalCheckbox.addEventListener("change", (e) => {
    mesh.useGlobalMaterial = e.target.checked;
  });
  const useGlobalLabel = document.createElement("label");
  useGlobalLabel.style.marginLeft = "6px";
  useGlobalLabel.textContent = "Use global material texture";
  checkWrap.appendChild(useGlobalCheckbox);
  checkWrap.appendChild(useGlobalLabel);
  wrap.appendChild(checkWrap);

  const posDisplay = document.createElement("div");
  posDisplay.style.fontSize = "12px";
  posDisplay.style.color = "#bbb";
  function refreshPos() {
    const p = mesh.position || $V([0, 0, 0]);
    posDisplay.textContent = `pos: ${p.e(1).toFixed(2)}, ${p.e(2).toFixed(2)}, ${p.e(3).toFixed(2)}`;
  }
  refreshPos();
  wrap.appendChild(posDisplay);
  mesh._ui = mesh._ui || {};
  mesh._ui.posDisplay = posDisplay;

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "Remove mesh";
  removeBtn.style.marginTop = "8px";
  removeBtn.addEventListener("click", () => {
    if (mesh.buffers) {
      if (mesh.buffers.pos) gl.deleteBuffer(mesh.buffers.pos);
      if (mesh.buffers.uv) gl.deleteBuffer(mesh.buffers.uv);
      if (mesh.buffers.idx) gl.deleteBuffer(mesh.buffers.idx);
    }
    if (mesh.vao) gl.deleteVertexArray(mesh.vao);
    if (mesh.materialTexture && mesh.materialTexture !== materialTexture) gl.deleteTexture(mesh.materialTexture);
    const idx = sceneMeshes.indexOf(mesh);
    if (idx >= 0) sceneMeshes.splice(idx, 1);
    wrap.remove();
    if (selectedMeshIndex === index) selectedMeshIndex = -1;
  });
  wrap.appendChild(removeBtn);

  container.appendChild(wrap);

  mesh._ui.wrap = wrap;
  mesh._ui.useGlobalCheckbox = useGlobalCheckbox;
  mesh._ui.removeBtn = removeBtn;

  function refreshSelectionVisual() {
    if (selectedMeshIndex === index) {
      wrap.style.border = "2px solid #66c";
      wrap.style.boxShadow = "0 0 8px rgba(102,204,255,0.12)";
    } else {
      wrap.style.border = "1px solid #333";
      wrap.style.boxShadow = "none";
    }
  }
  mesh._ui.refreshSelection = refreshSelectionVisual;
  refreshSelectionVisual();
}

function selectMesh(index) {
  if (index < 0 || index >= sceneMeshes.length) {
    selectedMeshIndex = -1;
  } else {
    selectedMeshIndex = index;
  }
  for (let i = 0; i < sceneMeshes.length; i++) {
    const m = sceneMeshes[i];
    if (m._ui && typeof m._ui.refreshSelection === "function") m._ui.refreshSelection();
  }
}

function refreshSelectedMeshPosDisplay() {
  if (selectedMeshIndex >= 0 && sceneMeshes[selectedMeshIndex]) {
    const mesh = sceneMeshes[selectedMeshIndex];
    if (mesh._ui && mesh._ui.posDisplay) {
      const p = mesh.position || $V([0, 0, 0]);
      mesh._ui.posDisplay.textContent = `pos: ${p.e(1).toFixed(2)}, ${p.e(2).toFixed(2)}, ${p.e(3).toFixed(2)}`;
    }
  }
}

function drawMesh(mesh, modelSylvester, materialTex, matWeight, baseColor) {
  const modelView = translation($V([0, -0.3, 0])).x(modelSylvester);
  const proj = perspective(Math.PI / 4, gl.canvas.width / gl.canvas.height, 0.1, 100.0);

  gl.uniformMatrix4fv(uProjectionLoc, false, sylvesterToGL(proj));
  gl.uniformMatrix4fv(uModelViewLoc, false, sylvesterToGL(modelView));
  gl.uniform3fv(uBaseColorLoc, new Float32Array(baseColor));
  gl.uniform1f(uMatWeightLoc, matWeight);
  gl.uniform1f(uNumWeightLoc, 0.0);

  const matToUse = materialTex ? materialTex : materialTexture;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, matToUse);
  gl.uniform1i(uMaterialTexLoc, 0);

  gl.bindVertexArray(mesh.vao);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, mesh.indexType, 0);
  gl.bindVertexArray(null);

  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
}

const objInput = document.getElementById('objFile');
if (objInput) {
  objInput.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const mesh = await loadOBJFile(f);
      mesh.baseColor = [0.9, 0.9, 0.9];
      mesh.model = translation(pedestalPosition).x(rotationY(0));
      console.log('OBJ loaded, vertices buffer created', mesh);
    } catch (err) {
      console.error('Failed to load OBJ:', err);
      alert('Failed to load OBJ: ' + err.message);
    }
  });
}

function main() {
  initGL();
  initShaders();
  initBuffers();
  initVAO();
  materialTexture = createDefaultMaterialTexture();
  buildNumberTextures();
  setupUI();
  requestAnimationFrame(renderLoop);
}

main();