"use strict";

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
      normBuffer,
      tanBuffer,
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


class WebGLApp {
  constructor() {
    this.canvas = document.getElementById("glcanvas");
    if (!this.canvas) throw new Error("Canvas #glcanvas not found");

    this.gl = null;
    this.shader = null;
    this.materialTexture = null;
    this.defaultMappingTexture = null;

    this.sceneMeshes = [];
    this.selectedMesh = null;
    this.moveStep = 0.05;

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
  in	vec3 frag_pos;
  in	vec2 uv_coords;

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
  } material;

  out vec4 frag_color;

  void main() {
    vec3 new_normal;
    if (bump_or_normal) {
      float h = texture(mapping, uv_coords).r;
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
    
    frag_color = vec4(ambient + diffuse + specular, 1.0);
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

    const mappingLabel = document.createElement("div");
    mappingLabel.textContent = "Bump/Normal map:";
    mappingLabel.style.marginTop = "8px";
    mappingLabel.style.marginBottom = "4px";
    wrap.appendChild(mappingLabel);

    const mappingInput = document.createElement("input");
    mappingInput.type = "file";
    mappingInput.accept = "image/*";
    mappingInput.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const tex = await Texture2D.fromFile(this.gl, f);
        if (mesh.mappingTexture) mesh.mappingTexture.dispose();
        mesh.mappingTexture = tex;
        if (mesh.ui.mappingFileInfo) {
          mesh.ui.mappingFileInfo.textContent = `Loaded: ${f.name}`;
        }
        console.log(`Assigned mapping texture to ${mesh.displayName}`);
      } catch (err) {
        console.error("Mapping texture load failed:", err);
        alert("Failed to load mapping texture: " + err.message);
      }
    });
    wrap.appendChild(mappingInput);

    const mappingFileInfo = document.createElement("div");
    mappingFileInfo.style.fontSize = "11px";
    mappingFileInfo.style.color = "#aaa";
    mappingFileInfo.textContent = "No file loaded";
    wrap.appendChild(mappingFileInfo);

    const strengthRow = document.createElement("div");
    strengthRow.style.display = "flex";
    strengthRow.style.alignItems = "center";
    strengthRow.style.gap = "8px";
    strengthRow.style.marginTop = "6px";

    const strengthLabel = document.createElement("label");
    strengthLabel.textContent = "Strength:";
    strengthLabel.style.fontSize = "12px";

    const strengthSlider = document.createElement("input");
    strengthSlider.type = "range";
    strengthSlider.min = "0";
    strengthSlider.max = "1";
    strengthSlider.step = "0.01";
    strengthSlider.value = mesh.bumpStrength;
    strengthSlider.style.flex = "1";

    const strengthValue = document.createElement("span");
    strengthValue.textContent = mesh.bumpStrength.toFixed(2);
    strengthValue.style.fontSize = "11px";
    strengthValue.style.width = "32px";

    strengthSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      mesh.bumpStrength = val;
      strengthValue.textContent = val.toFixed(2);
    });

    strengthRow.appendChild(strengthLabel);
    strengthRow.appendChild(strengthSlider);
    strengthRow.appendChild(strengthValue);
    wrap.appendChild(strengthRow);

    const typeRow = document.createElement("div");
    typeRow.style.display = "flex";
    typeRow.style.alignItems = "center";
    typeRow.style.gap = "12px";
    typeRow.style.marginTop = "4px";

    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Map type:";
    typeLabel.style.fontSize = "12px";

    const typeSelect = document.createElement("select");
    const optBump = document.createElement("option");
    optBump.value = "bump";
    optBump.textContent = "Bump map (height)";
    const optNormal = document.createElement("option");
    optNormal.value = "normal";
    optNormal.textContent = "Normal map";
    typeSelect.appendChild(optBump);
    typeSelect.appendChild(optNormal);
    typeSelect.value = mesh.bumpOrNormal ? "bump" : "normal";

    typeSelect.addEventListener("change", (e) => {
      mesh.bumpOrNormal = (e.target.value === "bump");
    });

    typeRow.appendChild(typeLabel);
    typeRow.appendChild(typeSelect);
    wrap.appendChild(typeRow);

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
    mesh.ui.bumpStrengthSlider = strengthSlider;
    mesh.ui.bumpOrNormalSelect = typeSelect;
    mesh.ui.mappingFileInfo = mappingFileInfo;
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

function main() {
  const app = new WebGLApp();
  app.start();
}

main();