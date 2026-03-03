#version 330 core

layout (location = 0) in vec3 position;
layout (location = 1) in vec3 normal_in;
layout (location = 3) in vec2 uv_coords_in;

uniform struct Transform {
	mat4 model;
	mat4 view;
	mat4 projection;
	mat3 normal_mat;
	vec3 view_pos;
} transform;

uniform struct PointLight {
	vec3 ambient;
    vec3 diffuse;
    vec3 position;

    float constant;
    float linear;
    float quadratic;

	float ambient_strength;
} light;

out Vertex {
	vec3 normal;
	vec3 light_dir;
	vec3 view_dir;
	vec2 uv_coords;
	float distance;
} vert;

void main() {	
	vec4 world_pos = transform.model * vec4(position, 1.0);

	vert.normal = transform.normal_mat * normal_in;
	vert.light_dir = light.position - world_pos.xyz;
	vert.view_dir = transform.view_pos - world_pos.xyz;
	vert.uv_coords = vec2(uv_coords_in.x, 1.0 - uv_coords_in.y);
	vert.distance = length(vert.light_dir);
	
	gl_Position = transform.projection * transform.view * world_pos;
}