"use strict";

function createDummyTexture2D(gl, color = [0,0,0,255]) {
  return Texture2D.solidColor(gl, color);
}

function createDummyTexture3D(gl, size = 2) {
  const data = new Uint8Array(size * size * size * 4);
  data.fill(255);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_3D, null);
  return tex;
}



class GLMath {
  static sylvesterToGL4x4(m) {
    const e = m.elements;
    const out = new Float32Array(16);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        out[c * 4 + r] = e[r][c];
      }
    }
    return out;
  }

  static sylvesterToGL3x3(m) {
    const e = m.elements;
    const out = new Float32Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        out[c * 3 + r] = e[r][c];
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

  static normalMatrix(modelView) {
    const inv = modelView.inverse();
    const invT = inv.transpose();
    const e = invT.elements;
    return $M([
      [e[0][0], e[0][1], e[0][2]],
      [e[1][0], e[1][1], e[1][2]],
      [e[2][0], e[2][1], e[2][2]],
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
      aNormal: gl.getAttribLocation(this.program, "normal_in"),
      aTangent: gl.getAttribLocation(this.program, "tangent_in"),
      aUV: gl.getAttribLocation(this.program, "uv_coords_in"),

      uModel: gl.getUniformLocation(this.program, "transform.model"),
      uView: gl.getUniformLocation(this.program, "transform.view"),
      uProjection: gl.getUniformLocation(this.program, "transform.projection"),
      uNormalMat: gl.getUniformLocation(this.program, "transform.normal_mat"),

      uViewPos: gl.getUniformLocation(this.program, "view_pos"),
      uLightPos: gl.getUniformLocation(this.program, "light_pos"),
      uTex: gl.getUniformLocation(this.program, "tex"),
      uMapping: gl.getUniformLocation(this.program, "mapping"),
      uBumpStrength: gl.getUniformLocation(this.program, "bump_strength"),
      uBumpOrNormal: gl.getUniformLocation(this.program, "bump_or_normal"),

      uAmbient: gl.getUniformLocation(this.program, "material.ambient"),
      uDiffuse: gl.getUniformLocation(this.program, "material.diffuse"),
      uSpecular: gl.getUniformLocation(this.program, "material.specular"),
      uSheenCoef: gl.getUniformLocation(this.program, "material.sheen_coef"),
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
  constructor(gl, { vao, posBuffer, normalBuffer, tangentBuffer,
    uvBuffer, indexBuffer, indexCount, indexType }) {
    this.gl = gl;
    this.vao = vao;
    this.posBuffer = posBuffer;
    this.normalBuffer = normalBuffer;
    this.tangentBuffer = tangentBuffer;
    this.uvBuffer = uvBuffer;
    this.indexBuffer = indexBuffer;
    this.indexCount = indexCount;
    this.indexType = indexType;
  }

  static computeTangents(positions, uvs, indices, normals = null) {
    const vertCount = positions.length / 3;
    const tanAccum = Array.from({ length: vertCount }, () => [0, 0, 0]);

    const hasUVs = uvs && uvs.length >= vertCount * 2;
    const hasNormals = normals && normals.length >= vertCount * 3;

    const getPos = (i) => [
      positions[i * 3 + 0],
      positions[i * 3 + 1],
      positions[i * 3 + 2],
    ];

    const getUV = (i) => [
      hasUVs ? uvs[i * 2 + 0] : 0.0,
      hasUVs ? uvs[i * 2 + 1] : 0.0,
    ];

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i + 0];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];

      const p0 = getPos(i0);
      const p1 = getPos(i1);
      const p2 = getPos(i2);

      const uv0 = getUV(i0);
      const uv1 = getUV(i1);
      const uv2 = getUV(i2);

      const edge1 = [
        p1[0] - p0[0],
        p1[1] - p0[1],
        p1[2] - p0[2],
      ];
      const edge2 = [
        p2[0] - p0[0],
        p2[1] - p0[1],
        p2[2] - p0[2],
      ];

      const deltaUV1 = [
        uv1[0] - uv0[0],
        uv1[1] - uv0[1],
      ];
      const deltaUV2 = [
        uv2[0] - uv0[0],
        uv2[1] - uv0[1],
      ];

      const denom = deltaUV1[0] * deltaUV2[1] - deltaUV2[0] * deltaUV1[1];
      if (Math.abs(denom) < 1e-8) continue;

      const f = 1.0 / denom;

      const tangent = [
        f * (deltaUV2[1] * edge1[0] - deltaUV1[1] * edge2[0]),
        f * (deltaUV2[1] * edge1[1] - deltaUV1[1] * edge2[1]),
        f * (deltaUV2[1] * edge1[2] - deltaUV1[1] * edge2[2]),
      ];

      tanAccum[i0][0] += tangent[0];
      tanAccum[i0][1] += tangent[1];
      tanAccum[i0][2] += tangent[2];

      tanAccum[i1][0] += tangent[0];
      tanAccum[i1][1] += tangent[1];
      tanAccum[i1][2] += tangent[2];

      tanAccum[i2][0] += tangent[0];
      tanAccum[i2][1] += tangent[1];
      tanAccum[i2][2] += tangent[2];
    }

    const tangents = new Float32Array(vertCount * 3);

    for (let i = 0; i < vertCount; i++) {
      let tx = tanAccum[i][0];
      let ty = tanAccum[i][1];
      let tz = tanAccum[i][2];

      if (hasNormals) {
        const nx = normals[i * 3 + 0];
        const ny = normals[i * 3 + 1];
        const nz = normals[i * 3 + 2];

        const dot = nx * tx + ny * ty + nz * tz;
        tx -= nx * dot;
        ty -= ny * dot;
        tz -= nz * dot;
      }

      const len = Math.hypot(tx, ty, tz);
      if (len < 1e-8) {
        tangents[i * 3 + 0] = 1;
        tangents[i * 3 + 1] = 0;
        tangents[i * 3 + 2] = 0;
      } else {
        tangents[i * 3 + 0] = tx / len;
        tangents[i * 3 + 1] = ty / len;
        tangents[i * 3 + 2] = tz / len;
      }
    }

    return tangents;
  }

  static fromData(gl, attribLocations, positions, normals, tangents, uvs, indices) {
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const normBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

    const tanBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tanBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, tangents, gl.STATIC_DRAW);

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

    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    if (attribLocations.aNormal !== -1) {
      gl.enableVertexAttribArray(attribLocations.aNormal);
      gl.vertexAttribPointer(attribLocations.aNormal, 3, gl.FLOAT, false, 0, 0);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, tanBuffer);
    if (attribLocations.aTangent !== -1) {
      gl.enableVertexAttribArray(attribLocations.aTangent);
      gl.vertexAttribPointer(attribLocations.aTangent, 3, gl.FLOAT, false, 0, 0);
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
      normalBuffer,
      tangentBuffer,
      uvBuffer,
      indexBuffer,
      indexCount: indices.length,
      indexType: indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
    });
  }

  dispose() {
    const gl = this.gl;
    if (this.posBuffer) gl.deleteBuffer(this.posBuffer);
    if (this.normalBuffer) gl.deleteBuffer(this.normalBuffer);
    if (this.tangentBuffer) gl.deleteBuffer(this.tangentBuffer);
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
    const tangents = MeshGeometry.computeTangents(posFlat, uvFlat, indexArray, normalFlat);

    return {
      positions: posFlat,
      normals: normalFlat,
      tangents,
      uvs: uvFlat,
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

    this.materialTexture = null;
    this.mappingTexture = null;
    this.bumpStrength = 0.1;
    this.bumpOrNormal = true;
    this.useGlobalMaterial = true;

    this.ui = {
      wrap: null,
      posDisplay: null,
      refreshSelection: null,
      useGlobalCheckbox: null,
      bumpStrengthSlider: null,
      bumpOrNormalSelect: null,
      mappingFileInfo: null,
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

    if (this.mappingTexture && this.mappingTexture.dispose) {
      this.mappingTexture.dispose();
    }
    this.mappingTexture = null;
  }
}

// ------------------ this is only for lut texture generation -------------------

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3.0 - 2.0 * t);
}

