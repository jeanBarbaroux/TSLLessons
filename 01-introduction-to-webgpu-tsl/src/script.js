import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import * as THREE from 'three'

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

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
const renderer = new THREE.WebGLRenderer({
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
    const texture = textureLoader.load('./floor-color.jpg')
    texture.colorSpace = THREE.SRGBColorSpace
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshStandardMaterial({ map: texture })
    )
    mesh.rotation.x = - Math.PI * 0.5
    mesh.receiveShadow = true
    scene.add(mesh)
}

/**
 * Dummy
 */
{
    const geometry = new THREE.TorusKnotGeometry(0.5, 0.24, 128, 32)
    const material = new THREE.MeshStandardMaterial()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.y = 1
    scene.add(mesh)
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
const timer = new THREE.Timer()
timer.connect(document)

const tick = () =>
{
    timer.update()

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()