#version 330 core

layout (location = 0) in vec3 position;

uniform struct Transform {
	mat4 model;
	mat4 view;
	mat4 projection;
} transform;

void main() {
    gl_Position = transform.projection * transform.view * 
		transform.model * vec4(position, 1.0);
}