function makeLUTTexture(gl, size = 16) {
  const data = new Uint8Array(size * size * size * 4);
  let p = 0;

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        let rr = r / (size - 1);
        let gg = g / (size - 1);
        let bb = b / (size - 1);

        const lum = rr * 0.2126 + gg * 0.7152 + bb * 0.0722;
        const shadow = smoothstep(0.0, 0.45, 1.0 - lum);
        const highlight = smoothstep(0.45, 1.0, lum);

        rr = rr / (rr + 1.0);
        gg = gg / (gg + 1.0);
        bb = bb / (bb + 1.0);

        rr *= 1.0 + 0.10 * highlight - 0.05 * shadow;
        gg *= 1.0 + 0.02 * highlight;
        bb *= 1.0 + 0.08 * shadow - 0.03 * highlight;

        const contrast = 1.08;
        rr = (rr - 0.5) * contrast + 0.5;
        gg = (gg - 0.5) * contrast + 0.5;
        bb = (bb - 0.5) * contrast + 0.5;

        const sat = 1.12;
        const gray = rr * 0.299 + gg * 0.587 + bb * 0.114;
        rr = gray + (rr - gray) * sat;
        gg = gray + (gg - gray) * sat;
        bb = gray + (bb - gray) * sat;

        data[p++] = Math.round(clamp01(rr) * 255);
        data[p++] = Math.round(clamp01(gg) * 255);
        data[p++] = Math.round(clamp01(bb) * 255);
        data[p++] = 255;
      }
    }
  }

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_3D, null);

  return tex;
}

// -------------------------------------------------------------------


class WebGLApp {
  constructor() {
    this.canvas = document.getElementById("glcanvas");
    if (!this.canvas) throw new Error("Canvas #glcanvas not found");

    this.gl = null;
    this.shader = null;
    this.materialTexture = null;
    this.defaultMappingTexture = null;

    this.dummyDepthTex = null;
    this.dummyDofBlurTex = null;
    this.dummyLutTex = null;

    this.sceneMeshes = [];
    this.selectedMesh = null;
    this.moveStep = 0.05;

    this._fps = 0;
    this._fpsTime = 0;
    this._fpsFrames = 0;
    this._fpsElement = document.getElementById("fpsCounter");

    this._renderLoop = this._renderLoop.bind(this);
  }

  static vertexShaderSource() {
    return `#version 300 es

in vec3 position;
in vec3 normal_in;
in vec3 tangent_in;
in vec2 uv_coords_in;

uniform struct Transform {
	mat4 model;
	mat4 view;
	mat4 projection;
	mat3 normal_mat;
} transform;

out mat3 TBN;
out	vec3 frag_pos;
out	vec2 uv_coords;

void main() {	
  vec3 T = normalize(vec3(transform.normal_mat * tangent_in));
  vec3 N = normalize(vec3(transform.normal_mat * normal_in));
  
  T = normalize(T - dot(T, N) * N);
  vec3 B = normalize(cross(N, T));
  
  TBN = mat3(T, B, N);
  
  vec4 world_pos = transform.model * vec4(position, 1.0);
	frag_pos = world_pos.xyz;
	
  uv_coords = uv_coords_in;
	gl_Position = transform.projection * transform.view * world_pos;
}`;
  }

