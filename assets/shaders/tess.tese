#version 460 core
layout(quads, fractional_even_spacing, ccw) in;

in vec2 TC_TexCoord[];
out vec2 TE_TexCoord;
out vec3 TE_WorldPos;

uniform sampler2D heightmap;
uniform float height_scale = 1.0;
uniform struct Transform {
    mat4 view;
    mat4 projection;
} transform;

void main() {
    // bilinear interpolation of control points
    vec4 p00 = gl_in[0].gl_Position;
    vec4 p10 = gl_in[1].gl_Position;
    vec4 p11 = gl_in[2].gl_Position;
    vec4 p01 = gl_in[3].gl_Position;

    float u = gl_TessCoord.x;
    float v = gl_TessCoord.y;

    vec4 lerpU0 = mix(p00, p10, u);
    vec4 lerpU1 = mix(p01, p11, u);
    vec4 pos = mix(lerpU0, lerpU1, v);

    vec2 t00 = TC_TexCoord[0];
    vec2 t10 = TC_TexCoord[1];
    vec2 t11 = TC_TexCoord[2];
    vec2 t01 = TC_TexCoord[3];
    vec2 tU0 = mix(t00, t10, u);
    vec2 tU1 = mix(t01, t11, u);
    TE_TexCoord = mix(tU0, tU1, v);

    // sample heightmap and displace along world-up (z)
    float height = texture(heightmap, TE_TexCoord).r * height_scale;
    pos.z += height;
    // export world-space position for downstream stages
    TE_WorldPos = pos.xyz;
    gl_Position = transform.projection * transform.view * pos;
}
