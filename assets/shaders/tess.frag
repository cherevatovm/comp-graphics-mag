#version 460 core
in vec2 TE_TexCoord;
out vec4 FragColor;

uniform sampler2D heightmap;

void main() {
    float h = texture(heightmap, TE_TexCoord).r;
    vec3 color = vec3(0.2, 0.7, 0.2) * (0.6 + h*0.8);
    FragColor = vec4(color, 1.0);
}
