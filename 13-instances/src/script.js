import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import {
    Fn,
    instancedBufferAttribute,
    instanceIndex,
    normalLocal,
    positionLocal,
    rotate,
    sin,
    time,
    uniform,
    uv
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

window.addEventListener('resize', () =>
{
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
camera.position.x = 2
camera.position.y = 2.5
camera.position.z = 4 * 1.25
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0.75, 0)
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
await renderer.init()

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
 * Common
 */
const count = 4

const material = new THREE.MeshStandardNodeMaterial()

const geometry = new THREE.BoxGeometry(0.5, 1, 0.5, 12, 12, 12)

const wave = sin(time.add(positionLocal.y.mul(3))).mul(0.4)

/**
 * Method 1
 * without instancing
 * NOT GOOD
 */
//
// material.positionNode = Fn(() => {
//     positionLocal.z.addAssign(wave)
//     return positionLocal
// })()

//
// for (let i = 0; i < count; i++) {
//     const mesh = new THREE.Mesh(geometry, material)
//     mesh.castShadow = true
//     mesh.receiveShadow = true
//     scene.add(mesh)
//
//     const progress = i / (count - 1)
//     mesh.position.x = (progress - 0.5) * 4
//     mesh.position.y = 1
//     mesh.rotation.y = progress * 3
// }

/**
 * Method 2
 * With InstancedMesh
 * Legacy
 */
// material.positionNode = Fn(() => {
//     positionLocal.z.addAssign(wave)
//     return positionLocal
// })()
//
// const mesh = new THREE.InstancedMesh(geometry, material, count)
// mesh.position.y = 1
// mesh.castShadow = true
// mesh.receiveShadow = true
//
// for(let i = 0; i < count; i++) {
//     const progress = i / (count - 1)
//     const position = new THREE.Vector3((progress - 0.5) * 4, 0 , 0)
//     const scale = new THREE.Vector3(1, 1, 1)
//     const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, progress * 3, 0))
//     const matrix = new THREE.Matrix4().compose(position, rotation, scale)
//     mesh.setMatrixAt(i, matrix)
// }
//
// scene.add(mesh)

/**
 * Method 3
 * With instanceIndex
 */
// const countUniform = uniform(count)
//
// material.positionNode = Fn(({object}) => {
//     const progress = instanceIndex.toFloat().div(countUniform.sub(1))
//
//     positionLocal.xz.assign(rotate(positionLocal.xz, progress.mul(3)))
//     normalLocal.xz.assign(rotate(normalLocal.xz, progress.mul(3)))
//
//     positionLocal.x.addAssign(progress.sub(0.5).mul(4))
//
//     positionLocal.z.addAssign(wave)
//
//     return positionLocal
// })()
//
// const mesh = new THREE.Mesh(geometry, material)
// mesh.count = count
// mesh.position.y = 1
// mesh.castShadow = true
// mesh.receiveShadow = true
// scene.add(mesh)
//
// const instacesGui = renderer.inspector.createParameters('Instances')
// instacesGui.add(mesh, 'count', 0, 20, 1).onChange(() => {
//     countUniform.value = mesh.count
// })

/**
 * Method 4
 * InstancedBufferAttribute
 */
const positionArray = new Float32Array(count * 3)
const rotationArray = new Float32Array(count * 3)

const positionBuffer = new THREE.InstancedBufferAttribute(positionArray, 3)
const rotationBuffer = new THREE.InstancedBufferAttribute(rotationArray, 1)
for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const progress = i / (count - 1)

    positionArray[i3] = (progress - 0.5) * 4
    positionArray[i3 + 1] = 0
    positionArray[i3 + 2] = 0
    positionArray[i3 + 3] = 0

    rotationArray[i] = progress * 3
}

material.positionNode = Fn(() => {
    const instancedPosition = instancedBufferAttribute(positionBuffer)
    const instancedRotation = instancedBufferAttribute(rotationBuffer)
    positionLocal.xz.assign(rotate(positionLocal.xz, instancedRotation))
    normalLocal.xz.assign(rotate(normalLocal.xz, instancedRotation))

    positionLocal.addAssign(instancedPosition)

    positionLocal.z.addAssign(wave)

    return positionLocal
})()

const mesh = new THREE.Mesh(geometry, material)
mesh.count = count
mesh.position.y = 1
mesh.castShadow = true
mesh.receiveShadow = true
scene.add(mesh)

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight(0xffc799, 4)
directionalLight.castShadow = true
directionalLight.position.set(4, 2, 1).normalize().multiplyScalar(10)
directionalLight.shadow.radius = 5
directionalLight.shadow.normalBias = 0.1
scene.add(directionalLight)

const ambientLight = new THREE.AmbientLight(0x859dff, 0.5)
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
const tick = () =>
{
    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)
}

renderer.setAnimationLoop(tick)
