#version 330 core

uniform vec3 const_color;

out vec4 frag_color;

void main() {
    frag_color = vec4(const_color, 1.0);
}