import * as THREE from 'three/webgpu'
import { add, color, float, time, Fn, vec2, vec3, texture, uv, mix, frontFacing, positionLocal, min, max, uniformArray, instanceIndex, uniform } from 'three/tsl'
import gsap from 'gsap'


export default class Explosions {
    constructor(
        simplexTexture,
        max = 100,
        emissiveColorA = color(0xff1111),
        emissiveColorB = color(0x1111ff),
        emissiveStrength = float(20)
    ) {
        this.simplexTexture = simplexTexture
        this.max = max
        this.emissiveColorA = emissiveColorA
        this.emissiveColorB = emissiveColorB
        this.emissiveStrength = emissiveStrength

        this.index = 0
        this.count = 0
        this.startIndex = uniform(0, 'int')

        this.setBuffers()
        this.setGeometry()
        this.setMaterial()
        this.setMesh()
    }

    setBuffers() {
        this.positions = uniformArray([], 'vec3')
        this.radiuses = uniformArray([], 'float')
        this.progresses = uniformArray([], 'float')

        for (let i = 0; i < this.max; i++) {
            this.positions.array[i] = new THREE.Vector3()
            this.radiuses.array[i] = 1
            this.progresses.array[i] = 0
        }
    }

    setGeometry() {
        this.geometry = new THREE.SphereGeometry(1, 32, 32)
    }

    setMaterial() {
        this.material = new THREE.MeshBasicNodeMaterial({ color: 0x111111, side: THREE.DoubleSide })

        const arrayInstanceIndex = instanceIndex.add(this.startIndex).mod(this.max)
        const radius = this.radiuses.element(arrayInstanceIndex)
        const position = this.positions.element(arrayInstanceIndex)
        const progress = this.progresses.element(arrayInstanceIndex)

        this.material.maskNode = Fn(() => {
            const noise1Uv = uv().mul(vec2(1, 3))
            const noise1 = texture(this.simplexTexture, noise1Uv).r
            const noise2Uv = uv().mul(vec2(1, 5))
            const noise2 = texture(this.simplexTexture, noise2Uv).g
            const finalNoise = add(noise1, noise2).mul(0.5).pow(2)

            return finalNoise.sub(progress).greaterThan(0)
        })()

        this.material.emissiveNode = Fn(() => {
            const emissiveMix = progress.smoothstep(0, 0.7)
            const emissiveColor = mix(this.emissiveColorA, this.emissiveColorB, emissiveMix).toVertexStage()
            const backFacingMask = frontFacing.toFloat().oneMinus()
            const emissiveStrength = this.emissiveStrength

            return emissiveColor.mul(emissiveStrength).mul(backFacingMask)
        })()

        this.material.positionNode = Fn(() => {
            const radiusIn = progress.remap(0, 0.075)
            const radiusOut = progress.remap(0.075, 1, 1, 0.3)
            const radiusFinal = min(radiusIn, radiusOut).oneMinus().pow(2).oneMinus().mul(radius)
            positionLocal.mulAssign(radiusFinal)

            positionLocal.addAssign(position)

            positionLocal.y.assign(max(positionLocal.y, 0.01))

            return positionLocal
        })()
    }

    setMesh() {
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.mesh.castShadow = true
        this.mesh.count = 0
        this.mesh.visible = false
    }

    create(position = new THREE.Vector3(0, 0, 0), radius = 1) {

        const index = this.index
        this.positions.array[this.index].copy(position)
        this.radiuses.array[this.index] = radius
        this.progresses.array[this.index] = 0

        const dummy = { progress: 0 }
        gsap.to(dummy, {
            progress: 1,
            duration: 2,
            ease: 'linear',
            onUpdate: () => {
                this.progresses.array[index] = dummy.progress
            },
            onComplete: () => {
                this.count--
                this.mesh.count = Math.min(this.count, this.max)
                this.startIndex.value++

                if (this.mesh.count === 0)
                    this.mesh.visible = false
            }
        })

        this.index = (this.index + 1) % this.max
        this.count++
        this.mesh.count = Math.min(this.count, this.max)
        this.mesh.visible = true

    }
}