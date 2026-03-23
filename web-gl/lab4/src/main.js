"use strict";

class GLMath {
  static sylvesterToGL(m) {
    const e = m.elements;
    const out = new Float32Array(16);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        out[c * 4 + r] = e[r][c];
      }
    }
    return out;
  }

  static identity() {
    return $M([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ]);
  }

  static translation(v) {
    return $M([
      [1, 0, 0, v.e(1)],
      [0, 1, 0, v.e(2)],
      [0, 0, 1, v.e(3)],
      [0, 0, 0, 1],
    ]);
  }

  static rotationY(a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return $M([
      [c, 0, s, 0],
      [0, 1, 0, 0],
      [-s, 0, c, 0],
      [0, 0, 0, 1],
    ]);
  }

  static scale(sx, sy, sz) {
    return $M([
      [sx, 0, 0, 0],
      [0, sy, 0, 0],
      [0, 0, sz, 0],
      [0, 0, 0, 1],
    ]);
  }

  static perspective(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    return $M([
      [f / aspect, 0, 0, 0],
      [0, f, 0, 0],
      [0, 0, (far + near) / (near - far), (2 * far * near) / (near - far)],
      [0, 0, -1, 0],
    ]);
  }
}


class ShaderProgram {
  constructor(gl, vertexSource, fragmentSource) {
    this.gl = gl;
    this.program = this._createProgram(vertexSource, fragmentSource);
    this.locations = this._getLocations();
  }

  _createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation error");
    }
    return shader;
  }

  _createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vs = this._createShader(gl.VERTEX_SHADER, vsSource);
    const fs = this._createShader(gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Program link error");
    }
    return program;
  }

  _getLocations() {
    const gl = this.gl;
    return {
      aPosition: gl.getAttribLocation(this.program, "position"),
      aUV: gl.getAttribLocation(this.program, "uv"),
      uModelView: gl.getUniformLocation(this.program, "modelView"),
      uProjection: gl.getUniformLocation(this.program, "projection"),
      uBaseColor: gl.getUniformLocation(this.program, "uBaseColor"),
      uMaterialTex: gl.getUniformLocation(this.program, "uMaterialTex"),
      uNumberTex: gl.getUniformLocation(this.program, "uNumberTex"),
      uNumWeight: gl.getUniformLocation(this.program, "uNumWeight"),
      uMatWeight: gl.getUniformLocation(this.program, "uMatWeight"),
    };
  }

  use() {
    this.gl.useProgram(this.program);
  }
}


class Texture2D {
  constructor(gl, texture) {
    this.gl = gl;
    this.texture = texture;
  }

  static async fromFile(gl, file) {
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
    return new Texture2D(gl, tex);
  }

  static fromCanvas(gl, canvasEl) {
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
    return new Texture2D(gl, tex);
  }

  static solidColor(gl, rgba) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const px = new Uint8Array(rgba);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new Texture2D(gl, tex);
  }

  bind(unit = 0) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }

  dispose() {
    if (this.texture) this.gl.deleteTexture(this.texture);
    this.texture = null;
  }
}


class CanvasGenerators {
  static makeNumberCanvas(n, size = 512) {
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

  static makeBlankCanvas(size = 512) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  }
}


class MeshGeometry {
  constructor(gl, { vao, posBuffer, uvBuffer, indexBuffer, indexCount, indexType }) {
    this.gl = gl;
    this.vao = vao;
    this.posBuffer = posBuffer;
    this.uvBuffer = uvBuffer;
    this.indexBuffer = indexBuffer;
    this.indexCount = indexCount;
    this.indexType = indexType;
  }

