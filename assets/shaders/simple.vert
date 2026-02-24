#version 330 core

layout (location = 0) in vec3 position_in;

uniform struct Transform {
	mat4 model;
	mat4 view;
	mat4 projection;
} transform;

out vec3 position;

void main() {
	vec4 world_pos = transform.model * vec4(position_in, 1.0);
	position = world_pos.xyz;
    gl_Position = transform.projection * transform.view * world_pos;
}