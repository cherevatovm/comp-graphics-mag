#version 330 core

layout (location = 0) in vec3 position_in;
layout (location = 2) in vec3 color_in;

uniform struct Transform {
	mat4 model;
	mat4 view;
	mat4 projection;
} transform;

out vec3 v_color;

void main() {
	v_color = color_in;
    gl_Position = transform.projection * transform.view * transform.model * vec4(position_in, 1.0);
}