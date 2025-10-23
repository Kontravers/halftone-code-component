export interface HalftoneSettings {
    dotSize: number
    spacing: number
    angle: number
    dotColor: string
    duotoneColor2: string
    type: "monochrome" | "duotone" | "sampled" | "cmyk"
    dotShape: "circle" | "rectangle" | "line" | "custom"
    pattern: "grid-regular" | "grid-alternating" | "grid-dither" | "radial-5" | "radial-7" | "radial-9"
    customShapeUrl?: string
}

export const DEFAULT_SETTINGS: HalftoneSettings = {
    dotSize: 10,
    spacing: 20,
    angle: 45,
    dotColor: "#000000",
    duotoneColor2: "#ff0000",
    type: "monochrome",
    dotShape: "circle",
    pattern: "grid-regular",
}
