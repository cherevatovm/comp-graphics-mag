#version 330 core

in vec3 position;

uniform vec3 const_color;

out vec4 frag_color;

void main() {
    float k = 15.0;
    float strip = floor(position.x * k);
    
    if (mod(strip, 2) == 0) {
        frag_color = vec4(const_color, 1.0);
    }
    else {
        frag_color = vec4(0.9);
    }
}