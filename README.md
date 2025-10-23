# Halftone Effect - Framer Code Component

Real-time halftone effect for images and videos in Framer, powered by WebGL shaders.

## Features

- **Real-time GPU-accelerated rendering** using WebGL
- **Image and video support** with automatic media type detection
- **Multiple halftone types**: Monochrome, Duotone, Sampled, CMYK
- **Multiple dot shapes**: Circle, Rectangle, Line, Custom image
- **Multiple patterns**: Grid (regular, alternating, dither), Radial (5, 7, 9 spokes)
- **Fully customizable** via Framer Property Controls
- **Performance optimized** using RenderTarget API (static on canvas, animated in preview)
- **Aspect ratio preservation** with contain/cover/fill options

## Installation

### Option 1: NPM Package (Coming Soon)

```bash
npm install @ivanvukovic/halftone-effect
```

### Option 2: Manual Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to compile TypeScript
4. Copy the `dist` folder contents to your Framer project's `code` directory

## Usage

### Basic Usage

```tsx
import { HalftoneEffect } from "@ivanvukovic/halftone-effect"

export default function MyComponent() {
    return (
        <HalftoneEffect
            src="https://example.com/image.jpg"
            dotSize={10}
            spacing={20}
            angle={45}
            type="monochrome"
            dotColor="#000000"
        />
    )
}
```

### Video Usage

```tsx
import { HalftoneEffect } from "@ivanvukovic/halftone-effect"

export default function VideoHalftone() {
    return (
        <HalftoneEffect
            src="https://example.com/video.mp4"
            mediaType="video"
            type="duotone"
            dotColor="#ff0000"
            duotoneColor2="#0000ff"
            autoPlay={true}
            loop={true}
            muted={true}
        />
    )
}
```

## Property Controls

All settings are fully editable in Framer's property panel:

### Media Settings

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `src` | string | - | URL of the image or video |
| `mediaType` | enum | `"auto"` | Media type: `"auto"`, `"image"`, or `"video"` |
| `width` | number | `400` | Canvas width in pixels |
| `height` | number | `400` | Canvas height in pixels |
| `objectFit` | enum | `"contain"` | How media fits: `"contain"`, `"cover"`, or `"fill"` |

### Halftone Settings

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `dotSize` | number | `10` | Size of halftone dots (1-50) |
| `spacing` | number | `20` | Spacing between dots (1-100) |
| `angle` | number | `45` | Rotation angle in degrees (0-360) |
| `type` | enum | `"monochrome"` | Halftone type: `"monochrome"`, `"duotone"`, `"sampled"`, or `"cmyk"` |
| `dotColor` | color | `"#000000"` | Primary dot color |
| `duotoneColor2` | color | `"#ff0000"` | Secondary color (duotone only) |
| `dotShape` | enum | `"circle"` | Dot shape: `"circle"`, `"rectangle"`, `"line"`, or `"custom"` |
| `customShapeUrl` | string | - | URL for custom shape image (when dotShape is "custom") |
| `pattern` | enum | `"grid-regular"` | Pattern type: `"grid-regular"`, `"grid-alternating"`, `"grid-dither"`, `"radial-5"`, `"radial-7"`, or `"radial-9"` |

### Video-Specific Settings

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `autoPlay` | boolean | `true` | Auto-play video |
| `loop` | boolean | `false` | Loop video playback |
| `muted` | boolean | `false` | Mute video audio |
| `controls` | boolean | `false` | Show video controls |

## Halftone Types

### Monochrome
Single color dots on white background. Brightness controls dot size.

```tsx
<HalftoneEffect
    src="image.jpg"
    type="monochrome"
    dotColor="#000000"
/>
```

### Duotone
Two-color gradient based on brightness. Dark areas use `duotoneColor2`, bright areas use `dotColor`.

```tsx
<HalftoneEffect
    src="image.jpg"
    type="duotone"
    dotColor="#ff0000"
    duotoneColor2="#0000ff"
/>
```

### Sampled
Uses actual colors from source image. Dot size varies with brightness.

```tsx
<HalftoneEffect
    src="image.jpg"
    type="sampled"
/>
```

### CMYK
Four-color process printing simulation (coming soon).

## Dot Shapes

- **Circle**: Classic round halftone dots
- **Rectangle**: Square/rectangular dots
- **Line**: Horizontal line pattern
- **Custom**: Use any image as the dot shape via `customShapeUrl`

```tsx
<HalftoneEffect
    src="image.jpg"
    dotShape="custom"
    customShapeUrl="https://example.com/star.png"
/>
```

## Patterns

### Grid Patterns
- **grid-regular**: Standard uniform grid
- **grid-alternating**: Every other row offset by half spacing
- **grid-dither**: Random offset for organic look

### Radial Patterns
- **radial-5**: 5-spoke radial pattern
- **radial-7**: 7-spoke radial pattern
- **radial-9**: 9-spoke radial pattern

## Performance Optimization

The component uses Framer's `RenderTarget` API to optimize performance:

- **On Canvas/Export**: Renders as static image (single frame)
- **In Preview**: Full animation loop for videos

This ensures your published Framer sites remain performant while still allowing live preview during editing.

## Technical Details

### WebGL Rendering
Uses [REGL](https://github.com/regl-project/regl) for functional WebGL rendering with custom fragment shaders.

### Video Processing
Video frames are uploaded to GPU as textures and processed in real-time. The component handles:
- Automatic texture updates on each frame
- Proper cleanup on unmount
- CrossOrigin video loading

### Aspect Ratio Handling
The component automatically calculates and preserves aspect ratios based on source media dimensions and the selected `objectFit` mode.

## Browser Support

Requires WebGL support. Works in all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Watch mode for development
npm run dev
```

## File Structure

```
halftone-code-component/
├── src/
│   ├── HalftoneEffect.tsx    # Main component
│   ├── types.ts              # TypeScript interfaces
│   └── shaders/
│       └── halftone.ts       # WebGL shaders
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT

## Author

Ivan Vukovic

## Acknowledgments

Built with:
- [REGL](https://github.com/regl-project/regl) - Functional WebGL
- [Framer](https://www.framer.com/) - Design and prototyping platform
