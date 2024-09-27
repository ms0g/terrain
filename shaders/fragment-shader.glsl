
varying vec2 vUvs;
uniform vec2 resolution;
uniform float time;

const int NUM_STEPS = 256;
const float MAX_DIST = 1000.0;

vec3 RED = vec3(1.0, 0.0, 0.0);
vec3 GREEN = vec3(0.0, 1.0, 0.0);
vec3 BLUE = vec3(0.0, 0.0, 1.0);
vec3 GRAY = vec3(0.5);
vec3 WHITE = vec3(1.0);

struct Material {
	vec3 color;
	float dist;
};

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

float sdfPlane(vec3 p) {
	return p.y;
}

Material calculateSceneSDF(vec3 pos) {
	Material result = Material(
      GRAY, sdfPlane(pos - vec3(0.0, -2.0, 0.0)));
  
	float dist;

	dist = sdfBox(pos - vec3(-2.0, -0.85, 5.0), vec3(1.0));
	result.color = dist < result.dist ? RED : result.color;
	result.dist = min(result.dist, dist);

	dist = sdfBox(pos - vec3(2.0, -0.85, 5.0), vec3(1.0));
	result.color = dist < result.dist ? BLUE : result.color;
	result.dist = min(result.dist, dist);

	dist = sdfBox(pos - vec3(2.0, 1.0, 35.0 + sin(time) * 25.0), vec3(2.0));
	result.color = dist < result.dist ? BLUE : result.color;
	result.dist = min(result.dist, dist);

  return result;
}

vec3 calculateNormal(vec3 pos) {
	const float EPS = 0.0001;
	vec3 n = vec3(
		calculateSceneSDF(pos + vec3(EPS, 0.0, 0.0)).dist - calculateSceneSDF(pos - vec3(EPS, 0.0, 0.0)).dist,
		calculateSceneSDF(pos + vec3(0.0, EPS, 0.0)).dist - calculateSceneSDF(pos - vec3(0.0, EPS, 0.0)).dist,
		calculateSceneSDF(pos + vec3(0.0, 0.0, EPS)).dist - calculateSceneSDF(pos - vec3(0.0, 0.0, EPS)).dist
	);

	return normalize(n);
}

vec3 calculateLighting(vec3 pos, vec3 normal, vec3 lightColor, vec3 lightDir) {
	float dp = saturate(dot(normal, lightDir));

	return lightColor * dp;

}

float calculateShadow(vec3 pos, vec3 lightDir) {
	float d = 0.01;
	for (int i = 0; i < 60; ++i) {
		float distToScene = calculateSceneSDF(pos + lightDir * d).dist;

		if (distToScene < 0.001) {
			return 0.0;
		}

		d += distToScene;
	}

	return 1.0;
}

float calculateAO(vec3 pos, vec3 normal) {
	float ao = 0.0;
	float stepSize = 0.1;

	for (float f = 0.0; f < 5.0; ++f) {
		float distFactor = 1.0 / pow(2.0, f);
		
		ao += distFactor * (f * stepSize - calculateSceneSDF(pos + normal * f * stepSize).dist);
	}

	return 1.0 - ao;
}

vec3 rayMarch(vec3 cameraOrigin, vec3 cameraDir) {
	vec3 pos;
	Material mat = Material(vec3(0.0), 0.0);

	vec3 skyColor = vec3(0.55, 0.6, 1.0);

	for (int i = 0; i < NUM_STEPS; ++i) {
		pos = cameraOrigin + cameraDir * mat.dist;
		Material result = calculateSceneSDF(pos);

		// Case 1: distToScene < 0, intersected scene
		if (result.dist < 0.001) {
			break;
		}

		mat.dist += result.dist;
		mat.color = result.color;
		
		// Case 2: dist > MAX_DIST, out of the scene entirely
		if (mat.dist > MAX_DIST) {
			return skyColor;
		}
	}

	vec3 normal = calculateNormal(pos);
	vec3 lightColor = WHITE;
	vec3 lightDir = normalize(vec3(1.0, 2.0, -1.0));
	float shadowed = calculateShadow(pos, lightDir);
	vec3 lighting = calculateLighting(pos, normal, lightColor, lightDir);

	lighting *= shadowed;

	vec3 color = mat.color * lighting;

	float fogFactor = 1.0 - exp(-pos.z * 0.04);

	color = mix(color, skyColor, fogFactor);
	return color;
}

void main() {
	vec2 pixelCoords = (vUvs - 0.5) * resolution;

	vec3 rayDir = normalize(vec3(pixelCoords * 2.0 / resolution.y, 1.0));
	vec3 rayOrigin = vec3(0.0);

  	vec3 color = rayMarch(rayOrigin, rayDir);

  	gl_FragColor = vec4(pow(color, vec3(1.0 / 2.2)), 1.0);
}
