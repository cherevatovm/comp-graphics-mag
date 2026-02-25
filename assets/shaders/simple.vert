#version 330 core

layout (location = 0) in vec3 position_in;

uniform struct Transform {
	mat4 model;
	mat4 view;
	mat4 projection;
} transform;

out vec3 position;

void main() {
	position = position_in * 0.5;
    gl_Position = transform.projection * transform.view * transform.model * vec4(position_in, 1.0);;
}