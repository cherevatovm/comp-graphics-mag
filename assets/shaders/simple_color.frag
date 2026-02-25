#version 330 core

in vec3 v_color;

uniform float brightness;

out vec4 frag_color;

void main() {
    frag_color = vec4(v_color, 1.0) * brightness;
}