  static fragmentShaderSource() {
    return `#version 300 es
    precision mediump float;

    in mat3 TBN;
    in vec3 frag_pos;
    in vec2 uv_coords;

    uniform vec3 view_pos;
    uniform vec3 light_pos;
    uniform sampler2D tex;
    uniform sampler2D mapping;
    uniform float bump_strength;
    uniform bool bump_or_normal;

    uniform struct Material {
      vec3 ambient;
      vec3 diffuse;
      vec3 specular;
      float sheen_coef;
      vec3 emissive_color;
      float emissive_strength;
    } material;

    out vec4 frag_color;

    void main() {
      vec3 new_normal;
      if (bump_or_normal) {
        vec2 t = 1.0 / vec2(textureSize(mapping, 0));

        float h_u1 = texture(mapping, vec2(uv_coords.x - t.x, uv_coords.y)).r;
        float h_u2 = texture(mapping, vec2(uv_coords.x + t.x, uv_coords.y)).r;
        float h_v1 = texture(mapping, vec2(uv_coords.x, uv_coords.y - t.y)).r;
        float h_v2 = texture(mapping, vec2(uv_coords.x, uv_coords.y + t.y)).r;

        float grad_u = (h_u2 - h_u1) * 0.5 * bump_strength;
        float grad_v = (h_v2 - h_v1) * 0.5 * bump_strength;
        new_normal = normalize(vec3(-grad_u, -grad_v, 1.0));
      } else {
        vec3 n = texture(mapping, uv_coords).rgb;
        new_normal = normalize(n * 2.0 - 1.0);
      }

      vec3 normal_world = normalize(TBN * new_normal);
      vec3 light_dir = normalize(light_pos - frag_pos);
      vec3 view_dir = normalize(view_pos - frag_pos);
      vec3 refl_dir = reflect(-light_dir, normal_world);

      float norm_d_light = max(dot(normal_world, light_dir), 0.0);
      float view_d_refl = max(dot(view_dir, refl_dir), 0.0);

      vec3 base_color = texture(tex, uv_coords).rgb;
      vec3 ambient = base_color * material.ambient;
      vec3 diffuse = base_color * material.diffuse * norm_d_light;
      vec3 specular = pow(view_d_refl, material.sheen_coef) * material.specular;
      vec3 emissive = material.emissive_color * material.emissive_strength;

      frag_color = vec4(ambient + diffuse + specular + emissive, 1.0);
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

    this.materialTexture = Texture2D.solidColor(this.gl, [200, 180, 150, 255]);
    this.defaultMappingTexture = Texture2D.solidColor(this.gl, [128, 128, 255, 255]);

    this.dummyDepthTex = createDummyTexture2D(this.gl, [255,255,255,255]);
    this.dummyDofBlurTex = createDummyTexture2D(this.gl, [128,128,128,255]);
    this.dummyLutTex = createDummyTexture3D(this.gl, 2);
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(2, Math.floor(this.canvas.clientWidth * dpr * this.renderScale));
    const height = Math.max(2, Math.floor(this.canvas.clientHeight * dpr * this.renderScale));
    
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
  }

  updateAnimations(timeSeconds) {
    if (!this.postFX.animate) return;

    const speed1 = 1.7;  // bloom
    const speed2 = 3.2;  // grain
    const speed3 = 0.8;  // dof
    const speed4 = 2.1;  // vignette

    const ampBloom = 0.6;
    const ampGrain = 0.15;
    const ampDof   = 3.0;
    const ampVignette = 0.5;

    const baseBloom = this.postFX.bloomIntensityBase || this.postFX.bloomIntensity;
    const baseGrain = this.postFX.grainIntensityBase || this.postFX.grainIntensity;
    const baseDof   = this.postFX.dofApertureBase || this.postFX.dofAperture;
    const baseVignette = this.postFX.vignetteStrengthBase || this.postFX.vignetteStrength;

    this.postFX.bloomIntensity  = baseBloom + Math.sin(timeSeconds * speed1) * ampBloom;
    this.postFX.grainIntensity  = baseGrain + Math.sin(timeSeconds * speed2) * ampGrain;
    this.postFX.dofAperture     = baseDof   + Math.sin(timeSeconds * speed3) * ampDof;
    this.postFX.vignetteStrength = baseVignette + Math.sin(timeSeconds * speed4) * ampVignette;

    this.postFX.bloomIntensity  = Math.max(0, this.postFX.bloomIntensity);
    this.postFX.grainIntensity  = Math.max(0, this.postFX.grainIntensity);
    this.postFX.dofAperture     = Math.max(0, this.postFX.dofAperture);
    this.postFX.vignetteStrength = Math.max(0, this.postFX.vignetteStrength);
  }

  updateAdaptiveQuality(dt) {
    this._qualityAccumulator += dt;
    this._qualityFrames += 1;
    if (this._qualityAccumulator < 1.0) return;

    const fps = this._qualityFrames / this._qualityAccumulator;
    this.fpsEMA = this.fpsEMA * 0.8 + fps * 0.2;

    const low = 42;
    const high = 58;
    let changed = false;

    if (this.fpsEMA < low && this.renderScaleIndex < this.renderScaleLevels.length - 1) {
      this.renderScaleIndex += 1;
      changed = true;
    } else if (this.fpsEMA > high && this.renderScaleIndex > 0) {
      this.renderScaleIndex -= 1;
      changed = true;
    }

    this.renderScale = this.renderScaleLevels[this.renderScaleIndex];
    this._qualityAccumulator = 0;
    this._qualityFrames = 0;

    if (changed) {
      this.resizeCanvas();
      this.recreateRenderTargets();
    }
  };

  getFocusDepth() {
      if (!this.postFX.autoFocus || !this.selectedMesh) return this.postFX.focusDepth;
      
      const pos = this.selectedMesh.position;
      if (!pos || typeof pos.e !== 'function') return this.postFX.focusDepth;

      const cameraZ = 6.0;
      const objectZ = pos.e(3);

      const viewZ = cameraZ - objectZ;
      return Math.max(0.2, viewZ);
  }

  setCommonUniforms(modelMatrix, materialTex, mappingTex, bumpStrength, bumpOrNormal) {
    const gl = this.gl;
    const view = GLMath.translation($V([0, -0.3, 0]));
    const proj = GLMath.perspective(Math.PI / 4, gl.canvas.width / gl.canvas.height, 0.1, 100.0);
    const modelView = view.x(modelMatrix);
    const normMat = GLMath.normalMatrix(modelView);

    gl.uniformMatrix4fv(this.shader.locations.uModel, false, GLMath.sylvesterToGL4x4(modelMatrix));
    gl.uniformMatrix4fv(this.shader.locations.uView, false, GLMath.sylvesterToGL4x4(view));
    gl.uniformMatrix4fv(this.shader.locations.uProjection, false, GLMath.sylvesterToGL4x4(proj));
    gl.uniformMatrix3fv(this.shader.locations.uNormalMat, false, GLMath.sylvesterToGL3x3(normMat));

    gl.uniform3f(this.shader.locations.uViewPos, 0.0, 0.0, 3.0);
    gl.uniform3f(this.shader.locations.uLightPos, -2.0, 0.8, 3.0);

    gl.uniform1f(this.shader.locations.uBumpStrength, bumpStrength);
    gl.uniform1i(this.shader.locations.uBumpOrNormal, bumpOrNormal ? 1 : 0);

    gl.uniform3f(this.shader.locations.uAmbient, 0.5, 0.5, 0.5);
    gl.uniform3f(this.shader.locations.uDiffuse, 1.0, 1.0, 1.0);
    gl.uniform3f(this.shader.locations.uSpecular, 1.0, 1.0, 1.0);
    gl.uniform1f(this.shader.locations.uSheenCoef, 16.0);

    materialTex.bind(0);
    gl.uniform1i(this.shader.locations.uTex, 0);

    mappingTex.bind(1);
    gl.uniform1i(this.shader.locations.uMapping, 1);
  }

  drawMesh(mesh) {
    const gl = this.gl;
    this.shader.use();

    const materialTex = (mesh.useGlobalMaterial || !mesh.materialTexture)
      ? this.materialTexture
      : mesh.materialTexture;

    const mappingTex = mesh.mappingTexture || this.defaultMappingTexture;
    const bumpStrength = mesh.bumpStrength;
    const bumpOrNormal = mesh.bumpOrNormal;

    this.setCommonUniforms(
      mesh.model || GLMath.identity(),
      materialTex,
      mappingTex,
      bumpStrength,
      bumpOrNormal
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
          mesh.model = GLMath.identity();
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
  }

  async loadOBJFile(file) {
    const text = await file.text();
    const parsed = OBJParser.parse(text, this.gl);

    const geometry = this.createGLMeshFromParsed(parsed);
    const mesh = new SceneMesh(this.gl, geometry);

    mesh.position = $V([0, 0, 0]);
    mesh.rotationY = 0;
    mesh.updateModelMatrix();
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

    const normBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, parsed.normals, gl.STATIC_DRAW);

    const tanBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tanBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, parsed.tangents, gl.STATIC_DRAW);

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

    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    if (this.shader.locations.aNormal !== -1) {
      gl.enableVertexAttribArray(this.shader.locations.aNormal);
      gl.vertexAttribPointer(this.shader.locations.aNormal, 3, gl.FLOAT, false, 0, 0);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, tanBuffer);
    if (this.shader.locations.aTangent !== -1) {
      gl.enableVertexAttribArray(this.shader.locations.aTangent);
      gl.vertexAttribPointer(this.shader.locations.aTangent, 3, gl.FLOAT, false, 0, 0);
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
      normBuffer,
      tanBuffer,
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
    if (mesh.mappingTexture) mesh.mappingTexture.dispose();

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

// ------------------ here is the stuff for lab 7 --------------------------

function makeUnitBoxData() {
  const p = [];
  const n = [];
  const u = [];
  const i = [];

  const faces = [
    { normal: [1, 0, 0],  corners: [[1,-1,-1],[1,-1, 1],[1, 1, 1],[1, 1,-1]] },
    { normal: [-1, 0, 0], corners: [[-1,-1, 1],[-1,-1,-1],[-1, 1,-1],[-1, 1, 1]] },
    { normal: [0, 1, 0],  corners: [[-1,1,-1],[1,1,-1],[1,1, 1],[-1,1, 1]] },
    { normal: [0,-1, 0],  corners: [[-1,-1, 1],[1,-1, 1],[1,-1,-1],[-1,-1,-1]] },
    { normal: [0, 0, 1],  corners: [[-1,-1,1],[-1, 1,1],[1, 1,1],[1,-1,1]] },
    { normal: [0, 0,-1],  corners: [[1,-1,-1],[1, 1,-1],[-1, 1,-1],[-1,-1,-1]] },
  ];
  const uvFace = [[0,0],[1,0],[1,1],[0,1]];
  let base = 0;
  for (const face of faces) {
    for (let k = 0; k < 4; k++) {
      p.push(...face.corners[k]);
      n.push(...face.normal);
      u.push(...uvFace[k]);
    }
    i.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3);
    base += 4;
  }
  return {
    positions: new Float32Array(p),
    normals: new Float32Array(n),
    uvs: new Float32Array(u),
    indices: new Uint16Array(i),
  };
}

function makeSphereData(latSegments = 32, lonSegments = 32, radius = 1.0) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const latCount = latSegments;
  const lonCount = lonSegments;

  for (let lat = 0; lat <= latCount; lat++) {
    const v = lat / latCount;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= lonCount; lon++) {
      const u = lon / lonCount;
      const phi = u * Math.PI * 2.0;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = sinTheta * cosPhi;
      const y = cosTheta;
      const z = sinTheta * sinPhi;

      positions.push(x * radius, y * radius, z * radius);
      normals.push(x, y, z);
      uvs.push(u, 1.0 - v);
    }
  }

  for (let lat = 0; lat < latCount; lat++) {
    for (let lon = 0; lon < lonCount; lon++) {
      const a = lat * (lonCount + 1) + lon;
      const b = (lat + 1) * (lonCount + 1) + lon;
      const c = b + 1;
      const d = a + 1;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
  };
}

function makeFullscreenQuadData() {
  return {
    positions: new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]),
  };
}

function makePostVertexSource() {
  return `#version 300 es
in vec2 position;
out vec2 vTexCoord;

void main() {
  vTexCoord = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;
}

function makeThresholdFragmentSource() {
  return `#version 300 es
precision highp float;

in vec2 vTexCoord;
uniform sampler2D u_scene;
uniform float u_threshold;
out vec4 frag_color;

void main() {
  vec3 color = texture(u_scene, vTexCoord).rgb;
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float soft = clamp((luminance - u_threshold) / max(1.0 - u_threshold, 0.0001), 0.0, 1.0);
  frag_color = vec4(color * soft, 1.0);
}`;
}

function makeBlurFragmentSource() {
  return `#version 300 es
precision highp float;

in vec2 vTexCoord;
uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform vec2 u_direction;
out vec4 frag_color;

void main() {
  vec4 sum = texture(u_image, vTexCoord) * 0.2270270270;
  sum += texture(u_image, vTexCoord + u_direction * u_texelSize * 1.3846153846 * 1.5) * 0.3162162162;
  sum += texture(u_image, vTexCoord - u_direction * u_texelSize * 1.3846153846 * 1.5) * 0.3162162162;
  sum += texture(u_image, vTexCoord + u_direction * u_texelSize * 3.2307692308 * 1.5) * 0.0702702703;
  sum += texture(u_image, vTexCoord - u_direction * u_texelSize * 3.2307692308 * 1.5) * 0.0702702703;
  frag_color = sum;
}`;
}

function makeCopyFragmentSource() {
  return `#version 300 es
precision highp float;

in vec2 vTexCoord;
uniform sampler2D u_image;

out vec4 frag_color;

void main() {
  frag_color = texture(u_image, vTexCoord);
}`;
}

function makeCompositeFragmentSource() {
  return `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 vTexCoord;

uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform sampler2D u_depth;
uniform sampler2D u_dofBlur;
uniform sampler3D u_lut;

uniform vec2 u_resolution;
uniform float u_time;

uniform float u_near;
uniform float u_far;
uniform float u_focus;
uniform float u_focusWidth;
uniform float u_dofAperture;

uniform float u_lutIntensity;

uniform float u_bloomIntensity;

uniform float u_vignetteStrength;
uniform float u_vignetteRadius;

uniform float u_grainIntensity;

uniform bool u_useBloom;
uniform bool u_useDOF;
uniform bool u_useLUT;
uniform bool u_useVignette;
uniform bool u_useGrain;

out vec4 frag_color;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

float getBlurRadius(float depth) {
  return abs(depth - u_focus) * u_dofAperture;
}

float linearizeDepth(float d) {
    float z = d * 2.0 - 1.0; // back to NDC
    return (2.0 * u_near * u_far) / (u_far + u_near - z * (u_far - u_near));
}

void main() {
  vec4 scene = texture(u_scene, vTexCoord);
  vec3 color = scene.rgb;

  if (u_useDOF) {
    float depth = texture(u_depth, vTexCoord).r;
    float linearDepth = linearizeDepth(depth);

    float coc = (linearDepth - u_focus) / linearDepth;
    coc = abs(coc) * u_dofAperture;
    float blurFactor = smoothstep(0.0, 1.0, coc);

    vec3 blurred = texture(u_dofBlur, vTexCoord).rgb;
    color = mix(color, blurred, blurFactor);
  }

  if (u_useBloom) {
    color += texture(u_bloom, vTexCoord).rgb * u_bloomIntensity;
  }

  if (u_useLUT) {
    vec3 graded = texture(u_lut, clamp(color, 0.0, 1.0)).rgb;
    color = mix(color, graded, u_lutIntensity);
  }

  if (u_useGrain) {
    float g = hash(vTexCoord * u_resolution + vec2(u_time * 60.0, u_time * 31.7));
    color += (g - 0.5) * u_grainIntensity;
  }

  if (u_useVignette) {
    float dist = distance(vTexCoord, vec2(0.5));
    float vig = 1.0 - smoothstep(u_vignetteRadius * 0.55, u_vignetteRadius, dist) * u_vignetteStrength;
    color *= vig;
  }

  frag_color = vec4(clamp(color, 0.0, 1.0), scene.a);
}`;
}

function createQuadVao(gl, program, buffer) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const loc = gl.getAttribLocation(program.program, "position");
  if (loc !== -1) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return vao;
}

function createRenderTarget(gl, width, height, depthTexture = false) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  let depth = null;
  if (depthTexture) {
    depth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depth);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  }

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    throw new Error("Framebuffer is incomplete");
  }

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { fbo, texture, depth, width, height };
}

