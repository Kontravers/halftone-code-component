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
        type = "monochrome",
        duotoneColor2 = "#ff0000",
        dotShape = "circle",
        customShapeUrl,
        pattern = "grid-regular",
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

    // Fragment shader - halftone with multiple types
    const fragmentShaderSource = `
        precision mediump float;
        uniform sampler2D texture;
        uniform vec2 resolution;
        uniform float dotSize;
        uniform float spacing;
        uniform float angle;
        uniform vec3 dotColor;
        uniform vec3 duotoneColor2;
        uniform int halftoneType; // 0 = monochrome, 1 = duotone, 2 = sampled, 3 = cmyk
        uniform int dotShape; // 0 = circle, 1 = rectangle, 2 = line, 3 = custom
        uniform int pattern; // 0 = grid-regular, 1 = grid-alternating, 2 = grid-dither, 3-5 = radial

        varying vec2 uv;

        #define PI 3.14159265359

        // Rotation matrix
        mat2 rotate2D(float a) {
            float s = sin(a);
            float c = cos(a);
            return mat2(c, -s, s, c);
        }

        // Simple pseudo-random function
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
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

        // Rectangle shape with anti-aliasing
        float rectangle(vec2 p, float size) {
            vec2 d = abs(p) - vec2(size);
            float dist = max(d.x, d.y);
            return smoothstep(0.5, -0.5, dist);
        }

        // Line shape with anti-aliasing
        float line(vec2 p, float width) {
            float dist = abs(p.y);
            return smoothstep(width + 0.5, width - 0.5, dist);
        }

        void main() {
            // Calculate grid coordinates
            vec2 coord = uv * resolution;

            // Apply rotation
            vec2 rotated = rotate2D(angle * PI / 180.0) * (coord - resolution * 0.5) + resolution * 0.5;

            // Apply pattern offset
            vec2 patternOffset = vec2(0.0, 0.0);
            vec2 gridIndex = floor(rotated / spacing);

            if (pattern == 1) {
                // Grid Alternating: offset every other row by half spacing
                if (mod(gridIndex.y, 2.0) == 1.0) {
                    patternOffset.x = spacing * 0.5;
                }
            } else if (pattern == 2) {
                // Grid Dither: random offset for each cell
                vec2 randomOffset = vec2(
                    random(gridIndex) - 0.5,
                    random(gridIndex + vec2(1.0, 0.0)) - 0.5
                ) * spacing * 0.3; // 30% of spacing for subtle dithering
                patternOffset = randomOffset;
            } else if (pattern == 3 || pattern == 4 || pattern == 5) {
                // Radial patterns: rotate dots around center
                vec2 center = resolution * 0.5;
                vec2 toCenter = rotated - center;
                float dist = length(toCenter);
                float baseAngle = atan(toCenter.y, toCenter.x);

                float spokes = 5.0;
                if (pattern == 4) spokes = 7.0;
                if (pattern == 5) spokes = 9.0;

                // Create radial pattern by rotating based on distance
                float radialRotation = dist * spokes / resolution.x;

                // Add a slight spiral offset
                patternOffset = vec2(
                    cos(radialRotation) * spacing * 0.1,
                    sin(radialRotation) * spacing * 0.1
                );
            }

            // Grid cell position with pattern offset applied
            vec2 offsetRotated = rotated - patternOffset;
            vec2 gridPos = mod(offsetRotated, spacing);
            vec2 cellCenter = gridPos - spacing * 0.5;

            // Calculate world position of grid cell center
            vec2 gridCellWorldPos = offsetRotated - cellCenter;

            // Rotate back to get UV coordinates for sampling
            vec2 unrotatedCellCenter = rotate2D(-angle * PI / 180.0) * (gridCellWorldPos - resolution * 0.5) + resolution * 0.5;
            vec2 sampleUV = unrotatedCellCenter / resolution;

            // Sample source image at cell center
            vec3 sourceColor = texture2D(texture, sampleUV).rgb;
            float brightness = getBrightness(sourceColor);

            // Calculate dot size based on brightness (darker = larger dots)
            float sizeFactor = 1.0 - brightness;
            float currentDotSize = dotSize * sizeFactor;

            // Generate shape based on dotShape
            float shape = 0.0;
            if (dotShape == 0) {
                // Circle
                shape = circle(cellCenter, currentDotSize * 0.5);
            } else if (dotShape == 1) {
                // Rectangle
                shape = rectangle(cellCenter, currentDotSize * 0.5);
            } else if (dotShape == 2) {
                // Line
                shape = line(cellCenter, currentDotSize * 0.2);
            } else {
                // Custom - for now, default to circle
                shape = circle(cellCenter, currentDotSize * 0.5);
            }

            // Determine final color based on halftone type
            vec3 backgroundColor = vec3(1.0, 1.0, 1.0);
            vec3 finalColor = backgroundColor;

            if (halftoneType == 0) {
                // Monochrome: white background, single colored dots
                finalColor = mix(backgroundColor, dotColor, shape);
            } else if (halftoneType == 1) {
                // Duotone: interpolate dot color based on brightness
                // Small dots (bright areas) = color 1, Large dots (dark areas) = color 2
                vec3 interpolatedColor = mix(dotColor, duotoneColor2, sizeFactor);
                finalColor = mix(backgroundColor, interpolatedColor, shape);
            } else if (halftoneType == 2) {
                // Sampled: use the actual color from the source image
                // Dot size varies with brightness, but color comes from the image
                finalColor = mix(backgroundColor, sourceColor, shape);
            } else {
                // Default to monochrome for CMYK (not yet fully implemented)
                finalColor = mix(backgroundColor, dotColor, shape);
            }

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
        const duotoneColor2Location = gl.getUniformLocation(program, "duotoneColor2")
        const halftoneTypeLocation = gl.getUniformLocation(program, "halftoneType")
        const dotShapeLocation = gl.getUniformLocation(program, "dotShape")
        const patternLocation = gl.getUniformLocation(program, "pattern")
        const textureLocation = gl.getUniformLocation(program, "texture")

        gl.uniform2f(resolutionLocation, canvasSize.width, canvasSize.height)
        gl.uniform1f(dotSizeLocation, dotSize)
        gl.uniform1f(spacingLocation, spacing)
        gl.uniform1f(angleLocation, angle)

        // Convert type string to int
        const typeMap = { monochrome: 0, duotone: 1, sampled: 2, cmyk: 3 }
        gl.uniform1i(halftoneTypeLocation, typeMap[type] || 0)

        // Convert shape string to int
        const shapeMap = { circle: 0, rectangle: 1, line: 2, custom: 3 }
        gl.uniform1i(dotShapeLocation, shapeMap[dotShape] || 0)

        // Convert pattern string to int
        const patternMap = {
            "grid-regular": 0,
            "grid-alternating": 1,
            "grid-dither": 2,
            "radial-5": 3,
            "radial-7": 4,
            "radial-9": 5,
        }
        gl.uniform1i(patternLocation, patternMap[pattern] || 0)

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

        const color2 = hexToRgb(duotoneColor2)
        gl.uniform3f(duotoneColor2Location, color2.r, color2.g, color2.b)

        gl.uniform1i(textureLocation, 0)

        // Draw
        gl.viewport(0, 0, canvasSize.width, canvasSize.height)
        gl.clearColor(1, 1, 1, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }, [imageLoaded, dotSize, spacing, angle, dotColor, duotoneColor2, type, dotShape, pattern, canvasSize])

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
    type: {
        type: ControlType.Enum,
        title: "Type",
        options: ["monochrome", "duotone", "sampled", "cmyk"],
        optionTitles: ["Monochrome", "Duotone", "Sampled", "CMYK"],
        defaultValue: "monochrome",
    },
    dotShape: {
        type: ControlType.Enum,
        title: "Dot Shape",
        options: ["circle", "rectangle", "line", "custom"],
        optionTitles: ["Circle", "Rectangle", "Line", "Custom"],
        defaultValue: "circle",
    },
    customShapeUrl: {
        type: ControlType.String,
        title: "Custom Shape URL",
        hidden: (props) => props.dotShape !== "custom",
    },
    pattern: {
        type: ControlType.Enum,
        title: "Pattern",
        options: ["grid-regular", "grid-alternating", "grid-dither", "radial-5", "radial-7", "radial-9"],
        optionTitles: ["Grid Regular", "Grid Alternating", "Grid Dither", "Radial 5", "Radial 7", "Radial 9"],
        defaultValue: "grid-regular",
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
    duotoneColor2: {
        type: ControlType.Color,
        title: "Duotone Color 2",
        defaultValue: "#ff0000",
        hidden: (props) => props.type !== "duotone",
    },
})
