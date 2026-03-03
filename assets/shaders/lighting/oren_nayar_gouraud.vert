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

uniform sampler2D diffuse_map;
uniform float roughness;
uniform float linear_coef;
uniform float quadratic_coef;

out vec3 vert_color;
out vec2 uv_coords;

void main() {
    vec4 world_pos = transform.model * vec4(position, 1.0);

    vec3 normal = normalize(transform.normal_mat * normal_in);
    vec3 light_dir = light.position - world_pos.xyz;
    vec3 view_dir = transform.view_pos - world_pos.xyz;
    float distance = length(light_dir);
    
    light_dir = normalize(light_dir);
    view_dir = normalize(view_dir);

    float attenuation = 1.0 / max(light.constant + 
        (light.linear * linear_coef) * distance + 
        (light.quadratic * quadratic_coef) * distance * distance, 0.0001);

    float norm_d_light = max(dot(normal, light_dir), 0.0);
    float norm_d_view = max(dot(normal, view_dir), 0.0);

    float rough2 = roughness * roughness;
    float A = 1.0 - (0.5 * rough2 / (rough2 + 0.33));
    float B = 0.45 * rough2 / (rough2 + 0.09);

    float sin_theta_i = sqrt(1.0 - norm_d_light * norm_d_light);
    float sin_theta_r = sqrt(1.0 - norm_d_view * norm_d_view);

    float max_cos = 0.0;
    if (sin_theta_i > 0.0001 && sin_theta_r > 0.0001) {
        vec3 light_perp = normalize(light_dir - normal * norm_d_light);
        vec3 view_perp = normalize(view_dir - normal * norm_d_view);
        max_cos = max(0.0, dot(light_perp, view_perp));
    }

    float sin_alpha, tan_beta;
    if (norm_d_light > norm_d_view) {
        sin_alpha = sin_theta_r;
        tan_beta  = sin_theta_i / max(norm_d_light, 0.001);
    }
    else {
        sin_alpha = sin_theta_i;
        tan_beta  = sin_theta_r / max(norm_d_view, 0.001);
    }

    float oren_nayar = norm_d_light * (A + B * max_cos * sin_alpha * tan_beta) * attenuation;
    vec3 base_color = texture(diffuse_map, uv_coords_in).rgb;
    vec3 ambient = light.ambient * base_color * light.ambient_strength * attenuation;

    vert_color =  ambient + light.diffuse * base_color * oren_nayar;
    uv_coords = vec2(uv_coords_in.x, 1.0 - uv_coords_in.y);

    gl_Position = transform.projection * transform.view * world_pos;
}