function deleteRenderTarget(gl, target) {
  if (!target) return;
  if (target.texture) gl.deleteTexture(target.texture);
  if (target.depthTexture) gl.deleteTexture(target.depthTexture);
  if (target.fbo) gl.deleteFramebuffer(target.fbo);
}

function createPrimitiveMesh(app, {
  name,
  color,
  position,
  scale,
  emissiveColor,
  emissiveStrength = 0.0,
  autoRotate = false,
  rotationY = 0.0,
  primitive = "box",
}) {
  const gl = app.gl;
  let data;
  if (primitive === "sphere") {
    data = makeSphereData(40, 40, 1.0);
  } else {
    data = makeUnitBoxData();
  }
  const parsed = {
    positions: data.positions,
    normals: data.normals,
    tangents: MeshGeometry.computeTangents(data.positions, data.uvs, data.indices, data.normals),
    uvs: data.uvs,
    indices: data.indices,
    indexType: gl.UNSIGNED_SHORT,
    indexCount: data.indices.length,
  };

  const geometry = app.createGLMeshFromParsed(parsed);
  const mesh = new SceneMesh(gl, geometry);

  mesh.displayName = name || mesh.displayName;
  mesh.position = position || $V([0, 0, 0]);
  mesh.scale = scale || $V([1, 1, 1]);
  mesh.rotationY = rotationY;
  mesh.autoRotate = autoRotate;
  mesh.autoRotateSpeed = 0.6 + Math.random() * 0.5;
  mesh.materialTexture = Texture2D.solidColor(gl, color || [200, 200, 200, 255]);
  mesh.useGlobalMaterial = false;
  mesh.bumpStrength = 0.0;
  mesh.bumpOrNormal = true;
  mesh.emissiveColor = emissiveColor || $V([0, 0, 0]);
  mesh.emissiveStrength = emissiveStrength;
  mesh.updateModelMatrix();
  app.sceneMeshes.push(mesh);
  app.addMeshControlsUI(mesh);
  return mesh;
}

