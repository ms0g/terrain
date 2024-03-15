
varying vec2 vUvs;
uniform vec2 resolution;
uniform float time;

const int NUM_STEPS = 256;
const float MAX_DIST = 1000.0;

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

float sdfSphere(vec3 pos, float r) {
	return length(pos) - r;
}

float sdfBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdfTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

float calculateSceneSDF(vec3 pos) {
	//float dist = sdfSphere(pos - vec3(0.0, 0.0, 5.0), 1.0);
	//float dist = sdfBox(pos - vec3(0.0, 0.0, 5.0), vec3(1.0));
	float dist = sdfTorus(pos - vec3(0.0, 0.0, 5.0), vec2(1.0));
	return dist;
}

vec3 rayMarch(vec3 cameraOrigin, vec3 cameraDir) {
	vec3 pos;
	float dist = 0.0;

	for (int i = 0; i < NUM_STEPS; ++i) {
		pos = cameraOrigin + cameraDir * dist;
		float distToScene = calculateSceneSDF(pos);

		if (distToScene < 0.001) {
			break;
		}

		dist += distToScene;

		if (dist > MAX_DIST) {
			return vec3(0.0);
		}
	}
	return vec3(1.0);
}

void main() {
	vec2 pixelCoords = (vUvs - 0.5) * resolution;

	vec3 rayDir = normalize(vec3(pixelCoords * 2.0 / resolution.y, 1.0));
	vec3 rayOrigin = vec3(0.0);

  	vec3 colour = rayMarch(rayOrigin, rayDir);

  	gl_FragColor = vec4(pow(colour, vec3(1.0 / 2.2)), 1.0);
}
