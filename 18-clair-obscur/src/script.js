import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { color, compute, deltaTime, Fn, hash, If, instancedArray, instanceIndex, min, mix, mx_noise_vec3, normalLocal, pass, positionLocal, range, rotate, time, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { randomSphericalPosition } from './utils'

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.threejs')

// Scene
const scene = new THREE.Scene()

// Texture loader
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
camera.position.z = 4
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0, 0)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    antialias: true
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.CineonToneMapping
renderer.toneMappingExposure = 1
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0x111111)
renderer.inspector = new Inspector()
await renderer.init()

/**
 * Post processing
 */
const renderPipeline = new THREE.RenderPipeline(renderer)
const scenePass = pass(scene, camera)
const scenePassColor = scenePass.getTextureNode('output')
const bloomPass = bloom(scenePassColor)
bloomPass.threshold.value = 0
bloomPass.strength.value = 0.25

renderPipeline.outputNode = scenePassColor.add(bloomPass)

const bloomGui = renderer.inspector.createParameters('Bloom').close()
bloomGui.add(bloomPass.threshold, 'value', 0, 2, 0.01).name('threshold')
bloomGui.add(bloomPass.strength, 'value', 0, 2, 0.01).name('strength')

/**
 * Cursor
 */
const raycaster = new THREE.Raycaster()
const cursor = new THREE.Vector2()

const intersectionPlane = new THREE.Plane(
    new THREE.Vector3(0, 0, 1),
    0
)
const intersect = new THREE.Vector3()

window.addEventListener('pointermove', (event) => {
    cursor.x = (event.clientX / sizes.width) * 2 - 1
    cursor.y = - (event.clientY / sizes.height) * 2 + 1
})

/**
 * Petals
 */
const count = 500
const petalTexture = textureLoader.load('./petals-alpha-map.png')

const geometry = new THREE.SphereGeometry(1, 3, 3, Math.PI * 0.4, Math.PI * 0.2, Math.PI * 0.4, Math.PI * 0.2)
geometry.translate(0, 0, -1)
const material = new THREE.MeshLambertNodeMaterial({
    side: THREE.DoubleSide,
    alphaMap: petalTexture,
    alphaTest: 0.1
})

//uniforms
const scale = uniform(0.1)
const colorA = uniform(color(0xFFFCFC))
const colorB = uniform(color(0xFF142C))
const radius = uniform(0.35)
const windStrength = uniform(0.003)
const windFrequency = uniform(3)
const windVariation = uniform(0.3)
const spawnPoint = uniform(vec3())

//buffers
const scaleBuffer = range(0.5, 1)
const colorMixBuffer = range(0, 1)
const initialPosotionsBuffer = instancedArray(count, 'vec3')
const positionsBuffer = instancedArray(count, 'vec3')
const progressesBuffer = instancedArray(count, 'float')

const initPetals = Fn(() => {
    const initialPosition = initialPosotionsBuffer.element(instanceIndex)
    const position = positionsBuffer.element(instanceIndex)
    const progress = progressesBuffer.element(instanceIndex)

    initialPosition.assign(randomSphericalPosition(instanceIndex, 1))
    position.assign(initialPosition.mul(radius))
    progress.assign(hash(instanceIndex.mul(3)))
})()
const initCompute = initPetals.compute(count)
renderer.compute(initCompute)

const updatePetals = Fn(() => {
    const initialPosition = initialPosotionsBuffer.element(instanceIndex)
    const position = positionsBuffer.element(instanceIndex)
    const progress = progressesBuffer.element(instanceIndex)

    //progress
    progress.addAssign(deltaTime.mul(0.6))
    If(progress.greaterThan(1), () => {
        progress.assign(progress.fract())
        position.assign(initialPosition.mul(radius).add(spawnPoint))
    })

    const wind = mx_noise_vec3(
        position.mul(windFrequency)
            .add(time.mul(windVariation))
    ).mul(windStrength)

    position.addAssign(wind)
})()
const updatePetalsCompute = updatePetals.compute(count)

material.positionNode = Fn(() => {
    const position = positionsBuffer.element(instanceIndex)
    const progress = progressesBuffer.element(instanceIndex)

    const rotation = position.add(instanceIndex).mul(10)
    positionLocal.assign(rotate(positionLocal, rotation))
    normalLocal.assign(rotate(normalLocal, rotation))

    const progressScale = min(
        progress.remap(0, 0.1),
        progress.remap(1, 0.5)
    ).clamp(0, 1)


    positionLocal.mulAssign(scale, scaleBuffer, progressScale)
    positionLocal.addAssign(position)

    return positionLocal
})()

material.colorNode = mix(colorA, colorB, colorMixBuffer.smoothstep(0, 1)).toVertexStage()

const mesh = new THREE.Mesh(geometry, material)
mesh.count = count
mesh.castShadow = true
mesh.receiveShadow = true
scene.add(mesh)

const petalsFolderGui = renderer.inspector.createParameters('petals')
petalsFolderGui.add(scale, 'value', 0, 1, 0.001).name('scale')
petalsFolderGui.addColor(colorA, 'value').name('colorA')
petalsFolderGui.addColor(colorB, 'value').name('colorB')
petalsFolderGui.add(radius, 'value', 0, 1, 0.001).name('radius')
petalsFolderGui.add(windFrequency, 'value', 0, 10, 0.01).name('windFrequency')
petalsFolderGui.add(windStrength, 'value', 0, 0.01, 0.0001).name('windStrength')
petalsFolderGui.add(windVariation, 'value', 0, 1, 0.001).name('windVariation')

/**
 * Title
 */
{
    // Mesh
    const title = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 1),
        new THREE.MeshStandardNodeMaterial({
            transparent: true,
            alphaMap: textureLoader.load('./clair-obscur-title.png'),
        })
    )
    title.position.z = -0.05
    title.receiveShadow = true
    scene.add(title)

    // Color
    const colorA = uniform(color(0xffdfb3))
    const colorB = uniform(color(0xbb4c30))
    const centerDistance = uv().sub(vec2(0.5, 0.6)).length().mul(1.5).min(1)
    const colorMix = mix(colorA, colorB, centerDistance)
    title.material.colorNode = vec4(colorMix, 1)

    // Debug
    const titleGui = renderer.inspector.createParameters('Title').close()

    titleGui.addColor(colorA, 'value').name('colorA')
    titleGui.addColor(colorB, 'value').name('colorB')
}

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight(0xffffff, 3)
directionalLight.castShadow = true
directionalLight.position.set(1, 1, 0.75).normalize().multiplyScalar(5)
directionalLight.shadow.camera.far = 10
directionalLight.shadow.mapSize.set(2048, 2048)
directionalLight.shadow.radius = 2
directionalLight.shadow.normalBias = -0.1
scene.add(directionalLight)

const ambientLight = new THREE.AmbientLight(0xffffff, 0.05)
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

    renderer.compute(updatePetalsCompute)

    raycaster.setFromCamera(cursor, camera)
    raycaster.ray.intersectPlane(intersectionPlane, intersect)
    spawnPoint.value.copy(intersect)

    // Render
    renderPipeline.render()
}

renderer.setAnimationLoop(tick)