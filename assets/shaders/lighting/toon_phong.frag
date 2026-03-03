#version 330 core

in Vertex {
	vec3 normal;
	vec3 light_dir;
	vec3 view_dir;
	vec2 uv_coords;
	float distance;
} vert;

uniform sampler2D diffuse_map;
uniform float linear_coef;
uniform float quadratic_coef;

uniform struct PointLight {
    vec3 ambient;
    vec3 diffuse;
    vec3 position;

    float constant;
    float linear;
    float quadratic;

    float ambient_strength;
} light;

out vec4 frag_color;

void main() {
    vec3 norm = normalize(vert.normal);
    vec3 light_dir = normalize(vert.light_dir);
    float diff = max(dot(norm, light_dir), 0.0);

    float attenuation = 1.0 / max(light.constant + 
        (light.linear * linear_coef) * vert.distance + 
        (light.quadratic * quadratic_coef) * vert.distance * vert.distance, 0.0001);

    float levels = 3.0;
    float toon = floor(diff * levels) / levels;
    toon = max(toon, light.ambient_strength);

    vec3 base_color = texture(diffuse_map, vert.uv_coords).rgb;
    vec3 final_color = base_color * light.diffuse * toon * attenuation;

    frag_color = vec4(final_color, 1.0);
}