SceneMesh.prototype.updateModelMatrix = function updateModelMatrix() {
  const s = this.scale || $V([1, 1, 1]);
  const sx = typeof s.e === "function" ? s.e(1) : s[0];
  const sy = typeof s.e === "function" ? s.e(2) : s[1];
  const sz = typeof s.e === "function" ? s.e(3) : s[2];
  this.model = GLMath.translation(this.position)
    .x(GLMath.rotationY(this.rotationY || 0))
    .x(GLMath.scale(sx, sy, sz));
};

const baseSetupUI = WebGLApp.prototype.setupUI;
const baseSetupFileInputs = WebGLApp.prototype.setupFileInputs;
const baseLoadOBJFile = WebGLApp.prototype.loadOBJFile;

WebGLApp.prototype.createRenderTarget = function createRenderTargetWrapper(width, height, depthTexture = false) {
  return createRenderTarget(this.gl, width, height, depthTexture);
};

WebGLApp.prototype.destroyRenderTarget = function destroyRenderTargetWrapper(target) {
  deleteRenderTarget(this.gl, target);
};

WebGLApp.prototype.createPostProcessResources = function createPostProcessResources() {
  const gl = this.gl;
  const quadData = makeFullscreenQuadData();
  this.quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadData.positions, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  this.postPrograms = {
    threshold: new ShaderProgram(gl, makePostVertexSource(), makeThresholdFragmentSource()),
    blur: new ShaderProgram(gl, makePostVertexSource(), makeBlurFragmentSource()),
    copy: new ShaderProgram(this.gl, makePostVertexSource(), makeCopyFragmentSource()),
    composite: new ShaderProgram(gl, makePostVertexSource(), makeCompositeFragmentSource()),
  };

  for (const key of Object.keys(this.postPrograms)) {
    this.postPrograms[key].vao = createQuadVao(gl, this.postPrograms[key], this.quadBuffer);
  }

  this.postFX = {
    bloom: true,
    dof: true,
    lut: true,
    vignette: true,
    grain: true,
    animate: false,
    autoFocus: true,

    bloomThreshold: 0.72,
    bloomIntensityBase: 1.1,
    bloomIntensity: 1.1,

    focusRange: 0.4,
    dofApertureBase: 1.0,
    dofAperture: 1.0,
    focusDepth: 1.0,

    lutIntensity: 0.5,
    vignetteStrength: 0.8,
    vignetteRadius: 0.95,
    grainIntensityBase: 0.1,
    grainIntensity: 0.045,
  };
};

WebGLApp.prototype.recreateRenderTargets = function recreateRenderTargets() {
  const gl = this.gl;
  const width = this.canvas.width;
  const height = this.canvas.height;
  const bloomW = Math.max(1, Math.floor(width / 4));
  const bloomH = Math.max(1, Math.floor(height / 4));
  const dofW = Math.max(1, Math.floor(width / 2));
  const dofH = Math.max(1, Math.floor(height / 2));

  this.destroyRenderTarget(gl, this.sceneTarget);
  this.destroyRenderTarget(gl, this.bloomTargetA);
  this.destroyRenderTarget(gl, this.bloomTargetB);
  this.destroyRenderTarget(gl, this.dofDownTarget);
  this.destroyRenderTarget(gl, this.dofBlurTargetA);
  this.destroyRenderTarget(gl, this.dofBlurTargetB);

  this.sceneTarget = createRenderTarget(gl, width, height, true);
  this.bloomTargetA = createRenderTarget(gl, bloomW, bloomH, false);
  this.bloomTargetB = createRenderTarget(gl, bloomW, bloomH, false);
  this.dofDownTarget = createRenderTarget(gl, dofW, dofH, false);
  this.dofBlurTargetA = createRenderTarget(gl, dofW, dofH, false);
  this.dofBlurTargetB = createRenderTarget(gl, dofW, dofH, false);

  this._renderTargetSize = { width, height, bloomW, bloomH };
};

WebGLApp.prototype.ensureRenderTargets = function ensureRenderTargets() {
  const width = this.canvas.width;
  const height = this.canvas.height;
  if (!this._renderTargetSize ||
      this._renderTargetSize.width !== width ||
      this._renderTargetSize.height !== height) {
    this.recreateRenderTargets();
  }
};

WebGLApp.prototype.createDefaultScene = function createDefaultScene() {
  if (this.sceneMeshes.length > 0) return;

  createPrimitiveMesh(this, {
    name: "Ground",
    color: [58, 64, 78, 255],
    position: $V([0, -1.35, -0.5]),
    scale: $V([8.0, 0.18, 8.0]),
    autoRotate: false,
  });

  createPrimitiveMesh(this, {
    name: "Left cube",
    color: [234, 140, 77, 255],
    position: $V([-4.15, -0.15, -4.0]),
    scale: $V([1.1, 1.1, 1.1]),
    rotationY: 0.5,
    autoRotate: true,
  });

  createPrimitiveMesh(this, {
    name: "Right tower",
    color: [76, 181, 232, 255],
    position: $V([2.75, -0.1, -0.5]),
    scale: $V([0.85, 1.75, 0.85]),
    rotationY: -0.3,
    autoRotate: true,
  });

  createPrimitiveMesh(this, {
    name: "Central orb",
    color: [255, 248, 230, 255],
    position: $V([0.0, 2.3, -7.0]),
    scale: $V([0.5, 0.5, 0.5]),
    primitive: "sphere",
  });

  this.selectMesh(this.sceneMeshes[0]);
};

