#version 460 core

in vec2 TE_TexCoord[];
in vec3 TE_WorldPos[];

layout (triangles) in;
layout (line_strip, max_vertices = 6) out;

uniform struct Transform {
    mat4 view;
    mat4 projection;
} transform;

vec3 GetNormal() {
    vec3 a = TE_WorldPos[0] - TE_WorldPos[1];
    vec3 b = TE_WorldPos[2] - TE_WorldPos[1];
    return -normalize(cross(a, b));
}

void main() {
    vec3 normal = GetNormal();
    vec3 centerWorld = (TE_WorldPos[0] + TE_WorldPos[1] + TE_WorldPos[2]) / 3.0;

    for (int i = 0; i < 3; i++) {
        gl_Position = gl_in[i].gl_Position;
        EmitVertex();
    }
    EndPrimitive();

    // compute clip-space positions for line endpoints
    vec4 clipCenter = transform.projection * transform.view * vec4(centerWorld, 1.0);
    vec4 clipEnd = transform.projection * transform.view * vec4(centerWorld + normal * 0.3, 1.0);

    gl_Position = clipCenter;
    EmitVertex();
    gl_Position = clipEnd;
    EmitVertex();
    EndPrimitive();
}
