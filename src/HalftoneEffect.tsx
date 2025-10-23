import React, { useEffect, useRef, useState } from "react"
import REGL from "regl"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { vertexShader, fragmentShader } from "./shaders/halftone"
import { DEFAULT_SETTINGS } from "./types"

export interface HalftoneEffectProps {
    // Media source
    src: string
    mediaType?: "image" | "video" | "auto"

    // Halftone settings
    dotSize?: number
    spacing?: number
    angle?: number
    dotColor?: string
    duotoneColor2?: string
    type?: "monochrome" | "duotone" | "sampled" | "cmyk"
    dotShape?: "circle" | "rectangle" | "line" | "custom"
    pattern?: "grid-regular" | "grid-alternating" | "grid-dither" | "radial-5" | "radial-7" | "radial-9"
    customShapeUrl?: string

    // Display settings
    width?: number
    height?: number
    objectFit?: "contain" | "cover" | "fill"

    // Video settings (when mediaType is video)
    autoPlay?: boolean
    loop?: boolean
    muted?: boolean
    controls?: boolean
}

/**
 * Halftone Effect Component
 *
 * Applies real-time halftone effects to images and videos using WebGL shaders.
 * All settings are editable via Framer Property Controls.
 */
export function HalftoneEffect(props: HalftoneEffectProps) {
    const {
        src,
        mediaType = "auto",
        dotSize = DEFAULT_SETTINGS.dotSize,
        spacing = DEFAULT_SETTINGS.spacing,
        angle = DEFAULT_SETTINGS.angle,
        dotColor = DEFAULT_SETTINGS.dotColor,
        duotoneColor2 = DEFAULT_SETTINGS.duotoneColor2,
        type = DEFAULT_SETTINGS.type,
        dotShape = DEFAULT_SETTINGS.dotShape,
        pattern = DEFAULT_SETTINGS.pattern,
        customShapeUrl,
        width = 600,
        height = 400,
        objectFit = "contain",
        autoPlay = true,
        loop = true,
        muted = true,
        controls = false,
    } = props

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null)
    const reglRef = useRef<REGL.Regl | null>(null)
    const textureRef = useRef<REGL.Texture2D | null>(null)
    const customShapeTextureRef = useRef<REGL.Texture2D | null>(null)
    const drawCommandRef = useRef<REGL.DrawCommand | null>(null)
    const animationFrameRef = useRef<number | null>(null)

    const [mediaLoaded, setMediaLoaded] = useState(false)
    const [actualMediaType, setActualMediaType] = useState<"image" | "video">("image")
    const [canvasSize, setCanvasSize] = useState({ width, height })

    // Detect media type from URL
    useEffect(() => {
        if (mediaType === "auto") {
            const videoExtensions = [".mp4", ".webm", ".ogg", ".mov"]
            const isVideo = videoExtensions.some((ext) => src.toLowerCase().includes(ext))
            setActualMediaType(isVideo ? "video" : "image")
        } else {
            setActualMediaType(mediaType)
        }
    }, [src, mediaType])

    // Initialize REGL
    useEffect(() => {
        if (!canvasRef.current) return

        const regl = REGL({
            canvas: canvasRef.current,
            attributes: { preserveDrawingBuffer: true },
        })
        reglRef.current = regl

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
            if (textureRef.current) {
                try {
                    textureRef.current.destroy()
                } catch (e) {}
            }
            if (customShapeTextureRef.current) {
                try {
                    customShapeTextureRef.current.destroy()
                } catch (e) {}
            }
            regl.destroy()
            reglRef.current = null
        }
    }, [])

    // Load media (image or video)
    useEffect(() => {
        if (!reglRef.current || !src) return

        setMediaLoaded(false)

        const regl = reglRef.current

        if (actualMediaType === "image") {
            const img = new Image()
            img.crossOrigin = "anonymous"

            img.onload = () => {
                if (!reglRef.current) return

                // Update canvas size based on image aspect ratio
                const aspectRatio = img.width / img.height
                updateCanvasSize(aspectRatio)

                // Clean up old texture
                if (textureRef.current) {
                    try {
                        textureRef.current.destroy()
                    } catch (e) {}
                    textureRef.current = null
                }

                // Create new texture
                const texture = regl.texture({
                    data: img,
                    flipY: true,
                })
                textureRef.current = texture

                // Create draw command if it doesn't exist
                if (!drawCommandRef.current) {
                    createDrawCommand(regl)
                }

                setMediaLoaded(true)
            }

            img.onerror = () => {
                console.error("Failed to load image:", src)
            }

            img.src = src
        } else {
            // Video
            const video = document.createElement("video")
            video.crossOrigin = "anonymous"
            video.autoplay = autoPlay
            video.loop = loop
            video.muted = muted
            video.playsInline = true

            video.onloadedmetadata = () => {
                if (!reglRef.current) return

                // Update canvas size based on video aspect ratio
                const aspectRatio = video.videoWidth / video.videoHeight
                updateCanvasSize(aspectRatio)

                // Create video texture
                const videoTexture = regl.texture({
                    width: video.videoWidth,
                    height: video.videoHeight,
                    min: "linear",
                    mag: "linear",
                })
                textureRef.current = videoTexture

                // Initial texture upload
                videoTexture({
                    data: video,
                    width: video.videoWidth,
                    height: video.videoHeight,
                })

                // Create draw command if it doesn't exist
                if (!drawCommandRef.current) {
                    createDrawCommand(regl)
                }

                setMediaLoaded(true)

                // Start animation loop for video
                startVideoRenderLoop(video, regl)
            }

            video.onerror = () => {
                console.error("Failed to load video:", src)
            }

            video.src = src
            mediaRef.current = video as any
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
                animationFrameRef.current = null
            }
        }
    }, [src, actualMediaType, autoPlay, loop, muted])

    // Update canvas size based on aspect ratio and objectFit
    const updateCanvasSize = (aspectRatio: number) => {
        let canvasW = width
        let canvasH = height

        if (objectFit === "contain") {
            const containerRatio = width / height
            if (aspectRatio > containerRatio) {
                canvasH = width / aspectRatio
            } else {
                canvasW = height * aspectRatio
            }
        } else if (objectFit === "cover") {
            const containerRatio = width / height
            if (aspectRatio > containerRatio) {
                canvasW = height * aspectRatio
            } else {
                canvasH = width / aspectRatio
            }
        }

        setCanvasSize({ width: Math.round(canvasW), height: Math.round(canvasH) })
    }

    // Create REGL draw command
    const createDrawCommand = (regl: REGL.Regl) => {
        const shapeMap: Record<string, number> = {
            circle: 0,
            rectangle: 1,
            line: 2,
            custom: 3,
        }

        const typeMap: Record<string, number> = {
            monochrome: 0,
            duotone: 1,
            sampled: 2,
            cmyk: 3,
        }

        const patternMap: Record<string, number> = {
            "grid-regular": 0,
            "grid-alternating": 1,
            "grid-dither": 2,
            "radial-5": 3,
            "radial-7": 4,
            "radial-9": 5,
        }

        drawCommandRef.current = regl({
            frag: fragmentShader,
            vert: vertexShader,
            attributes: {
                position: [
                    [-1, -1],
                    [1, -1],
                    [-1, 1],
                    [-1, 1],
                    [1, -1],
                    [1, 1],
                ],
            },
            uniforms: {
                texture: () => textureRef.current!,
                customShapeTexture: () => customShapeTextureRef.current || textureRef.current!,
                hasCustomShape: () => (customShapeTextureRef.current ? 1 : 0),
                resolution: () => [canvasSize.width, canvasSize.height],
                dotSize: regl.prop<any, "dotSize">("dotSize"),
                spacing: regl.prop<any, "spacing">("spacing"),
                angle: regl.prop<any, "angle">("angle"),
                dotColor: regl.prop<any, "dotColor">("dotColor"),
                duotoneColor2: regl.prop<any, "duotoneColor2">("duotoneColor2"),
                halftoneType: regl.prop<any, "halftoneType">("halftoneType"),
                dotShape: regl.prop<any, "dotShape">("dotShape"),
                pattern: regl.prop<any, "pattern">("pattern"),
            },
            count: 6,
        })
    }

    // Video render loop
    const startVideoRenderLoop = (video: HTMLVideoElement, regl: REGL.Regl) => {
        // Check if we're in a static context (canvas/export)
        const isStatic = RenderTarget.current() === RenderTarget.canvas || RenderTarget.current() === RenderTarget.export

        if (isStatic) {
            // Render one frame for canvas/export
            renderFrame(video)
            return
        }

        // Full animation loop for preview/live
        const render = () => {
            if (!reglRef.current || !textureRef.current || !drawCommandRef.current) {
                animationFrameRef.current = requestAnimationFrame(render)
                return
            }

            // Update video texture
            try {
                textureRef.current({
                    data: video,
                    width: video.videoWidth,
                    height: video.videoHeight,
                })
            } catch (error) {
                console.error("Error updating video texture:", error)
            }

            renderFrame(video)
            animationFrameRef.current = requestAnimationFrame(render)
        }

        render()
    }

    // Render a single frame
    const renderFrame = (media?: HTMLVideoElement | HTMLImageElement) => {
        if (!reglRef.current || !drawCommandRef.current || !textureRef.current) return

        const parseColor = (hex: string): [number, number, number] => {
            const r = parseInt(hex.slice(1, 3), 16) / 255
            const g = parseInt(hex.slice(3, 5), 16) / 255
            const b = parseInt(hex.slice(5, 7), 16) / 255
            return [r, g, b]
        }

        const shapeMap: Record<string, number> = {
            circle: 0,
            rectangle: 1,
            line: 2,
            custom: 3,
        }

        const typeMap: Record<string, number> = {
            monochrome: 0,
            duotone: 1,
            sampled: 2,
            cmyk: 3,
        }

        const patternMap: Record<string, number> = {
            "grid-regular": 0,
            "grid-alternating": 1,
            "grid-dither": 2,
            "radial-5": 3,
            "radial-7": 4,
            "radial-9": 5,
        }

        reglRef.current.clear({
            color: [1, 1, 1, 1],
            depth: 1,
        })

        drawCommandRef.current({
            dotSize,
            spacing,
            angle,
            dotColor: parseColor(dotColor),
            duotoneColor2: parseColor(duotoneColor2),
            halftoneType: typeMap[type] || 0,
            dotShape: shapeMap[dotShape] || 0,
            pattern: patternMap[pattern] || 0,
        })
    }

    // Load custom shape texture
    useEffect(() => {
        if (!reglRef.current || !customShapeUrl) {
            if (customShapeTextureRef.current) {
                try {
                    customShapeTextureRef.current.destroy()
                } catch (e) {}
                customShapeTextureRef.current = null
            }
            return
        }

        const regl = reglRef.current
        const img = new Image()
        img.crossOrigin = "anonymous"

        img.onload = () => {
            if (!reglRef.current) return

            if (customShapeTextureRef.current) {
                try {
                    customShapeTextureRef.current.destroy()
                } catch (e) {}
            }

            customShapeTextureRef.current = regl.texture({
                data: img,
                flipY: true,
            })
        }

        img.onerror = () => {
            console.error("Failed to load custom shape:", customShapeUrl)
        }

        img.src = customShapeUrl

        return () => {
            if (customShapeTextureRef.current) {
                try {
                    customShapeTextureRef.current.destroy()
                } catch (e) {}
                customShapeTextureRef.current = null
            }
        }
    }, [customShapeUrl])

    // Re-render when settings change
    useEffect(() => {
        if (mediaLoaded && actualMediaType === "image") {
            renderFrame()
        }
    }, [dotSize, spacing, angle, dotColor, duotoneColor2, type, dotShape, pattern, mediaLoaded])

    return (
        <div
            style={{
                width,
                height,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
            }}
        >
            <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit,
                }}
            />
        </div>
    )
}