WebGLApp.prototype.initResources = function initResources() {
  const gl = this.gl;
  this.shader = new ShaderProgram(
    gl,
    WebGLApp.vertexShaderSource(),
    WebGLApp.fragmentShaderSource()
  );
  this.shader.use();

  Object.assign(this.shader.locations, {
    uEmissiveColor: gl.getUniformLocation(this.shader.program, "material.emissive_color"),
    uEmissiveStrength: gl.getUniformLocation(this.shader.program, "material.emissive_strength"),
  });

  this.materialTexture = Texture2D.solidColor(gl, [200, 180, 150, 255]);
  this.defaultMappingTexture = Texture2D.solidColor(gl, [128, 128, 255, 255]);
  this.lutTexture = makeLUTTexture(gl, 32);

  this.renderScaleLevels = [1.0, 0.75, 0.5];
  this.renderScaleIndex = 0;
  this.renderScale = this.renderScaleLevels[this.renderScaleIndex];
  this.fpsEMA = 60;
  this._qualityAccumulator = 0;
  this._qualityFrames = 0;
  this._lastFrameTime = performance.now() * 0.001;
  this._time = 0;

  this.createPostProcessResources();
  this.createDefaultScene();
  this.recreateRenderTargets();
};

WebGLApp.prototype.setCommonUniforms = function setCommonUniforms(modelMatrix, materialTex, mappingTex, bumpStrength, bumpOrNormal, mesh = null) {
  const gl = this.gl;
  const view = GLMath.translation($V([0, -0.1, -6.0]));
  const proj = GLMath.perspective(Math.PI / 4, gl.canvas.width / gl.canvas.height, 0.1, 100.0);
  const modelView = view.x(modelMatrix);
  const normMat = GLMath.normalMatrix(modelView);

  gl.uniformMatrix4fv(this.shader.locations.uModel, false, GLMath.sylvesterToGL4x4(modelMatrix));
  gl.uniformMatrix4fv(this.shader.locations.uView, false, GLMath.sylvesterToGL4x4(view));
  gl.uniformMatrix4fv(this.shader.locations.uProjection, false, GLMath.sylvesterToGL4x4(proj));
  gl.uniformMatrix3fv(this.shader.locations.uNormalMat, false, GLMath.sylvesterToGL3x3(normMat));

  gl.uniform3f(this.shader.locations.uViewPos, 0.0, 0.0, 6.0);
  gl.uniform3f(this.shader.locations.uLightPos, -2.4, 1.8, 4.0);

  gl.uniform1f(this.shader.locations.uBumpStrength, bumpStrength);
  gl.uniform1i(this.shader.locations.uBumpOrNormal, bumpOrNormal ? 1 : 0);

  gl.uniform3f(this.shader.locations.uAmbient, 0.42, 0.42, 0.42);
  gl.uniform3f(this.shader.locations.uDiffuse, 1.0, 1.0, 1.0);
  gl.uniform3f(this.shader.locations.uSpecular, 0.95, 0.95, 0.95);
  gl.uniform1f(this.shader.locations.uSheenCoef, 20.0);

  const emissiveColor = (mesh && mesh.emissiveColor && typeof mesh.emissiveColor.e === "function")
    ? mesh.emissiveColor
    : $V([0, 0, 0]);
  const emissiveStrength = mesh && typeof mesh.emissiveStrength === "number" ? mesh.emissiveStrength : 0.0;
  if (this.shader.locations.uEmissiveColor) {
    gl.uniform3f(this.shader.locations.uEmissiveColor, emissiveColor.e(1), emissiveColor.e(2), emissiveColor.e(3));
  }
  if (this.shader.locations.uEmissiveStrength) {
    gl.uniform1f(this.shader.locations.uEmissiveStrength, emissiveStrength);
  }

  materialTex.bind(0);
  gl.uniform1i(this.shader.locations.uTex, 0);

  mappingTex.bind(1);
  gl.uniform1i(this.shader.locations.uMapping, 1);
};

WebGLApp.prototype.drawMesh = function drawMesh(mesh) {
  const gl = this.gl;
  this.shader.use();

  const materialTex = (mesh.useGlobalMaterial || !mesh.materialTexture)
    ? this.materialTexture
    : mesh.materialTexture;

  const mappingTex = mesh.mappingTexture || this.defaultMappingTexture;
  const bumpStrength = mesh.bumpStrength;
  const bumpOrNormal = mesh.bumpOrNormal;

  this.setCommonUniforms(
    mesh.model || GLMath.identity(),
    materialTex,
    mappingTex,
    bumpStrength,
    bumpOrNormal,
    mesh
  );

  gl.bindVertexArray(mesh.geometry.vao);
  gl.drawElements(gl.TRIANGLES, mesh.geometry.indexCount, mesh.geometry.indexType, 0);
  gl.bindVertexArray(null);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
};

WebGLApp.prototype.renderSceneToTarget = function renderSceneToTarget(target) {
  const gl = this.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  gl.viewport(0, 0, target.width, target.height);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.05, 0.06, 0.08, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (const mesh of this.sceneMeshes) {
    this.drawMesh(mesh);
  }
};

WebGLApp.prototype.drawFullscreenPass = function drawFullscreenPass(programInfo, target, uniforms = {}) {
  const gl = this.gl;

  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
  gl.viewport(
    0,
    0,
    target ? target.width : this.canvas.width,
    target ? target.height : this.canvas.height
  );
  gl.disable(gl.DEPTH_TEST);

  programInfo.use();
  gl.bindVertexArray(programInfo.vao);

  for (const [key, value] of Object.entries(uniforms)) {
    const loc = gl.getUniformLocation(programInfo.program, key);
    if (!loc) continue;

    if (typeof value === "number") {
      gl.uniform1f(loc, value);
    } else if (typeof value === "boolean") {
      gl.uniform1i(loc, value ? 1 : 0);
    } else if (Array.isArray(value) && value.length === 2) {
      gl.uniform2f(loc, value[0], value[1]);
    }
  }

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
};

WebGLApp.prototype.renderBloom = function renderBloom() {
  if (!this.postFX.bloom) {
    return;
  }

  const gl = this.gl;
  const thresholdProg = this.postPrograms.threshold;
  const blurProg = this.postPrograms.blur;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.sceneTarget.texture);
  this.drawFullscreenPass(thresholdProg, this.bloomTargetA, {
    u_scene: 0,
    u_threshold: this.postFX.bloomThreshold,
  });

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.bloomTargetA.texture);
  this.drawFullscreenPass(blurProg, this.bloomTargetB, {
    u_image: 0,
    u_texelSize: [1.0 / this.bloomTargetA.width, 1.0 / this.bloomTargetA.height],
    u_direction: [1.0, 0.0],
  });

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.bloomTargetB.texture);
  this.drawFullscreenPass(blurProg, this.bloomTargetA, {
    u_image: 0,
    u_texelSize: [1.0 / this.bloomTargetB.width, 1.0 / this.bloomTargetB.height],
    u_direction: [0.0, 1.0],
  });
};

