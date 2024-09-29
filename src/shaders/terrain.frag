
varying vec2 vUvs;
uniform vec2 resolution;
uniform float time;

const int NUM_STEPS = 256;
const float MAX_DIST = 1000.0;
const float MIN_DIST = 0.00001;
const float WATER_LEVEL = 0.45;

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

float random(vec2 p) {
	p = 50.0 * fract(p*0.318 + vec2(0.71, 0.113));
	return -1.0 + 2.0*fract(p.x*p.y*(p.x + p.y));
}

float noise(vec2 p) {
	vec2 texSize = vec2(1.0);
	vec2 pc = p * texSize;
	vec2 base = floor(pc);

	float s1 = random(base + vec2(0.0, 0.0) / texSize);
	float s2 = random(base + vec2(1.0, 0.0) / texSize);
	float s3 = random(base + vec2(0.0, 1.0) / texSize);
	float s4 = random(base + vec2(1.0, 1.0) / texSize);

	vec2 f = smoothstep(0.0, 1.0, fract(pc));

	return mix(mix(s1, s2, f.x), mix(s3, s4, f.x), f.y);

}

float noiseFBM(vec2 p, int octaves, float persistence, float lacunarity) {
	float amplitude = 0.5;
	float total = 0.0;

	for (int i = 0; i < octaves; ++i) {
		float noiseValue = noise(p);

		total += noiseValue * amplitude;
		amplitude *= persistence;
		p = p * lacunarity;
	}

	return total;
}

float saturate(float x) {
  	return clamp(x, 0.0, 1.0);
}

Material matMin(Material m0, Material m1) {
	if (m0.dist < m1.dist) {
		return m0;
	}

	return m1;
}

Material calculateSceneSDF(vec3 pos) {
	float currNoiseSample = noiseFBM(pos.xz / 2.0, 1, 0.5, 2.0);
	currNoiseSample = abs(currNoiseSample);
	currNoiseSample *= 1.5;

	currNoiseSample += 0.1 * noiseFBM(pos.xz * 4.0, 10, 0.5, 2.0);
	
	vec3 landColor = vec3(0.498, 0.434, 0.396);
	landColor = mix(
		landColor,
		landColor * 0.25,
		smoothstep(WATER_LEVEL - 0.1, WATER_LEVEL, currNoiseSample)
	);

	Material result = Material(landColor, pos.y + currNoiseSample);
	
	vec3 shallowColor = vec3(0.1, 0.2, 0.75);
	vec3 deepColor = vec3(0.01, 0.02, 0.15);
	vec3 waterColor = mix(
		shallowColor, 
		deepColor, 
		smoothstep(WATER_LEVEL, WATER_LEVEL + 0.1, currNoiseSample));

	waterColor = mix(
		waterColor,
		WHITE,
		smoothstep(WATER_LEVEL + 0.0125, WATER_LEVEL, currNoiseSample)
	);
	
	Material waterMat = Material(waterColor, pos.y + WATER_LEVEL);

	result = matMin(result, waterMat);
  	return result;
}

vec3 calculateNormal(vec3 pos) {
	const float EPS = 0.0001;

	return normalize(
		vec3(
			calculateSceneSDF(pos + vec3(EPS, 0.0, 0.0)).dist - calculateSceneSDF(pos - vec3(EPS, 0.0, 0.0)).dist,
			calculateSceneSDF(pos + vec3(0.0, EPS, 0.0)).dist - calculateSceneSDF(pos - vec3(0.0, EPS, 0.0)).dist,
			calculateSceneSDF(pos + vec3(0.0, 0.0, EPS)).dist - calculateSceneSDF(pos - vec3(0.0, 0.0, EPS)).dist
		)
	);
}

vec3 calculateLighting(vec3 pos, vec3 normal, vec3 lightColor, vec3 lightDir) {
	float ambientStrength = 0.012;
    vec3 ambient = ambientStrength * lightColor;
	
	float diff = saturate(dot(normal, lightDir));
	vec3 diffuse = diff * lightColor;

	return ambient + diffuse;

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

Material rayCast(vec3 cameraOrigin, vec3 cameraDir, int numSteps, float startDist, float maxDist) {
	Material mat = Material(vec3(0.0), startDist);
	Material defaultMat = Material(vec3(0.0), -1.0);
	
	for (int i = 0; i < numSteps; ++i) {
		vec3 pos = cameraOrigin + cameraDir * mat.dist;
		Material result = calculateSceneSDF(pos);

		// Case 1: distToScene < MIN_DIST, intersected scene
		if (abs(result.dist) < MIN_DIST * mat.dist) {
			break;
		}

		mat.dist += result.dist;
		mat.color = result.color;
		
		// Case 2: dist > MAX_DIST, out of the scene entirely
		if (mat.dist > maxDist) {
			return defaultMat;
		}
	}

	return mat;
}

float calculateShadow(vec3 pos, vec3 lightDir) {
	Material result = rayCast(pos, lightDir, 64, 0.01, 10.0);

	if (result.dist >= 0.0) {
		return 0.0;
	}

	return 1.0;
}

vec3 rayMarch(vec3 cameraOrigin, vec3 cameraDir) {
	Material mat = rayCast(cameraOrigin, cameraDir, NUM_STEPS, 1.0, MAX_DIST);

	float skyFactor = exp(saturate(cameraDir.y) * -40.0);
	vec3 skyColor = mix(vec3(0.025, 0.065, 0.5), vec3(0.7, 0.2, 0.0), skyFactor);
	
	if (mat.dist < 0.0) {
		return skyColor;
	}

	vec3 pos = cameraOrigin + mat.dist * cameraDir;
	vec3 normal = calculateNormal(pos);

	vec3 lightColor = WHITE;	
	vec3 lightDir = normalize(vec3(-0.5, 0.2, -0.6));
	float sunFactor = pow(saturate(dot(lightDir, cameraDir)), 8.0);
	
	// Shadow and lighting
	float shadowed = calculateShadow(pos, lightDir);
	vec3 lighting = calculateLighting(pos, normal, lightColor, lightDir);

	lighting *= shadowed;

	vec3 color = mat.color * lighting;

	// Fog Calculation
	float fogDist = distance(cameraOrigin, pos);
	float inscatter = 1.0 - exp(-fogDist * fogDist * mix(0.0005, 0.0001, sunFactor));
	float extinction = exp(-fogDist * fogDist * 0.01);
	vec3 fogColor = mix(skyColor, skyColor, sunFactor);

	color = color * extinction + fogColor * inscatter;
	return color;
}

mat3 makeCameraMatrix(vec3 cameraOrigin, vec3 cameraLookAt, vec3 cameraUp) {
	vec3 z = normalize(cameraLookAt - cameraOrigin);
	vec3 x = normalize(cross(z, cameraUp));
	vec3 y = cross(x, z);

	return mat3(x, y, z);
}

void main() {
	vec2 pixelCoords = (vUvs - 0.5) * resolution;

	float t = time * 0.0;
	vec3 rayDir = normalize(vec3(pixelCoords * 2.0 / resolution.y, 1.0));
	vec3 rayOrigin = vec3(3.0, 1.0, -3.0) * vec3(cos(t), 1.0, sin(t));
	vec3 rayLookAt = vec3(0.0);

	mat3 camera = makeCameraMatrix(rayOrigin, rayLookAt, vec3(0.0, 1.0, 0.0));

  	vec3 color = rayMarch(rayOrigin, camera * rayDir);

  	gl_FragColor = vec4(pow(color, vec3(1.0 / 2.2)), 1.0);
}
