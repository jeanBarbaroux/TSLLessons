import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { float, Fn, hash, instanceIndex, mul, pass, PI, range, select, time, TWO_PI, uint, uv, varying, vec3 } from 'three/tsl'

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.threejs')

// Scene
const scene = new THREE.Scene()

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
camera.position.x = - 4
camera.position.y = 2
camera.position.z = 2
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
bloomPass.strength.value = 0.05

renderPipeline.outputNode = scenePassColor.add(bloomPass)

const bloomGui = renderer.inspector.createParameters('Bloom').close()
bloomGui.add(bloomPass.threshold, 'value', 0, 2, 0.01).name('threshold')
bloomGui.add(bloomPass.strength, 'value', 0, 2, 0.01).name('strength')

/**
 * Galaxy
 */

const count = 10000
const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false
})
const galaxy = new THREE.Sprite(material)
galaxy.count = count
scene.add(galaxy)

const randomSphericalPosition = Fn(([seed = uint(0), radius = float(1)]) => {
    const u = hash(seed)
    const v = hash(seed.add(123).mul(2))
    const theta = u.mul(TWO_PI)
    const phi = v.remap(0, 1, -1, 1).acos()
    const sinPhi = phi.sin()

    return vec3(theta.sin().mul(sinPhi), phi.cos(), theta.cos().mul(sinPhi)).mul(radius)
}, { seed: 'uint', radius: 'float', return: 'vec3' })

const progress = varying(0)

material.positionNode = Fn(() => {
    const newPosition = vec3(instanceIndex, 0, 0)

    progress.assign(range(0, 1).add(time.mul(0.02)).fract())

    const angle = instanceIndex.toFloat().mod(3).div(3).mul(TWO_PI)
    angle.addAssign(progress.mul(2).exp())

    const radius = progress.oneMinus().mul(3)
    newPosition.x.assign(angle.cos().mul(radius))
    newPosition.y.assign(angle.sin().mul(radius))

    const spreadRadius = progress.oneMinus().mul(range(0, 1))
    const spread = randomSphericalPosition(instanceIndex, spreadRadius)
    newPosition.addAssign(spread)

    return newPosition
})()

material.scaleNode = range(0, 0.025)

material.colorNode = Fn(() => {
    const distanceToCenter = uv().sub(0.5).length()
    const shape1 = distanceToCenter.step(0.5).oneMinus()
    const shape2 = shape1.sub(float(0.4).step(distanceToCenter))
    const shapePingPong = instanceIndex.mod(2)
    const shape = select(shapePingPong.equal(0), shape1, shape2)

    const fade = progress.remapClamp(0, 0.5, 0, 1)

    const final = mul(shape, fade, 10)

    return vec3(final)
})()
/**
 * Animate
 */
const tick = () => {
    // Update controls
    controls.update()

    // Render
    renderPipeline.render()
    // renderer.render(scene, camera)
}

renderer.setAnimationLoop(tick)
