import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import { uv, Fn, vec3, vec2, float, If, bool, Discard, int, Loop } from 'three/tsl'

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

    const material = new THREE.MeshStandardNodeMaterial({ map: uvChecker, transparent: true, side: THREE.DoubleSide })
    
        const circles = Fn( ({
            coordinates = uv(),
            center = vec2(0.5),
            radius = float(0.25),
            thickness = float(0.02),
            inverted = bool(false),
            discarded = bool(false),
            count = int(5),
            span = float(0.1)
        }) => {
            const lines = float(0)

            Loop({start: 0, end: count, type: 'float', condition: '<', name: 'i'}, ({i}) => {
                lines.addAssign(circle({ 
                    coordinates,
                    center,
                    radius: radius.add(i.mul(span)),
                    thickness,
                    inverted: bool(false),
                    discarded: bool(false)
                 }))
            })

            If(inverted, () => {
                lines.assign(lines.oneMinus())
            })
            
            lines.lessThanEqual(0).and(discarded).discard()

            return lines
        })

    const circle = Fn(({
        coordinates = uv(),
        center = vec2(0.5),
        radius = float(0.25),
        thickness = float(0.02),
        inverted = bool(false),
        discarded = bool(false)
    }) => {
        const distanceToCenter = coordinates.distance(center)
        const lineSDF = distanceToCenter.sub(radius)
        const line = lineSDF.abs().step(thickness.mul(0.5))

        If(inverted.not(), () => {
            line.assign(line.oneMinus())
        })

        line.lessThanEqual(0).and(discarded).discard()

        return line
    })

    material.colorNode = vec3(circles({ radius: float(0.075), discarded: true}).toVar('circles'))

    const fade = uv().sub(0.5).length().smoothstep(0.5, 0.2)
    material.opacityNode = fade

    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = - Math.PI * 0.5
    mesh.receiveShadow = true
    scene.add(mesh)

    const program = await renderer.debug.getShaderAsync(scene, camera, mesh)
    console.log(program)
}

/**
 * Torus Knot
 */
{
    const geometry = new THREE.TorusKnotGeometry(0.5, 0.24, 128, 32)

    const material = new THREE.MeshStandardNodeMaterial()

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
const tick = () => {
    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)
}

renderer.setAnimationLoop(tick)
