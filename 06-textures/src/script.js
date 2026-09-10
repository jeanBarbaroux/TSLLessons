import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import {
    float, mix, normalLocal, positionLocal, rotateUV, texture, triplanarTextures, uv, vec2, materialColor, oscSine,
    time, blendDodge, blendBurn
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
 * Textures
 */
const uvChecker = textureLoader.load('./uvChecker.png')
uvChecker.colorSpace = THREE.SRGBColorSpace
uvChecker.wrapS = THREE.MirroredRepeatWrapping
uvChecker.wrapT = THREE.MirroredRepeatWrapping
uvChecker.repeat.set(4, 4)
uvChecker.rotation = 1

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
renderer.inspector = new Inspector()

/**
 * Floor
 */
{
    const geometry = new THREE.PlaneGeometry(10, 10, 10, 10)

    const material = new THREE.MeshStandardNodeMaterial({
        color: 'crimson',
        transparent: true
    })

    const oscillation = oscSine(time.mul(0.2))

    material.colorNode = blendBurn(
        texture(uvChecker).xyz,
        materialColor
    )

    const fade = uv().sub(0.5).length().smoothstep(0.5, 0.2)
    material.opacityNode = fade

    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = - Math.PI * 0.5
    mesh.receiveShadow = true
    scene.add(mesh)

    const gui = renderer.inspector.createParameters('Floor')
    gui.addColor(material, 'color').name('Color')
}

/**
 * Torus Knot
 */
{
    const geometry = new THREE.TorusKnotGeometry(0.5, 0.24, 128, 32)

    const material = new THREE.MeshStandardNodeMaterial()
    material.colorNode = triplanarTextures(
        texture(uvChecker),
        null,
        null,
        float(1),
        positionLocal,
        normalLocal
    )

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.y = 1
    scene.add(mesh)

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
