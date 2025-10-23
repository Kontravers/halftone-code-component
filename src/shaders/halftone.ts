// Halftone WebGL Shaders

export const vertexShader = `
precision mediump float;
attribute vec2 position;
varying vec2 uv;

void main() {
    uv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0, 1);
}
`;

export const fragmentShader = `
precision mediump float;
uniform sampler2D texture;
uniform sampler2D customShapeTexture;
uniform int hasCustomShape;
uniform vec2 resolution;
uniform float dotSize;
uniform float spacing;
uniform float angle;
uniform vec3 dotColor;
uniform vec3 duotoneColor2;
uniform int halftoneType; // 0 = monochrome, 1 = duotone, 2 = sampled, 3 = cmyk
uniform int dotShape; // 0 = circle, 1 = rectangle, 2 = line, 3 = custom
uniform int pattern; // 0 = grid-regular, 1 = grid-alternating, etc.

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

// Circle shape - solid with anti-aliasing
float circle(vec2 p, float radius) {
    float dist = length(p);
    return smoothstep(radius + 0.5, radius - 0.5, dist);
}

// Rectangle shape - solid with anti-aliasing
float rectangle(vec2 p, float size) {
    vec2 d = abs(p) - vec2(size);
    float dist = max(d.x, d.y);
    return smoothstep(0.5, -0.5, dist);
}

// Line shape - solid with anti-aliasing
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
        float spokeAngle = mod(baseAngle + radialRotation, 2.0 * PI / spokes);

        // No offset needed - the rotation creates the pattern
        // But we can add a slight spiral offset
        patternOffset = vec2(
            cos(radialRotation) * spacing * 0.1,
            sin(radialRotation) * spacing * 0.1
        );
    }

    // Grid cell with pattern offset applied
    vec2 offsetRotated = rotated - patternOffset;
    vec2 gridPos = mod(offsetRotated, spacing);
    vec2 cellCenter = gridPos - spacing * 0.5;

    // Calculate the world position of the grid cell center
    vec2 gridCellWorldPos = offsetRotated - cellCenter;

    // Rotate back to get UV coordinates for sampling
    vec2 unrotatedCellCenter = rotate2D(-angle * PI / 180.0) * (gridCellWorldPos - resolution * 0.5) + resolution * 0.5;
    vec2 sampleUV = unrotatedCellCenter / resolution;

    // Sample the source image at the cell center
    vec3 sourceColor = texture2D(texture, sampleUV).rgb;
    float brightness = getBrightness(sourceColor);

    // Calculate dot size based on brightness (darker = larger dots)
    float sizeFactor = 1.0 - brightness;
    float currentDotSize = dotSize * sizeFactor;

    // Generate shape (returns 1.0 for inside shape, 0.0 for outside)
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
    }

    // Determine final color based on halftone type
    vec3 backgroundColor = vec3(1.0, 1.0, 1.0);
    vec3 finalColor = backgroundColor; // Initialize to background color

    if (dotShape == 3 && hasCustomShape == 1) {
        // Custom image: each dot IS the custom image, scaled by brightness
        // Map cell center position to UV coordinates (0-1) within the dot size
        vec2 imageUV = (cellCenter / currentDotSize) * 0.5 + 0.5;

        // Only render if we're within the scaled dot bounds
        if (imageUV.x >= 0.0 && imageUV.x <= 1.0 && imageUV.y >= 0.0 && imageUV.y <= 1.0) {
            // Sample the custom image at this position
            vec3 customColor = texture2D(customShapeTexture, imageUV).rgb;
            // Use the image's alpha channel if available, otherwise use full opacity
            float alpha = texture2D(customShapeTexture, imageUV).a;
            finalColor = mix(backgroundColor, customColor, alpha);
        }
    } else {
        // Standard halftone rendering
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
            // Default to monochrome for other types (not yet implemented)
            finalColor = mix(backgroundColor, dotColor, shape);
        }
    }

    gl_FragColor = vec4(finalColor, 1.0);
}
`;
