import * as THREE from 'https://cdn.skypack.dev/three@0.136';

class Terrain {
	constructor() {}
	
	async initialize() {
		this.renderer = new THREE.WebGLRenderer();
    	document.body.appendChild(this.renderer.domElement);

    	window.addEventListener('resize', () => {
			this.onWindowResize();
    	}, false);

		this.scene = new THREE.Scene();

		this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 1000);
		this.camera.position.set(0, 0, 1);

		this.clock = new THREE.Clock();

		await this.setup();

		this.onWindowResize();
		this.animate();
	}

  	async setup() {
		const vsh = await fetch('./shaders/terrain.vert');
		const fsh = await fetch('./shaders/terrain.frag');

		const material = new THREE.ShaderMaterial({
			uniforms: {
				resolution: {value: new THREE.Vector2(window.innerWidth, window.innerHeight)},
				time: {value: 0.0},
			},
			vertexShader: await vsh.text(),
			fragmentShader: await fsh.text()
		});

		this.mat = material;

		const geometry = new THREE.PlaneGeometry(1, 1);
		const plane = new THREE.Mesh(geometry, material);
		plane.position.set(0.5, 0.5, 0);
		this.scene.add(plane);
		this.onWindowResize();
		this.clock.start();
	}

	onWindowResize() {
		const dpr = window.devicePixelRatio;
		const canvas = this.renderer.domElement;
		canvas.style.width = window.innerWidth + 'px';
		canvas.style.height = window.innerHeight + 'px';
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;

		this.renderer.setSize(w * dpr, h * dpr, false);
		this.mat.uniforms.resolution.value = new THREE.Vector2(
			window.innerWidth * dpr, 
			window.innerHeight * dpr);
	}

	animate() {
		requestAnimationFrame((t) => {
			this.mat.uniforms.time.value = this.clock.getElapsedTime();
			this.renderer.render(this.scene, this.camera);
			this.animate();
		});
	}
}


let APP_ = null;

window.addEventListener('DOMContentLoaded', async () => {
	APP_ = new Terrain();
  	await APP_.initialize();
});
