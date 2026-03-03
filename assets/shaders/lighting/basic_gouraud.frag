#version 330 core

in vec3 vert_color;
in vec2 uv_coords;

uniform sampler2D diffuse_map;

out vec4 frag_color;

void main() {
    vec3 base_color = texture(diffuse_map, uv_coords).rgb;
    frag_color = vec4(base_color * vert_color, 1.0);
}