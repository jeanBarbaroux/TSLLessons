import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { color, pass, uniform, uv } from 'three/tsl'
import Explosions from './Explosions'

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.threejs')

// Scene
const scene = new THREE.Scene()

// Loaders
const textureLoader = new THREE.TextureLoader()

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100)
camera.position.x = 7
camera.position.y = 2.5
camera.position.z = 7
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0, 0)
controls.enableDamping = true
controls.enabled = true

/**
 * Renderer
 */
const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    antialias: true
})
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.shadowMap.transmitted = false
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0x111111)
renderer.inspector = new Inspector()

/**
 * Post processing
 */
const renderPipeline = new THREE.RenderPipeline(renderer)
const scenePass = pass(scene, camera)
const scenePassColor = scenePass.getTextureNode('output')
const bloomPass = bloom(scenePassColor)
bloomPass.threshold.value = 0
bloomPass.strength.value = 0.05

renderPipeline.outputNode = scenePassColor.add(bloomPass)

const bloomGui = renderer.inspector.createParameters('Bloom').close()
bloomGui.add(bloomPass.threshold, 'value', 0, 2, 0.01).name('threshold')
bloomGui.add(bloomPass.strength, 'value', 0, 2, 0.01).name('strength')

/**
 * Explosions
 */
const simplexTexture = await textureLoader.load('./simplex-tiling-noise-256x256.png')
simplexTexture.wrapS = THREE.RepeatWrapping
simplexTexture.wrapT = THREE.RepeatWrapping

const explosions = new Explosions(simplexTexture, 500, uniform(color(0xff1111)), uniform(color(0x116eff)), uniform(30))
scene.add(explosions.mesh)

const raycaster = new THREE.Raycaster()
const cursor = new THREE.Vector2()
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

let shooting = false

window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        shooting = true
    }
})

window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        shooting = false
    }
})

document.addEventListener('pointermove', (event) => {
    cursor.x = (event.clientX / sizes.width) * 2 - 1
    cursor.y = - (event.clientY / sizes.height) * 2 + 1
})

window.setInterval(() => {
    if (!shooting)
        return

    const newCursor = cursor.clone()
    newCursor.x += (Math.random() - 0.5) * 0.2
    newCursor.y += (Math.random() - 0.5) * 0.2

    raycaster.setFromCamera(newCursor, camera)
    let intersect = new THREE.Vector3()
    intersect = raycaster.ray.intersectPlane(floorPlane, intersect)

    if (intersect) {
        explosions.create(intersect, 0.5 + Math.random() * 0.5)
    }
}, 40)

canvas.addEventListener('pointerdown', (event) => {
    cursor.x = (event.clientX / sizes.width) * 2 - 1
    cursor.y = - (event.clientY / sizes.height) * 2 + 1

    raycaster.setFromCamera(cursor, camera)
    let intersect = new THREE.Vector3()
    intersect = raycaster.ray.intersectPlane(floorPlane, intersect)

    if (intersect) {
        explosions.create(intersect, 0.5 + Math.random() * 0.5)
    }

})

const explosionsGui = renderer.inspector.createParameters('Explosions')

explosionsGui.addColor(explosions.emissiveColorA, 'value').name('emissiveColorA')
explosionsGui.addColor(explosions.emissiveColorB, 'value').name('emissiveColorB')
explosionsGui.add(explosions.emissiveStrength, 'value', 1, 100, 0.01).name('strength')

/**
 * Floor
 */
{
    const texture = textureLoader.load('./floor-color.jpg')
    texture.colorSpace = THREE.SRGBColorSpace
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshStandardNodeMaterial({ map: texture, transparent: true })
    )
    mesh.material.opacityNode = uv().sub(0.5).length().smoothstep(0.5, 0.2)
    mesh.rotation.x = - Math.PI * 0.5
    mesh.receiveShadow = true
    mesh.renderOrder = -1
    scene.add(mesh)
}

/**
 * Sky
 */
const sky = new SkyMesh()
sky.scale.setScalar(1000)
scene.add(sky)
const effectController = {
    turbidity: 5.5,
    rayleigh: 1.25,
    mieCoefficient: 0.02,
    mieDirectionalG: 0.35,
    elevation: 0.4,
    azimuth: 131,
    cloudCoverage: 0.4,
    cloudDensity: 0.4,
    cloudElevation: 0.5
}

const sun = new THREE.Vector3()

const skyChanged = () => {

    sky.turbidity.value = effectController.turbidity
    sky.rayleigh.value = effectController.rayleigh
    sky.mieCoefficient.value = effectController.mieCoefficient
    sky.mieDirectionalG.value = effectController.mieDirectionalG
    sky.cloudCoverage.value = effectController.cloudCoverage
    sky.cloudDensity.value = effectController.cloudDensity
    sky.cloudElevation.value = effectController.cloudElevation

    const phi = THREE.MathUtils.degToRad(90 - effectController.elevation)
    const theta = THREE.MathUtils.degToRad(effectController.azimuth)

    sun.setFromSphericalCoords(1, phi, theta)

    sky.sunPosition.value.copy(sun)
}

skyChanged()

// Debug
const skyGui = renderer.inspector.createParameters('Sky').close()

skyGui.add(effectController, 'turbidity', 0.0, 20.0, 0.1).onChange(skyChanged)
skyGui.add(effectController, 'rayleigh', 0.0, 4, 0.001).onChange(skyChanged)
skyGui.add(effectController, 'mieCoefficient', 0.0, 0.1, 0.001).onChange(skyChanged)
skyGui.add(effectController, 'mieDirectionalG', 0.0, 1, 0.001).onChange(skyChanged)
skyGui.add(effectController, 'elevation', -10, 90, 0.1).onChange(skyChanged)
skyGui.add(effectController, 'azimuth', - 180, 180, 0.1).onChange(skyChanged)

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight(0xffffff, 4)
directionalLight.position.set(1, 0.5, -0.75).normalize().multiplyScalar(10)
directionalLight.shadow.camera.near = 0.01
directionalLight.shadow.camera.far = 30
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.castShadow = true
directionalLight.shadow.radius = 5
directionalLight.shadow.normalBias = 0.1
scene.add(directionalLight)

const ambientLight = new THREE.AmbientLight(0xffa985, 1)
scene.add(ambientLight)

// Debug
const lightsGui = renderer.inspector.createParameters('Lights').close()

lightsGui.addColor(directionalLight, 'color').name('directionalColor')
lightsGui.add(directionalLight, 'intensity', 0, 5, 0.01).name('directionalIntensity')

lightsGui.addColor(ambientLight, 'color').name('ambientColor')
lightsGui.add(ambientLight, 'intensity', 0, 5, 0.01).name('ambientIntensity')

/**
 * Animate
 */
const tick = () => {
    // Update controls
    controls.update()

    // Render
    renderPipeline.render()
}

renderer.setAnimationLoop(tick)
