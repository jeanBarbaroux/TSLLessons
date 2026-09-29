import * as THREE from 'three/webgpu'
import {vec4} from "three/tsl";
import { voronoi} from "./voronoi.js";

export class ShatterNode extends THREE.TempNode {
    static get type() {
        return 'ShatterNode'
    }

    constructor(textureNode) {
        super('vec4');
        this.textureNode = textureNode
    }

    setup() {
        return this.textureNode
    }
}

export const shatter = (textureNode) => new ShatterNode(textureNode)