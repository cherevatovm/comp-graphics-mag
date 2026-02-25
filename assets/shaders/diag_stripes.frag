#version 330 core

in vec3 position;

out vec4 frag_color;

void main() {
    float k = 15.0;
    float strip = floor((position.x + position.y) * k);
    
    if (mod(strip, 2) == 0) {
        frag_color = vec4(0.0, 0.8, 0.8, 1.0);
    }
    else {
        frag_color = vec4(0.0, 0.3, 0.5, 1.0);
    }
}