WebGLApp.prototype.renderDOFBlur = function renderDOFBlur() {
  if (!this.postFX.dof) return;
  const gl = this.gl;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.sceneTarget.texture);
  this.drawFullscreenPass(this.postPrograms.copy, this.dofDownTarget, { u_image: 0 });

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.dofDownTarget.texture);
  this.drawFullscreenPass(this.postPrograms.blur, this.dofBlurTargetB, {
    u_image: 0,
    u_texelSize: [1.0 / this.dofDownTarget.width, 1.0 / this.dofDownTarget.height],
    u_direction: [1.0, 0.0],
  });

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.dofBlurTargetB.texture);
  this.drawFullscreenPass(this.postPrograms.blur, this.dofBlurTargetA, {
    u_image: 0,
    u_texelSize: [1.0 / this.dofBlurTargetB.width, 1.0 / this.dofBlurTargetB.height],
    u_direction: [0.0, 1.0],
  });
};

WebGLApp.prototype.renderFrame = function renderFrame(timeSeconds = 0.0) {
  this.resizeCanvas();
  this.ensureRenderTargets();

  for (const mesh of this.sceneMeshes) {
    if (mesh.autoRotate) {
      mesh.rotationY += 0.35 * (this._deltaTime || 0.016);
      mesh.updateModelMatrix();
    }
  }

  this.renderSceneToTarget(this.sceneTarget);
  this.renderBloom();
  this.renderDOFBlur();

  const gl = this.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  gl.disable(gl.DEPTH_TEST);
  gl.clearColor(0.05, 0.06, 0.08, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const compositeProg = this.postPrograms.composite;
  compositeProg.use();
  gl.bindVertexArray(compositeProg.vao);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.sceneTarget.texture);
  gl.uniform1i(gl.getUniformLocation(compositeProg.program, "u_scene"), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, this.bloomTargetA.texture);
  gl.uniform1i(gl.getUniformLocation(compositeProg.program, "u_bloom"), 1);

  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, this.sceneTarget.depth);
  gl.uniform1i(gl.getUniformLocation(compositeProg.program, "u_depth"), 2);

  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, this.dofBlurTargetA.texture);
  gl.uniform1i(gl.getUniformLocation(compositeProg.program, "u_dofBlur"), 3);

  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
  gl.uniform1i(gl.getUniformLocation(compositeProg.program, "u_lut"), 4);

  const useBloomLoc = gl.getUniformLocation(compositeProg.program, "u_useBloom");
  const useVignetteLoc = gl.getUniformLocation(compositeProg.program, "u_useVignette");
  const useGrainLoc = gl.getUniformLocation(compositeProg.program, "u_useGrain");
  const useDofBlurLoc = gl.getUniformLocation(compositeProg.program, "u_useDOF");
  const useLutLoc = gl.getUniformLocation(compositeProg.program, "u_useLUT");

  const bloomIntensityLoc = gl.getUniformLocation(compositeProg.program, "u_bloomIntensity");
  const vignetteStrengthLoc = gl.getUniformLocation(compositeProg.program, "u_vignetteStrength");
  const vignetteRadiusLoc = gl.getUniformLocation(compositeProg.program, "u_vignetteRadius");
  const grainIntensityLoc = gl.getUniformLocation(compositeProg.program, "u_grainIntensity");
  const timeLoc = gl.getUniformLocation(compositeProg.program, "u_time");
  const resolutionLoc = gl.getUniformLocation(compositeProg.program, "u_resolution");
  const focusLoc = gl.getUniformLocation(compositeProg.program, "u_focus");

  const focusWidthLoc = gl.getUniformLocation(compositeProg.program, "u_focusWidth");
  const aperture = this.postFX.dofAperture;
  const focusWidth = aperture > 0.001 ? Math.max(0.02, 0.8 / aperture) : 10.0;
  if (focusWidthLoc) gl.uniform1f(focusWidthLoc, focusWidth);

  const dofApertureLoc = gl.getUniformLocation(compositeProg.program, "u_dofAperture");
  const nearLoc = gl.getUniformLocation(compositeProg.program, "u_near");
  const farLoc = gl.getUniformLocation(compositeProg.program, "u_far");
  const lutIntensityLoc = gl.getUniformLocation(compositeProg.program, "u_lutIntensity");

  if (useBloomLoc) gl.uniform1i(useBloomLoc, this.postFX.bloom ? 1 : 0);
  if (useVignetteLoc) gl.uniform1i(useVignetteLoc, this.postFX.vignette ? 1 : 0);
  if (useGrainLoc) gl.uniform1i(useGrainLoc, this.postFX.grain ? 1 : 0);
  if (useDofBlurLoc) gl.uniform1i(useDofBlurLoc, this.postFX.dof ? 1 : 0);
  if (useLutLoc) gl.uniform1i(useLutLoc, this.postFX.lut ? 1 : 0);
  if (bloomIntensityLoc) gl.uniform1f(bloomIntensityLoc, this.postFX.bloomIntensity);
  if (vignetteStrengthLoc) gl.uniform1f(vignetteStrengthLoc, this.postFX.vignetteStrength);
  if (vignetteRadiusLoc) gl.uniform1f(vignetteRadiusLoc, this.postFX.vignetteRadius);
  if (grainIntensityLoc) gl.uniform1f(grainIntensityLoc, this.postFX.grainIntensity);
  if (timeLoc) gl.uniform1f(timeLoc, timeSeconds);
  if (resolutionLoc) gl.uniform2f(resolutionLoc, this.canvas.width, this.canvas.height);
  if (focusLoc) gl.uniform1f(focusLoc, this.getFocusDepth());
  if (nearLoc) gl.uniform1f(nearLoc, 0.1);
  if (farLoc) gl.uniform1f(farLoc, 100.0);
  if (dofApertureLoc) gl.uniform1f(dofApertureLoc, this.postFX.dofAperture);
  if (lutIntensityLoc) gl.uniform1f(lutIntensityLoc, this.postFX.lutIntensity);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
};

WebGLApp.prototype._renderLoop = function _renderLoop(timeMs) {
  const t = performance.now() * 0.001;
  this._deltaTime = Math.min(0.05, Math.max(0.0, t - this._lastFrameTime));
  this._lastFrameTime = t;

  const instantFPS = 1.0 / this._deltaTime;
  this._fps = this._fps * 0.9 + instantFPS * 0.1;
  if (this._fpsElement) {
    this._fpsElement.textContent = `FPS: ${this._fps.toFixed(1)}`;
  }

  this.updateAnimations(t);
  this.updateAdaptiveQuality(this._deltaTime);
  this.renderFrame(t);
  requestAnimationFrame(this._renderLoop);
};

WebGLApp.prototype.parseCubeLUT = function(text) {
  const lines = text.split(/\r?\n/);
  let size = 32;
  const values = [];

  for (let line of lines) {
    line = line.trim();
    if (line === '' || line.startsWith('#')) continue;
    const lower = line.toLowerCase();
    if (lower.startsWith('lut_3d_size')) {
      const parts = line.split(/\s+/);
      size = parseInt(parts[1], 10);
    } else if (lower.startsWith('title') || lower.startsWith('domain')) {
      continue;
    } else {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        values.push([parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2])]);
      }
    }
  }

  const expected = size * size * size;
  if (values.length !== expected) {
    console.warn(`LUT size mismatch: got ${values.length}, expected ${expected}`);
  }

  const rgba = new Uint8Array(size * size * size * 4);
  let idx = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const srcIdx = b * size * size + g * size + r;
        const [red, green, blue] = values[srcIdx] || [0, 0, 0];
        rgba[idx++] = Math.round(Math.max(0, Math.min(1, red)) * 255);
        rgba[idx++] = Math.round(Math.max(0, Math.min(1, green)) * 255);
        rgba[idx++] = Math.round(Math.max(0, Math.min(1, blue)) * 255);
        rgba[idx++] = 255;
      }
    }
  }
  return { size, data: rgba };
};

