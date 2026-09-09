 import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
    attribute, checker,
    color, materialColor, modelDirection, modelPosition,
    normalLocal, normalView,
    normalWorld,
    positionGeometry,
    positionLocal,
    positionWorld, screenCoordinate, screenUV, userData,
    uv,
    vec2,
    vec3,
    vec4
} from 'three/tsl'
 import { TransformControls } from 'three/addons/controls/TransformControls.js'

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
camera.position.x = 5
camera.position.y = 4.5
camera.position.z = 2.5
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 1, 0)
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

/**
 * Floor
 */
{
    const textureColor = textureLoader.load('./floor-color.jpg')
    textureColor.colorSpace = THREE.SRGBColorSpace

    const geometry = new THREE.PlaneGeometry(10, 10, 10, 10)

    const material = new THREE.MeshStandardNodeMaterial({ map: textureColor })
    const pattern = vec3(checker(uv().mul(4)))
    material.colorNode = pattern.mul(materialColor)

    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = - Math.PI * 0.5
    mesh.receiveShadow = true
    scene.add(mesh)
}

/**
 * Torus Knot
 */
{
    const geometry = new THREE.TorusKnotGeometry(0.5, 0.24, 128, 32)

    const material = new THREE.MeshStandardNodeMaterial()
    material.outputNode = vec4(attribute('position'), 1)

    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.foo = new THREE.Color('#705DF2')
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.y = 1
    scene.add(mesh)

    setTimeout(() => {
        mesh.userData.foo = new THREE.Color('orange')
    }, 1000)

    // TransformControl
    const transformControls = new TransformControls(camera, canvas)
    transformControls.attach(mesh)
    scene.add(transformControls.getHelper())

    transformControls.addEventListener('dragging-changed', (event) =>
    {
        controls.enabled = !event.value
    })

    window.addEventListener('keydown', (event) =>
    {
        if(event.key === 'g')
            transformControls.setMode('translate')
        else if(event.key === 'r')
            transformControls.setMode('rotate')
        else if(event.key === 's')
            transformControls.setMode('scale')
    })
}

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight(0xffffff, 4.5)
directionalLight.castShadow = true
directionalLight.position.set(2, 0.75, -1).normalize().multiplyScalar(10)
directionalLight.shadow.camera.top = 10
directionalLight.shadow.camera.right = 10
directionalLight.shadow.camera.bottom = -10
directionalLight.shadow.camera.left = -10
directionalLight.shadow.camera.near = 0.01
directionalLight.shadow.camera.far = 20
directionalLight.shadow.radius = 3
directionalLight.shadow.normalBias = 0.1
scene.add(directionalLight)

const ambientLight = new THREE.AmbientLight(0x859dff, 1)
scene.add(ambientLight)

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
