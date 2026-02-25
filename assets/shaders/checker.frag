#version 330 core

in vec3 position;

out vec4 frag_color;

void main() {
    float k = 15.0;
    int sum = int(position.x * k) + int(position.y * k) + int(position.z * k);
    
    if (mod(sum, 2) == 0) {
        frag_color = vec4(0.8, 0.8, 0, 1.0);
    }
    else {
        frag_color = vec4(0.5, 0.0, 0, 1.0);
    }
}