// Get Started: https://www.framer.com/developers

import { addPropertyControls, ControlType } from "framer"
import { useEffect, useRef, useState } from "react"

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function Halftone(props) {
    const {
        image,
        dotSize = 10,
        spacing = 20,
        angle = 45,
        dotColor = "#000000",
    } = props

    // Use image prop if provided, otherwise fallback to default
    const src = image || "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?w=800"

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const glRef = useRef<WebGLRenderingContext | null>(null)
    const programRef = useRef<WebGLProgram | null>(null)
    const textureRef = useRef<WebGLTexture | null>(null)
    const imageRef = useRef<HTMLImageElement | null>(null)
    const [imageLoaded, setImageLoaded] = useState(false)
    const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 })

    // Vertex shader - passes through position and UV coordinates
    const vertexShaderSource = `
        attribute vec2 position;
        varying vec2 uv;

        void main() {
            uv = position * 0.5 + 0.5;
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `

    // Fragment shader - basic monochrome halftone with circle dots
    const fragmentShaderSource = `
        precision mediump float;
        uniform sampler2D texture;
        uniform vec2 resolution;
        uniform float dotSize;
        uniform float spacing;
        uniform float angle;
        uniform vec3 dotColor;

        varying vec2 uv;

        #define PI 3.14159265359

        // Rotation matrix
        mat2 rotate2D(float a) {
            float s = sin(a);
            float c = cos(a);
            return mat2(c, -s, s, c);
        }

        // Get brightness from RGB
        float getBrightness(vec3 color) {
            return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
        }

        // Circle shape with anti-aliasing
        float circle(vec2 p, float radius) {
            float dist = length(p);
            return smoothstep(radius + 0.5, radius - 0.5, dist);
        }

        void main() {
            // Calculate grid coordinates
            vec2 coord = uv * resolution;

            // Apply rotation
            vec2 rotated = rotate2D(angle * PI / 180.0) * (coord - resolution * 0.5) + resolution * 0.5;

            // Grid cell position
            vec2 gridPos = mod(rotated, spacing);
            vec2 cellCenter = gridPos - spacing * 0.5;

            // Calculate world position of grid cell center
            vec2 gridCellWorldPos = rotated - cellCenter;

            // Rotate back to get UV coordinates for sampling
            vec2 unrotatedCellCenter = rotate2D(-angle * PI / 180.0) * (gridCellWorldPos - resolution * 0.5) + resolution * 0.5;
            vec2 sampleUV = unrotatedCellCenter / resolution;

            // Sample source image at cell center
            vec3 sourceColor = texture2D(texture, sampleUV).rgb;
            float brightness = getBrightness(sourceColor);

            // Calculate dot size based on brightness (darker = larger dots)
            float sizeFactor = 1.0 - brightness;
            float currentDotSize = dotSize * sizeFactor;

            // Generate circle shape
            float shape = circle(cellCenter, currentDotSize * 0.5);

            // Mix white background with colored dots
            vec3 backgroundColor = vec3(1.0, 1.0, 1.0);
            vec3 finalColor = mix(backgroundColor, dotColor, shape);

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `

    // Compile shader
    const compileShader = (
        gl: WebGLRenderingContext,
        source: string,
        type: number
    ): WebGLShader | null => {
        const shader = gl.createShader(type)
        if (!shader) return null

        gl.shaderSource(shader, source)
        gl.compileShader(shader)

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader compile error:", gl.getShaderInfoLog(shader))
            gl.deleteShader(shader)
            return null
        }

        return shader
    }

    // Create WebGL program
    const createProgram = (
        gl: WebGLRenderingContext,
        vertexShader: WebGLShader,
        fragmentShader: WebGLShader
    ): WebGLProgram | null => {
        const program = gl.createProgram()
        if (!program) return null

        gl.attachShader(program, vertexShader)
        gl.attachShader(program, fragmentShader)
        gl.linkProgram(program)

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Program link error:", gl.getProgramInfoLog(program))
            gl.deleteProgram(program)
            return null
        }

        return program
    }

    // Handle container resize
    useEffect(() => {
        if (!containerRef.current) return

        const updateSize = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect()
                setCanvasSize({ width: Math.floor(width), height: Math.floor(height) })
            }
        }

        // Initial size
        updateSize()

        // Watch for size changes
        const resizeObserver = new ResizeObserver(updateSize)
        resizeObserver.observe(containerRef.current)

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    // Initialize WebGL
    useEffect(() => {
        if (!canvasRef.current) return

        const canvas = canvasRef.current
        const gl = canvas.getContext("webgl", {
            preserveDrawingBuffer: true,
        })

        if (!gl) {
            console.error("WebGL not supported")
            return
        }

        glRef.current = gl

        // Compile shaders
        const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER)
        const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER)

        if (!vertexShader || !fragmentShader) {
            console.error("Failed to compile shaders")
            return
        }

        // Create program
        const program = createProgram(gl, vertexShader, fragmentShader)
        if (!program) {
            console.error("Failed to create program")
            return
        }

        programRef.current = program
        gl.useProgram(program)

        // Create fullscreen quad
        const positionBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

        // Set up position attribute
        const positionLocation = gl.getAttribLocation(program, "position")
        gl.enableVertexAttribArray(positionLocation)
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

        // Create texture
        const texture = gl.createTexture()
        textureRef.current = texture

        return () => {
            if (textureRef.current) {
                gl.deleteTexture(textureRef.current)
            }
            if (programRef.current) {
                gl.deleteProgram(programRef.current)
            }
        }
    }, [])

    // Load image
    useEffect(() => {
        if (!src) return

        const image = new Image()
        image.crossOrigin = "anonymous"

        image.onload = () => {
            imageRef.current = image
            setImageLoaded(true)
        }

        image.onerror = () => {
            console.error("Failed to load image:", src)
        }

        image.src = src
    }, [src])

    // Render effect
    useEffect(() => {
        if (!glRef.current || !programRef.current || !textureRef.current || !imageLoaded || !imageRef.current) {
            return
        }

        const gl = glRef.current
        const program = programRef.current
        const texture = textureRef.current
        const image = imageRef.current

        // Upload texture
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

        // Set uniforms
        const resolutionLocation = gl.getUniformLocation(program, "resolution")
        const dotSizeLocation = gl.getUniformLocation(program, "dotSize")
        const spacingLocation = gl.getUniformLocation(program, "spacing")
        const angleLocation = gl.getUniformLocation(program, "angle")
        const dotColorLocation = gl.getUniformLocation(program, "dotColor")
        const textureLocation = gl.getUniformLocation(program, "texture")

        gl.uniform2f(resolutionLocation, canvasSize.width, canvasSize.height)
        gl.uniform1f(dotSizeLocation, dotSize)
        gl.uniform1f(spacingLocation, spacing)
        gl.uniform1f(angleLocation, angle)

        // Parse hex color to RGB
        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
            return result
                ? {
                      r: parseInt(result[1], 16) / 255,
                      g: parseInt(result[2], 16) / 255,
                      b: parseInt(result[3], 16) / 255,
                  }
                : { r: 0, g: 0, b: 0 }
        }

        const color = hexToRgb(dotColor)
        gl.uniform3f(dotColorLocation, color.r, color.g, color.b)
        gl.uniform1i(textureLocation, 0)

        // Draw
        gl.viewport(0, 0, canvasSize.width, canvasSize.height)
        gl.clearColor(1, 1, 1, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }, [imageLoaded, dotSize, spacing, angle, dotColor, canvasSize])

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
            }}
        >
            <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                }}
            />
        </div>
    )
}

addPropertyControls(Halftone, {
    image: {
        type: ControlType.Image,
        title: "Image",
    },
    dotSize: {
        type: ControlType.Number,
        title: "Dot Size",
        min: 1,
        max: 50,
        defaultValue: 10,
        step: 1,
    },
    spacing: {
        type: ControlType.Number,
        title: "Spacing",
        min: 5,
        max: 100,
        defaultValue: 20,
        step: 1,
    },
    angle: {
        type: ControlType.Number,
        title: "Angle",
        min: 0,
        max: 360,
        defaultValue: 45,
        step: 1,
        unit: "°",
    },
    dotColor: {
        type: ControlType.Color,
        title: "Dot Color",
        defaultValue: "#000000",
    },
})
