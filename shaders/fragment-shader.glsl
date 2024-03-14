
varying vec2 vUvs;
uniform vec2 resolution;
uniform float time;

float inverseLerp(float v, float minValue, float maxValue) {
	return (v - minValue) / (maxValue - minValue);
}

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
	float t = inverseLerp(v, inMin, inMax);
  	return mix(outMin, outMax, t);
}

float saturate(float x) {
  	return clamp(x, 0.0, 1.0);
}

float sphereSDF(vec2 pos, vec2 center, float r) {
	return distance(pos, center) - r;
}

float sceneSDF(vec2 pos) {
	return sphereSDF(pos, vec2(0.0, 0.0), 10.0);
}

void main() {
	vec2 pixelCoords = (vUvs - 0.5) * resolution;

  	vec3 colour = vec3(0.0, 1.0, 0.0);

  	gl_FragColor = vec4(pow(colour, vec3(1.0 / 2.2)), 1.0);
}
