import * as THREE from 'three/webgpu'
import {
    color,
    convertToTexture, float,
    max,
    mix,
    int,
    mx_noise_float,
    nodeObject,
    sqrt, texture,
    TWO_PI,
    uv, vec2,
    vec3,
    vec4,
    viewportCoordinate,
    viewportSize, viewportUV
} from "three/tsl";
import { voronoi} from "./voronoi.js";
import textureNode from "three/src/nodes/accessors/TextureNode.js";

export class ShatterNode extends THREE.TempNode {
    static get type() {
        return 'ShatterNode'
    }

    constructor(textureNode, subdivision, seed, progress, thickness, _color, colorStrength, offsetStrength) {
        super('vec4');
        this.textureNode = textureNode
        this.subdivision = subdivision
        this.seed = seed
        this.progress = progress
        this.thickness = thickness
        this._color = _color
        this.colorStrength = colorStrength
        this.offsetStrength = offsetStrength
    }

    setup() {
        const viewportMaxSize = max(viewportSize.x, viewportSize.y)
        const voronoiUv = viewportCoordinate.div(viewportMaxSize)
        const voronoiColor = voronoi(voronoiUv, this.subdivision, this.seed)

        const cracksNoise = mx_noise_float(voronoiUv.mul(5)).remap(-1, 1, 0, 0.5)
        const cracks = voronoiColor.g.step(this.progress.sub(cracksNoise).mul(this.thickness))
        const cracksColor = this._color.mul(this.colorStrength)

        const goldenRatio = sqrt(5).add(1).div(2)
        const goldenAngle = goldenRatio.mul(TWO_PI)
        const angle = voronoiColor.a.mul(goldenAngle)
        const offset = vec2(angle.cos(), angle.sin()).mul(this.progress)
        const offsetUv = viewportUV.add(offset.mul(this.offsetStrength))

        return mix(cracksColor,
            texture(this.textureNode, offsetUv),
            cracks)
    }
}

export const shatter = (
    textureNode,
    subdivision = float(4),
    seed = int(0),
    progress = float(1),
    thickness = float(0.02),
    _color = color(0xff824d),
    colorStrength = float(3),
    offsetStrength = float(0.02)
    ) => new ShatterNode(
        convertToTexture(textureNode),
    nodeObject(subdivision),
    nodeObject(seed),
    nodeObject(progress),
    nodeObject(thickness),
    nodeObject(_color),
    nodeObject(colorStrength),
    nodeObject(offsetStrength)
    )