WebGLApp.prototype.createLUTTextureFromData = function(size, data) {
  const gl = this.gl;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_3D, null);
  return tex;
};

WebGLApp.prototype.loadLUTFromFile = async function(file) {
  const text = await file.text();
  const { size, data } = this.parseCubeLUT(text);
  if (this.lutTexture) {
    this.gl.deleteTexture(this.lutTexture);
  }
  this.lutTexture = this.createLUTTextureFromData(size, data);
  console.log(`LUT loaded: ${file.name}, size=${size}`);
  return this.lutTexture;
};

WebGLApp.prototype.setupUI = function setupUI() {
  baseSetupUI.call(this);

  let panel = document.getElementById("postFxControls");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "postFxControls";
    panel.style.position = "fixed";
    panel.style.right = "12px";
    panel.style.top = "12px";
    panel.style.zIndex = "20";
    panel.style.padding = "10px 12px";
    panel.style.border = "1px solid #333";
    panel.style.borderRadius = "10px";
    panel.style.background = "rgba(15, 16, 22, 0.82)";
    panel.style.color = "#fff";
    panel.style.font = "12px sans-serif";
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.gap = "8px";
    panel.style.minWidth = "220px";
    panel.innerHTML = "<div style='font-weight:700;margin-bottom:4px'>Post-processing</div>";
    document.body.appendChild(panel);
  } else {
    panel.innerHTML = "<div style='font-weight:700;margin-bottom:4px'>Post-processing</div>";
  }

  const makeToggle = (label, key) => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "8px";

    const text = document.createElement("span");
    text.textContent = label;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.postFX[key];
    input.addEventListener("change", () => {
      if (key === "animate") {
        this.postFX.animate = input.checked;
        if (input.checked) {
          this.postFX.bloomIntensityBase = this.postFX.bloomIntensity;
          this.postFX.grainIntensityBase = this.postFX.grainIntensity;
          this.postFX.dofApertureBase = this.postFX.dofAperture;
          this.postFX.vignetteStrengthBase = this.postFX.vignetteStrength;

          if (this.postFX.inputs) {
            for (const k of Object.keys(this.postFX.inputs)) {
              this.postFX.inputs[k].disabled = true;
            }
          }
        } else {
          if (this.postFX.inputs) {
            const keys = ["bloomIntensity", "grainIntensity", "dofAperture", "vignetteStrength"];
            for (const k of keys) {
              const inp = this.postFX.inputs[k];
              if (inp) {
                const v = parseFloat(inp.value);
                this.postFX[k] = Number.isFinite(v) ? v : this.postFX[k];
              }
            }
            for (const k of Object.keys(this.postFX.inputs)) {
              this.postFX.inputs[k].disabled = false;
            }
          }
        }
      } else {
        this.postFX[key] = input.checked;
      }
    });

    row.appendChild(text);
    row.appendChild(input);
    return row;
  };

  const makeRange = (label, key, min, max, step) => {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "4px";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";

    const lbl = document.createElement("span");
    lbl.textContent = label;

    const value = document.createElement("span");
    value.textContent = Number(this.postFX[key]).toFixed(2);

    top.appendChild(lbl);
    top.appendChild(value);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(this.postFX[key]);
    input.addEventListener("input", () => {
      this.postFX[key] = parseFloat(input.value);
      value.textContent = Number(this.postFX[key]).toFixed(2);
    });

    if (!this.postFX.inputs) this.postFX.inputs = {};
    if (!this.postFX.inputsValue) this.postFX.inputsValue = {};
    this.postFX.inputs[key] = input;
    this.postFX.inputsValue[key] = value;

    if (this.postFX.animate) {
      input.disabled = true;
    }

    wrap.appendChild(top);
    wrap.appendChild(input);
    return wrap;
  };

  panel.appendChild(makeToggle("Bloom", "bloom"));
  panel.appendChild(makeToggle("Vignette", "vignette"));
  panel.appendChild(makeToggle("Grain", "grain"));
  panel.appendChild(makeToggle("DOF Blur", "dof"));
  panel.appendChild(makeToggle("Color Grading LUT", "lut"));
  panel.appendChild(makeToggle("Animate", "animate"));
  panel.appendChild(makeRange("Bloom intensity", "bloomIntensity", 0.0, 2.5, 0.01));
  panel.appendChild(makeRange("Bloom threshold", "bloomThreshold", 0.2, 1.0, 0.01));
  panel.appendChild(makeRange("Vignette strength", "vignetteStrength", 0.0, 3.0, 0.01));
  panel.appendChild(makeRange("Grain intensity", "grainIntensity", 0.0, 0.2, 0.001));
  panel.appendChild(makeRange("DOF Aperture", "dofAperture", 0.0, 5.0, 0.01));
  panel.appendChild(makeRange("LUT intensity", "lutIntensity", 0.0, 1.0, 0.01));

  const lutSection = document.createElement("div");
  lutSection.style.marginTop = "8px";
  lutSection.style.padding = "8px";
  lutSection.style.background = "rgba(255,255,255,0.05)";
  lutSection.style.borderRadius = "6px";
  lutSection.style.display = "flex";
  lutSection.style.flexDirection = "column";
  lutSection.style.gap = "6px";

  const lutHeader = document.createElement("div");
  lutHeader.style.fontWeight = "600";
  lutHeader.textContent = "Load .cube LUT";
  lutSection.appendChild(lutHeader);

  const lutStatus = document.createElement("div");
  lutStatus.style.fontSize = "11px";
  lutStatus.style.color = "#aaa";
  lutStatus.textContent = this.customLutTexture ? "Custom LUT loaded" : "No custom LUT";
  lutSection.appendChild(lutStatus);

  const lutFileInput = document.createElement("input");
  lutFileInput.type = "file";
  lutFileInput.accept = ".cube";
  lutFileInput.style.marginBottom = "4px";
  lutFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await this.loadLUTFromFile(file);
      lutStatus.textContent = ``;
    } catch (err) {
      console.error("LUT load error:", err);
      lutStatus.textContent = "Error loading LUT";
      alert("Failed to load .cube file: " + err.message);
    }
  });
  lutSection.appendChild(lutFileInput);
  panel.appendChild(lutSection);
};

WebGLApp.prototype.setupFileInputs = function setupFileInputs() {
  baseSetupFileInputs.call(this);
};

WebGLApp.prototype.loadOBJFile = async function loadOBJFile(file) {
  const mesh = await baseLoadOBJFile.call(this, file);
  mesh.scale = $V([1, 1, 1]);
  mesh.autoRotate = false;
  mesh.emissiveColor = $V([0, 0, 0]);
  mesh.emissiveStrength = 0.0;
  mesh.updateModelMatrix();
  return mesh;
};

function main() {
  const app = new WebGLApp();
  app.start();
}

main();