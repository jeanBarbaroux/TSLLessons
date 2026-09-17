import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import {
    uv,
    vec2,
    vec3,
    vec4,
    float,
    int,
    bool,
    add,
    checker,
    atan,
    PI,
    TWO_PI,
    rand,
    hash,
    time,
    mx_noise_float,
    mx_noise_vec3,
    mx_noise_vec4,
    mx_worley_noise_float, Fn, cos, mul, mix, color, parallaxUV
} from 'three/tsl'

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
camera.position.set(1.25, 2, 4)
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
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0x111111)
renderer.inspector = new Inspector()

/**
 * Floor
 */
{

    const textureColor = textureLoader.load('./floor-color.jpg')
    textureColor.colorSpace = THREE.SRGBColorSpace

    const geometry = new THREE.PlaneGeometry(10, 10)

    const material = new THREE.MeshBasicNodeMaterial({ map: textureColor, transparent: true })
    material.opacityNode = uv().sub(0.5).length().smoothstep(0.5, 0.2)

    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = - Math.PI * 0.5
    mesh.receiveShadow = true
    scene.add(mesh)
}

/**
 * Patterns
 */
// Geometry
const geometry = new THREE.CircleGeometry(2, 32)

// Material
const material = new THREE.MeshBasicNodeMaterial()

// pattern 1
// material.outputNode = vec3(uv(), 1)

// pattern 2
// const pattern = vec3(uv().x)

// pattern 3
// const pattern = vec3(uv().x.mul(10).fract())

// pattern 4: checker (2 ways)
// const pattern = vec3(
//     add(
//         uv().x.mul(10).fract().step(0.5),
//         uv().y.mul(10).fract().step(0.5)
//     ).sub(1).abs()
// )
// const pattern = vec3(checker(uv().mul(4))).oneMinus()

// pattern 5: circle
// const pattern = vec3(uv().distance(vec2(0.5)))

// pattern 6
// const polarUv = uv().sub(0.5)
// const pattern = vec3(atan(polarUv.x, polarUv.y)).remap(PI.negate(), PI, 0, 1)

// pattern 7
// const subdivision = 10
// const gridUv = uv().mul(subdivision).floor()
// // const pattern = vec3(hash(gridUv.x.mul(subdivision).add(gridUv.y)))
// const pattern = vec3(rand(gridUv))

// // pattern 8
// const perlinUv = uv().mul(5)
// const perlin = mx_noise_float(perlinUv)
// const pattern = vec3(perlin.mul(5).add(time.mul(0.2)).fract().step(0.8))

// pattern 9
// By Inigo Quilez (https://iquilezles.org/articles/palettes/)
 export const palette = Fn(([ t, a, b, c, d]) =>
 {
     return a.add(b.mul(cos(mul(6.283185, c.mul(t).add(d)))))
 }, { t: 'float', a: 'vec3', b: 'vec3', c: 'vec3', d: 'vec3', return: 'vec3' })
//
 const worleyUv = uv().mul(10)
 const worleyNoise = mx_worley_noise_float(vec3(worleyUv, time.mul(0.2)))
 const caustic = palette(
     worleyNoise,
     vec3(0.5, 0.3, 0.4),
     vec3(0.9, 0.5, 0.4),
     vec3(1.0, 1.0, 1.0),
     vec3(0.0, 0.1, 0.2)
 )

// pattern 10
const depthUv = parallaxUV(uv(), 0.5).xy
const causticsInput = depthUv.mul(6)
const causticsNoise = mx_worley_noise_float(vec3(causticsInput, time.mul(0.3))).pow(3)
const depthColor = mix(color(0x1b3956), color(0x11eeff), causticsNoise)

const foamInput = uv().mul(5)
const foamNoise = mx_noise_float(vec3(foamInput, time.mul(0.1)))
const foamMask = foamNoise.abs().step(0.05).oneMinus()
const foamColor = color(0xe5f7ff)

const lilyPadInput = vec3(uv().mul(4), 0)
const lilyPadNoise = mx_worley_noise_float(lilyPadInput)
const lilyPadMask = lilyPadNoise.step(0.2).oneMinus()
const lilyPadColor = mix(color(0xd7e689), color(0x329a89), lilyPadNoise.mul(5))

let final = mix(depthColor, foamColor, foamMask)
final = mix(final, lilyPadColor, lilyPadMask)
 material.outputNode = final

// Mesh
const mesh = new THREE.Mesh(geometry, material)
mesh.position.y = 0.01
mesh.rotation.x = -Math.PI * 0.5
scene.add(mesh)

/**
 * Animate
 */
const timer = new THREE.Timer()

const tick = () => {
    timer.update()

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)
}

renderer.setAnimationLoop(tick)