  static createCube(gl, attribLocations) {
    const s = 0.5;

    const positions = new Float32Array([
      -s, -s,  s,   s, -s,  s,   s,  s,  s,  -s,  s,  s,
      -s, -s, -s,  -s,  s, -s,   s,  s, -s,   s, -s, -s,
      -s,  s, -s,  -s,  s,  s,   s,  s,  s,   s,  s, -s,
      -s, -s, -s,   s, -s, -s,   s, -s,  s,  -s, -s,  s,
       s, -s, -s,   s,  s, -s,   s,  s,  s,   s, -s,  s,
      -s, -s, -s,  -s, -s,  s,  -s,  s,  s,  -s,  s, -s,
    ]);

    const uvs = new Float32Array([
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 0, 1, 1, 1, 1, 0,
      0, 0, 0, 1, 1, 1, 1, 0,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 0, 1, 1, 1, 1, 0,
      0, 0, 1, 0, 1, 1, 0, 1,
    ]);

    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23,
    ]);

    return MeshGeometry.fromData(gl, attribLocations, positions, uvs, indices);
  }

  static fromData(gl, attribLocations, positions, uvs, indices) {
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    if (attribLocations.aPosition !== -1) {
      gl.enableVertexAttribArray(attribLocations.aPosition);
      gl.vertexAttribPointer(attribLocations.aPosition, 3, gl.FLOAT, false, 0, 0);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    if (attribLocations.aUV !== -1) {
      gl.enableVertexAttribArray(attribLocations.aUV);
      gl.vertexAttribPointer(attribLocations.aUV, 2, gl.FLOAT, false, 0, 0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return new MeshGeometry(gl, {
      vao,
      posBuffer,
      uvBuffer,
      indexBuffer,
      indexCount: indices.length,
      indexType: indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
    });
  }

  dispose() {
    const gl = this.gl;
    if (this.posBuffer) gl.deleteBuffer(this.posBuffer);
    if (this.uvBuffer) gl.deleteBuffer(this.uvBuffer);
    if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.posBuffer = this.uvBuffer = this.indexBuffer = this.vao = null;
  }
}


class OBJParser {
  static parse(text, gl) {
    const lines = text.split("\n");
    const positions = [];
    const normals = [];
    const uvs = [];
    const vertices = [];
    const indices = [];
    const vertMap = new Map();

    function processFaceToken(tok) {
      const parts = tok.split("/");
      const v = parts[0] ? parseInt(parts[0], 10) - 1 : -1;
      const vt = (parts.length > 1 && parts[1] !== "") ? parseInt(parts[1], 10) - 1 : -1;
      const vn = (parts.length > 2 && parts[2] !== "") ? parseInt(parts[2], 10) - 1 : -1;
      return [v, vt, vn];
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const parts = line.split(/\s+/);
      const tag = parts[0];

      if (tag === "v") {
        positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
      } else if (tag === "vn") {
        normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
      } else if (tag === "vt") {
        uvs.push([parseFloat(parts[1]), parseFloat(parts[2])]);
      } else if (tag === "f") {
        const faceTokens = parts.slice(1);
        for (let i = 2; i < faceTokens.length; i++) {
          const tri = [faceTokens[0], faceTokens[i - 1], faceTokens[i]];
          for (const tok of tri) {
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
      indexType: indexArray instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
      indexCount: indices.length,
    };
  }
}


let _meshIdCounter = 1;

class SceneMesh {
  constructor(gl, geometry) {
    this.gl = gl;
    this.geometry = geometry;

    this.id = _meshIdCounter++;
    this.displayName = `Mesh ${this.id}`;

    this.position = $V([0, 0, 0]);
    this.rotationY = 0;
    this.model = GLMath.identity();

    this.baseColor = [0.8, 0.8, 0.8];
    this.materialTexture = null;
    this.useGlobalMaterial = true;

    this.ui = {
      wrap: null,
      posDisplay: null,
      refreshSelection: null,
      useGlobalCheckbox: null,
    };
  }

  updateModelMatrix() {
    this.model = GLMath.translation(this.position).x(GLMath.rotationY(this.rotationY || 0));
  }

  dispose() {
    if (this.geometry) this.geometry.dispose();
    this.geometry = null;

    if (this.materialTexture && this.materialTexture.dispose) {
      this.materialTexture.dispose();
    }
    this.materialTexture = null;
  }
}


class CubeCluster {
  constructor() {
    this.pedestalPosition = $V([3, 0, -6]);
    this.cubeOffsets = [
      $V([0, 1.0, 0]),
      $V([-1.0, 0, 0]),
      $V([1.0, 0, 0]),
      $V([0, 0.0, 0]),
    ];
    this.cubeColors = [
      [1.00, 0.84, 0.00],
      [0.75, 0.75, 0.75],
      [0.80, 0.50, 0.20],
      [1.00, 0.84, 0.00],
    ];

    this.angleCube = 0;
    this.anglePedestalLocal = 0;
    this.anglePedestalGlobal = 0;

    this.rotateCubes = false;
    this.rotatePedestalLocal = false;
    this.rotatePedestalGlobal = false;
  }

  update() {
    if (this.rotateCubes) this.angleCube += 0.03;
    if (this.rotatePedestalLocal) this.anglePedestalLocal += 0.02;
    if (this.rotatePedestalGlobal) this.anglePedestalGlobal += 0.015;
  }

  render(app) {
    const Rg = GLMath.rotationY(this.anglePedestalGlobal);
    const Tp = GLMath.translation(this.pedestalPosition);
    const Rp = GLMath.rotationY(this.anglePedestalLocal);
    const Rc = GLMath.rotationY(this.angleCube);

    for (let i = 0; i < this.cubeOffsets.length; i++) {
      const Tc = GLMath.translation(this.cubeOffsets[i]);
      const model = Rg.x(Tp).x(Rp).x(Tc).x(Rc);
      const numTexIndex = (i <= 2 ? i : 3);
      const numberTex = app.numberTextures[numTexIndex];
      const scale = (i === 0 ? 1.12 : 1.0);

      app.drawCube(
        model,
        this.cubeColors[i],
        numberTex,
        app.materialTexture,
        app.materialWeight,
        app.numberWeight,
        scale
      );
    }
  }

  resetRotation() {
    this.angleCube = 0;
    this.anglePedestalLocal = 0;
    this.anglePedestalGlobal = 0;
  }

  stopRotation() {
    this.rotateCubes = false;
    this.rotatePedestalLocal = false;
    this.rotatePedestalGlobal = false;
  }
}


class WebGLApp {
  constructor() {
    this.canvas = document.getElementById("glcanvas");
    if (!this.canvas) throw new Error("Canvas #glcanvas not found");

    this.gl = null;
    this.shader = null;

    this.cubeGeometry = null;
    this.materialTexture = null;
    this.numberTextures = [];

    this.materialWeight = 0.7;
    this.numberWeight = 1.0;

    this.cubeCluster = new CubeCluster();

    this.sceneMeshes = [];
    this.selectedMesh = null;
    this.moveStep = 0.05;

    this._renderLoop = this._renderLoop.bind(this);
  }

  static vertexShaderSource() {
    return `#version 300 es
in vec3 position;
in vec2 uv;

uniform mat4 modelView;
uniform mat4 projection;

out vec2 vUV;

void main() {
  vUV = uv;
  gl_Position = projection * modelView * vec4(position, 1.0);
}`;
  }

  static fragmentShaderSource() {
    return `#version 300 es
precision mediump float;

in vec2 vUV;

uniform vec3 uBaseColor;
uniform sampler2D uMaterialTex;
uniform sampler2D uNumberTex;
uniform float uNumWeight;

out vec4 outColor;

void main() {
  vec3 mat = texture(uMaterialTex, vUV).rgb;
  vec4 num = texture(uNumberTex, vUV);
  vec3 texCombined = mix(mat, num.rgb, num.a * uNumWeight);
  vec3 finalCol = texCombined * uBaseColor;
  outColor = vec4(finalCol, 1.0);
}`;
  }

  initGL() {
    const gl = this.canvas.getContext("webgl2", { antialias: true });
    if (!gl) throw new Error("WebGL2 not supported");

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    this.gl = gl;
  }

  initResources() {
    this.shader = new ShaderProgram(
      this.gl,
      WebGLApp.vertexShaderSource(),
      WebGLApp.fragmentShaderSource()
    );
    this.shader.use();

    this.cubeGeometry = MeshGeometry.createCube(this.gl, this.shader.locations);

    this.materialTexture = Texture2D.solidColor(this.gl, [200, 180, 150, 255]);
    this.numberTextures = [
      Texture2D.fromCanvas(this.gl, CanvasGenerators.makeNumberCanvas(1, 512)),
      Texture2D.fromCanvas(this.gl, CanvasGenerators.makeNumberCanvas(2, 512)),
      Texture2D.fromCanvas(this.gl, CanvasGenerators.makeNumberCanvas(3, 512)),
      Texture2D.fromCanvas(this.gl, CanvasGenerators.makeBlankCanvas(512)),
    ];
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(this.canvas.clientWidth * dpr);
    const height = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
  }

  setCommonUniforms(modelMatrix, baseColor, materialTex, numberTex, numWeight, matWeight) {
    const gl = this.gl;
    const proj = GLMath.perspective(Math.PI / 4, gl.canvas.width / gl.canvas.height, 0.1, 100.0);
    const modelView = GLMath.translation($V([0, -0.3, 0])).x(modelMatrix);

    gl.uniformMatrix4fv(this.shader.locations.uProjection, false, GLMath.sylvesterToGL(proj));
    gl.uniformMatrix4fv(this.shader.locations.uModelView, false, GLMath.sylvesterToGL(modelView));
    gl.uniform3fv(this.shader.locations.uBaseColor, new Float32Array(baseColor));

    if (this.shader.locations.uMatWeight) {
      gl.uniform1f(this.shader.locations.uMatWeight, matWeight);
    }
    if (this.shader.locations.uNumWeight) {
      gl.uniform1f(this.shader.locations.uNumWeight, numWeight);
    }

    materialTex.bind(0);
    gl.uniform1i(this.shader.locations.uMaterialTex, 0);

    numberTex.bind(1);
    gl.uniform1i(this.shader.locations.uNumberTex, 1);
  }

  drawCube(modelMatrix, baseColor, numberTex, materialTex, matWeight, numWeight, scale = 1.0) {
    const gl = this.gl;
    this.shader.use();

    const scaled = modelMatrix.x(GLMath.scale(scale, scale, scale));
    this.setCommonUniforms(
      scaled,
      baseColor,
      materialTex,
      numberTex,
      numWeight,
      matWeight
    );

    gl.bindVertexArray(this.cubeGeometry.vao);
    gl.drawElements(gl.TRIANGLES, this.cubeGeometry.indexCount, this.cubeGeometry.indexType, 0);
    gl.bindVertexArray(null);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  drawMesh(mesh) {
    const gl = this.gl;
    this.shader.use();

    const materialTex = (mesh.useGlobalMaterial || !mesh.materialTexture)
      ? this.materialTexture
      : mesh.materialTexture;

    this.setCommonUniforms(
      mesh.model || GLMath.identity(),
      mesh.baseColor || [0.8, 0.8, 0.8],
      materialTex,
      this.numberTextures[3],
      0.0,
      this.materialWeight
    );

    gl.bindVertexArray(mesh.geometry.vao);
    gl.drawElements(gl.TRIANGLES, mesh.geometry.indexCount, mesh.geometry.indexType, 0);
    gl.bindVertexArray(null);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  drawScene() {
    this.resizeCanvas();

    const gl = this.gl;
    gl.clearColor(0.07, 0.07, 0.09, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.cubeCluster.update();
    this.cubeCluster.render(this);

    for (const mesh of this.sceneMeshes) {
      this.drawMesh(mesh);
    }
  }

  _renderLoop() {
    this.drawScene();
    requestAnimationFrame(this._renderLoop);
  }

  start() {
    this.initGL();
    this.initResources();
    this.setupUI();
    this.setupFileInputs();
    requestAnimationFrame(this._renderLoop);
  }

  setupUI() {
    const numRange = document.getElementById("numRange");
    const numVal = document.getElementById("numVal");
    if (numRange && numVal) {
      numRange.value = Math.floor(this.numberWeight * 100);
      numVal.textContent = this.numberWeight.toFixed(2);

      numRange.addEventListener("input", (e) => {
        this.numberWeight = e.target.value / 100;
        numVal.textContent = this.numberWeight.toFixed(2);
      });
    }

    const globalMatInput = document.getElementById("globalMatFile");
    if (globalMatInput) {
      globalMatInput.addEventListener("change", async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        try {
          const newTex = await Texture2D.fromFile(this.gl, f);
          if (this.materialTexture) this.materialTexture.dispose();
          this.materialTexture = newTex;
          console.log("Global material texture loaded:", f.name);
        } catch (err) {
          console.error("Failed to load global material texture:", err);
          alert("Failed to load material texture: " + err.message);
        }
      });
    }

    window.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  setupFileInputs() {
    const objInput = document.getElementById("objFile");
    if (objInput) {
      objInput.addEventListener("change", async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        try {
          const mesh = await this.loadOBJFile(f);
          mesh.baseColor = [0.9, 0.9, 0.9];
          mesh.model = GLMath.translation(this.cubeCluster.pedestalPosition).x(GLMath.rotationY(0));
          console.log("OBJ loaded, vertices buffer created", mesh);
        } catch (err) {
          console.error("Failed to load OBJ:", err);
          alert("Failed to load OBJ: " + err.message);
        }
      });
    }
  }

  onKeyDown(e) {
    if (this.selectedMesh) {
      const mesh = this.selectedMesh;
      let moved = false;

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          mesh.position = mesh.position.add($V([0, 0, -this.moveStep]));
          moved = true;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          mesh.position = mesh.position.add($V([0, 0, this.moveStep]));
          moved = true;
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          mesh.position = mesh.position.add($V([-this.moveStep, 0, 0]));
          moved = true;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          mesh.position = mesh.position.add($V([this.moveStep, 0, 0]));
          moved = true;
          break;
        case "q":
        case "Q":
        case "PageUp":
          mesh.position = mesh.position.add($V([0, this.moveStep, 0]));
          moved = true;
          break;
        case "e":
        case "E":
        case "PageDown":
          mesh.position = mesh.position.add($V([0, -this.moveStep, 0]));
          moved = true;
          break;
      }

      if (moved) {
        mesh.updateModelMatrix();
        this.refreshSelectedMeshPosDisplay();
        e.preventDefault();
        return;
      }
    }

    if (e.key === "1") this.cubeCluster.rotateCubes = !this.cubeCluster.rotateCubes;
    if (e.key === "2") this.cubeCluster.rotatePedestalLocal = !this.cubeCluster.rotatePedestalLocal;
    if (e.key === "3") this.cubeCluster.rotatePedestalGlobal = !this.cubeCluster.rotatePedestalGlobal;

    if (e.code === "Space") {
      this.cubeCluster.stopRotation();
    }

    if (e.key === "r" || e.key === "R") {
      this.cubeCluster.resetRotation();
    }
  }

  async loadOBJFile(file) {
    const text = await file.text();
    const parsed = OBJParser.parse(text, this.gl);

    const geometry = this.createGLMeshFromParsed(parsed);
    const mesh = new SceneMesh(this.gl, geometry);

    mesh.position = $V([
      this.cubeCluster.pedestalPosition.e(1),
      this.cubeCluster.pedestalPosition.e(2),
      this.cubeCluster.pedestalPosition.e(3),
    ]);
    mesh.rotationY = 0;
    mesh.updateModelMatrix();
    mesh.baseColor = [0.8, 0.8, 0.8];
    mesh.useGlobalMaterial = true;

    this.sceneMeshes.push(mesh);
    this.addMeshControlsUI(mesh);
    return mesh;
  }

  createGLMeshFromParsed(parsed) {
    const gl = this.gl;
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, parsed.positions, gl.STATIC_DRAW);

    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, parsed.uvs, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, parsed.indices, gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    if (this.shader.locations.aPosition !== -1) {
      gl.enableVertexAttribArray(this.shader.locations.aPosition);
      gl.vertexAttribPointer(this.shader.locations.aPosition, 3, gl.FLOAT, false, 0, 0);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    if (this.shader.locations.aUV !== -1) {
      gl.enableVertexAttribArray(this.shader.locations.aUV);
      gl.vertexAttribPointer(this.shader.locations.aUV, 2, gl.FLOAT, false, 0, 0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return new MeshGeometry(gl, {
      vao,
      posBuffer,
      uvBuffer,
      indexBuffer,
      indexCount: parsed.indexCount,
      indexType: parsed.indexType,
    });
  }

  addMeshControlsUI(mesh) {
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
    title.textContent = mesh.displayName;
    title.style.fontWeight = "600";
    title.style.cursor = "pointer";
    title.onclick = () => this.selectMesh(mesh);

    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Select";
    selectBtn.onclick = () => this.selectMesh(mesh);

    headerRow.appendChild(title);
    headerRow.appendChild(selectBtn);
    wrap.appendChild(headerRow);

    const matLabel = document.createElement("div");
    matLabel.textContent = "Material texture:";
    matLabel.style.marginBottom = "4px";
    wrap.appendChild(matLabel);

    const matInput = document.createElement("input");
    matInput.type = "file";
    matInput.accept = "image/*";
    matInput.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const tex = await Texture2D.fromFile(this.gl, f);
        if (mesh.materialTexture && mesh.materialTexture !== this.materialTexture) {
          mesh.materialTexture.dispose();
        }
        mesh.materialTexture = tex;
        mesh.baseColor = [1.0, 1.0, 1.0];
        console.log(`Assigned material to ${mesh.displayName}`);
      } catch (err) {
        console.error("Texture load failed:", err);
        alert("Failed to load texture: " + err.message);
      }
    });
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

    const refreshPos = () => {
      const p = mesh.position || $V([0, 0, 0]);
      posDisplay.textContent = `pos: ${p.e(1).toFixed(2)}, ${p.e(2).toFixed(2)}, ${p.e(3).toFixed(2)}`;
    };
    refreshPos();
    wrap.appendChild(posDisplay);

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove mesh";
    removeBtn.style.marginTop = "8px";
    removeBtn.addEventListener("click", () => {
      this.removeMesh(mesh, wrap);
    });
    wrap.appendChild(removeBtn);

    container.appendChild(wrap);

    mesh.ui.wrap = wrap;
    mesh.ui.posDisplay = posDisplay;
    mesh.ui.useGlobalCheckbox = useGlobalCheckbox;
    mesh.ui.refreshSelection = () => {
      if (this.selectedMesh === mesh) {
        wrap.style.border = "2px solid #66c";
        wrap.style.boxShadow = "0 0 8px rgba(102,204,255,0.12)";
      } else {
        wrap.style.border = "1px solid #333";
        wrap.style.boxShadow = "none";
      }
    };

    mesh.ui.refreshSelection();
  }

  selectMesh(mesh) {
    this.selectedMesh = mesh || null;
    for (const m of this.sceneMeshes) {
      if (m.ui && typeof m.ui.refreshSelection === "function") {
        m.ui.refreshSelection();
      }
    }
  }

  removeMesh(mesh, wrap) {
    const idx = this.sceneMeshes.indexOf(mesh);
    if (idx >= 0) this.sceneMeshes.splice(idx, 1);

    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.materialTexture && mesh.materialTexture !== this.materialTexture) {
      mesh.materialTexture.dispose();
    }

    if (this.selectedMesh === mesh) {
      this.selectedMesh = null;
    }

    if (wrap) wrap.remove();
  }

  refreshSelectedMeshPosDisplay() {
    const mesh = this.selectedMesh;
    if (!mesh || !mesh.ui || !mesh.ui.posDisplay) return;

    const p = mesh.position || $V([0, 0, 0]);
    mesh.ui.posDisplay.textContent = `pos: ${p.e(1).toFixed(2)}, ${p.e(2).toFixed(2)}, ${p.e(3).toFixed(2)}`;
  }
}

function main() {
  const app = new WebGLApp();
  app.start();
}

main();