// Framer Property Controls
addPropertyControls(HalftoneEffect, {
    src: {
        type: ControlType.String,
        title: "Media URL",
        placeholder: "https://example.com/image.jpg",
    },
    mediaType: {
        type: ControlType.Enum,
        title: "Media Type",
        options: ["auto", "image", "video"],
        optionTitles: ["Auto Detect", "Image", "Video"],
        defaultValue: "auto",
    },
    dotSize: {
        type: ControlType.Number,
        title: "Dot Size",
        min: 1,
        max: 50,
        step: 1,
        defaultValue: DEFAULT_SETTINGS.dotSize,
    },
    spacing: {
        type: ControlType.Number,
        title: "Spacing",
        min: 1,
        max: 100,
        step: 1,
        defaultValue: DEFAULT_SETTINGS.spacing,
    },
    angle: {
        type: ControlType.Number,
        title: "Angle",
        min: 0,
        max: 360,
        step: 1,
        defaultValue: DEFAULT_SETTINGS.angle,
        unit: "°",
    },
    type: {
        type: ControlType.Enum,
        title: "Type",
        options: ["monochrome", "duotone", "sampled", "cmyk"],
        optionTitles: ["Monochrome", "Duotone", "Sampled", "CMYK"],
        defaultValue: DEFAULT_SETTINGS.type,
    },
    dotColor: {
        type: ControlType.Color,
        title: "Dot Color",
        defaultValue: DEFAULT_SETTINGS.dotColor,
    },
    duotoneColor2: {
        type: ControlType.Color,
        title: "Duotone Color 2",
        defaultValue: DEFAULT_SETTINGS.duotoneColor2,
        hidden: (props) => props.type !== "duotone",
    },
    dotShape: {
        type: ControlType.Enum,
        title: "Dot Shape",
        options: ["circle", "rectangle", "line", "custom"],
        optionTitles: ["Circle", "Rectangle", "Line", "Custom Image"],
        defaultValue: DEFAULT_SETTINGS.dotShape,
    },
    customShapeUrl: {
        type: ControlType.String,
        title: "Custom Shape URL",
        placeholder: "https://example.com/shape.png",
        hidden: (props) => props.dotShape !== "custom",
    },
    pattern: {
        type: ControlType.Enum,
        title: "Pattern",
        options: ["grid-regular", "grid-alternating", "grid-dither", "radial-5", "radial-7", "radial-9"],
        optionTitles: ["Grid Regular", "Grid Alternating", "Grid Dither", "Radial 5", "Radial 7", "Radial 9"],
        defaultValue: DEFAULT_SETTINGS.pattern,
    },
    objectFit: {
        type: ControlType.Enum,
        title: "Object Fit",
        options: ["contain", "cover", "fill"],
        optionTitles: ["Contain", "Cover", "Fill"],
        defaultValue: "contain",
    },
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: true,
        hidden: (props) => props.mediaType !== "video" && !props.src?.match(/\.(mp4|webm|ogg|mov)$/i),
    },
    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        defaultValue: true,
        hidden: (props) => props.mediaType !== "video" && !props.src?.match(/\.(mp4|webm|ogg|mov)$/i),
    },
    muted: {
        type: ControlType.Boolean,
        title: "Muted",
        defaultValue: true,
        hidden: (props) => props.mediaType !== "video" && !props.src?.match(/\.(mp4|webm|ogg|mov)$/i),
    },
})
