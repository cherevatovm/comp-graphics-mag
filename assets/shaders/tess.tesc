#version 460 core
layout(vertices = 4) out;

in vec2 TexCoord[];
out vec2 TC_TexCoord[];

uniform vec3 camera_pos;
uniform float max_tess_level = 8.0;

void main() {
    TC_TexCoord[gl_InvocationID] = TexCoord[gl_InvocationID];

    vec3 c0 = gl_in[0].gl_Position.xyz;
    vec3 c1 = gl_in[1].gl_Position.xyz;
    vec3 c2 = gl_in[2].gl_Position.xyz;
    vec3 c3 = gl_in[3].gl_Position.xyz;
    vec3 center = (c0 + c1 + c2 + c3) * 0.25;

    float dist = length(center - camera_pos);
    if (dist < 0.0001) dist = 0.0001;
    float level = clamp(max_tess_level / dist, 1.0, max_tess_level);

    // set inner/outer tess levels (uniform across patch to reduce seams)
    if (gl_InvocationID == 0) {
        gl_TessLevelInner[0] = level;
        gl_TessLevelInner[1] = level;
        gl_TessLevelOuter[0] = level;
        gl_TessLevelOuter[1] = level;
        gl_TessLevelOuter[2] = level;
        gl_TessLevelOuter[3] = level;
    }

    gl_out[gl_InvocationID].gl_Position = gl_in[gl_InvocationID].gl_Position;
}
