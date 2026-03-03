#version 330 core

layout (location = 0) in vec3 position;
layout (location = 1) in vec3 normal_in;
layout (location = 3) in vec2 uv_coords_in;

uniform struct Transform {
    mat4 model;
    mat4 view;
    mat4 projection;
    mat3 normal_mat;
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

uniform sampler2D diffuse_map;
uniform float linear_coef;
uniform float quadratic_coef;

out vec3 vert_color;
out vec2 uv_coords;

void main() {
    vec4 world_pos = transform.model * vec4(position, 1.0);

    vec3 normal = normalize(transform.normal_mat * normal_in);
    vec3 light_dir = light.position - world_pos.xyz;
    float distance = length(light_dir);
    light_dir = normalize(light_dir);
    float norm_d_light = max(dot(normal, light_dir), 0.0);

    float attenuation = 1.0 / max(light.constant + 
        (light.linear * linear_coef) * distance + 
        (light.quadratic * quadratic_coef) * distance * distance, 0.0001);

    vec3 base_color = texture(diffuse_map, uv_coords_in).rgb;
    vec3 ambient = light.ambient * base_color * light.ambient_strength * attenuation;
    vec3 diffuse = light.diffuse * norm_d_light * base_color * attenuation;

    vert_color = ambient + diffuse;
    uv_coords = vec2(uv_coords_in.x, 1.0 - uv_coords_in.y);

    gl_Position = transform.projection * transform.view * world_pos;
}