import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { color, deltaTime, Fn, grayscale, hash, If, instancedArray, instanceIndex, materialColor, mix, mod, pass, positionGeometry, range, TWO_PI, uniform, uv, vec3, vec4 } from 'three/tsl'

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.threejs')

// Scene
const scene = new THREE.Scene()

// Loaders
const textureLoader = new THREE.TextureLoader()
const gltfLoader = new GLTFLoader()

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
camera.position.x = 5
camera.position.y = 4.5
camera.position.z = 2.5
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 1.5, 0)
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
    scene.add(mesh)
}

/**
 * Model
 */
const model = await gltfLoader.loadAsync('./anvil.glb')
model.scene.traverse(mesh => {
    mesh.castShadow = true
    mesh.receiveShadow = true
})
scene.add(model.scene)

/**
 * Sky
 */
const sky = new SkyMesh()
sky.scale.setScalar(1000)
scene.add(sky)
const effectController = {
    turbidity: 3.5,
    rayleigh: 3.215,
    mieCoefficient: 0.02,
    mieDirectionalG: 0.48,
    elevation: 0,
    azimuth: -51,
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
const directionalLight = new THREE.DirectionalLight(0xffaf85, 3)
directionalLight.castShadow = true
directionalLight.position.set(-1, 1, 0.75)
directionalLight.shadow.radius = 5
directionalLight.shadow.normalBias = 0.1
scene.add(directionalLight)

const ambientLight = new THREE.AmbientLight(0x4d70ff, 2.15)
scene.add(ambientLight)

// Debug
const lightsGui = renderer.inspector.createParameters('Lights').close()

lightsGui.addColor(directionalLight, 'color').name('directionalColor')
lightsGui.add(directionalLight, 'intensity', 0, 5, 0.01).name('directionalIntensity')

lightsGui.addColor(ambientLight, 'color').name('ambientColor')
lightsGui.add(ambientLight, 'intensity', 0, 5, 0.01).name('ambientIntensity')

/**
 * Hammer
 */
const hammer = model.scene.getObjectByName('hammer')
hammer.rotation.reorder('YXZ')

/**
 * Blade
 */
const blade = model.scene.getObjectByName('blade')
blade.material = new THREE.MeshPhysicalNodeMaterial().copy(blade.material)
const bladeEffectStrength = uniform(0)
const bladeColorA = uniform(color(0xff007b))
const bladeColorB = uniform(color(0xffb070))
const bladeEmissiveStrength = uniform(1.5)

blade.material.emissiveNode = Fn(() => {
    const mask = grayscale(materialColor.rgb).remapClamp(0, 0.13, 1, 0)
    const distanceToImpact = positionGeometry.sub(vec3(0, 0, 0.3)).length()
    const effect = mask.sub(distanceToImpact.mul(2)).add(bladeEffectStrength).max(0).pow(2)
    const emissiveColor = mix(bladeColorA, bladeColorB, effect).mul(effect).mul(bladeEmissiveStrength)

    return emissiveColor
})()

const bladeGui = renderer.inspector.createParameters('Blade')
bladeGui.addColor(bladeColorA, 'value').name('colorA')
bladeGui.addColor(bladeColorB, 'value').name('colorB')
bladeGui.add(bladeEmissiveStrength, 'value', 0, 5, 0.01).name('emissiveStrength')

/**
 * sparkles light
 */
const sparklesLight = new THREE.PointLight(0xff9955, 5)
sparklesLight.position.set(0.4, 2.65, 0.35)
scene.add(sparklesLight)

/**
 * Sparkles
 */
const count = 2000
const explosionCount = 150

const positions = instancedArray(count, 'vec3')
const velocities = instancedArray(count, 'vec3')
const lives = instancedArray(count, 'float')

//uniforms
const sparkelsIndex = uniform(0, 'int')
const sparklesScale = uniform(0.025)
const sparklesDecay = uniform(0.3)
const sparklesColorA = uniform(color(0xff822e))
const sparklesColorB = uniform(color(0x5e24ff))
const sparklesEmissiveStrength = uniform(45)

const sparklesExplodeCompute = Fn(() => {
    const newInstanceIndex = instanceIndex.add(sparkelsIndex).mod(count)
    const position = positions.element(newInstanceIndex)
    const velocity = velocities.element(newInstanceIndex)
    const life = lives.element(newInstanceIndex)

    //position
    position.assign(vec3(0.05, 1.95, -0.1))

    //velocity
    const angle = hash(newInstanceIndex).mul(TWO_PI)
    const explosionDirection = vec3(
        angle.sin(),
        hash(newInstanceIndex.add(123).mul(2)).mul(1.25),
        angle.cos()
    )
    velocity.assign(explosionDirection.mul(3))

    //life
    life.assign(hash(newInstanceIndex.add(234).mul(3)))

})().compute(explosionCount)

const sparklesUpdateCompute = Fn(() => {
    const position = positions.element(instanceIndex)
    const velocity = velocities.element(instanceIndex)
    const life = lives.element(instanceIndex)

    //gravity
    velocity.y.subAssign(deltaTime.mul(9.81))

    If(position.y.lessThan(0.05), () => {
        position.y.assign(0.05)
        velocity.mulAssign(vec3(0.9, -0.5, 0.9))
    })

    //apply velocity to position
    position.addAssign(velocity.mul(deltaTime))

    life.addAssign(sparklesDecay.mul(deltaTime))

    //life decay
    life.assign(life.add(sparklesDecay.mul(deltaTime))).min(1)

})().compute(count)

//material
const material = new THREE.SpriteNodeMaterial({ color: 0x000000 })

//position
material.positionNode = positions.element(instanceIndex)

material.scaleNode = sparklesScale
    .mul(range(0.5, 1))
    .mul(lives.element(instanceIndex).remapClamp(0.5, 1, 1, 0))

const colorMix = hash(instanceIndex.add(345).mul(4)).smoothstep(0, 1)
material.emissiveNode = mix(sparklesColorA, sparklesColorB, colorMix).mul(sparklesEmissiveStrength).toVertexStage()

//mesh
const mesh = new THREE.Sprite(material)
mesh.count = count
scene.add(mesh)

const sparklesGui = renderer.inspector.createParameters('Sparkles')
sparklesGui.add(sparklesScale, 'value', 0, 0.1, 0.0001).name('sparklesScale')
sparklesGui.add(sparklesDecay, 'value', 0, 1, 0.01).name('sparklesDecay')
sparklesGui.addColor(sparklesColorA, 'value').name('sparklesColorA')
sparklesGui.addColor(sparklesColorB, 'value').name('sparklesColorB')
sparklesGui.add(sparklesEmissiveStrength, 'value', 0, 100, 0.01).name('sparklesEmissiveStrength')

/**
 * Impact
 */
const impact = () => {
    hammer.rotation.x = Math.PI * 0.5

    bladeEffectStrength.value += 0.15

    sparklesLight.intensity += 3

    renderer.compute(sparklesExplodeCompute)
    sparkelsIndex.value += explosionCount
}

canvas.addEventListener('pointerdown', impact)

/**
 * Animate
 */
const timer = new THREE.Timer()

const tick = () => {
    timer.update()
    const deltaTime = Math.min(1 / 30, timer.getDelta())
    hammer.rotation.x += deltaTime * - hammer.rotation.x
    bladeEffectStrength.value += - bladeEffectStrength.value * deltaTime * 0.5
    sparklesLight.intensity += (5 - sparklesLight.intensity) * deltaTime * 3

    // Update controls
    controls.update()

    //compute
    renderer.compute(sparklesUpdateCompute)

    // Render
    renderPipeline.render()
}

renderer.setAnimationLoop(tick)
