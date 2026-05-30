# Image Integration Testing Playbook

## TEST AGENT PROMPT – IMAGE INTEGRATION RULES

Follow these rules exactly when testing image-related features.

## Image Handling Rules
- Always use base64-encoded images for all tests and requests.
- Accepted formats: JPEG, PNG, WEBP only.
- Do not use SVG, BMP, HEIC, or other formats.
- Do not upload blank, solid-color, or uniform-variance images.
- Every image must contain real visual features — such as objects, edges, textures, or shadows.
- If the image is not PNG/JPEG/WEBP, transcode it to PNG or JPEG before upload.
- Re-detect and update the MIME type after any transformation.
- If the image is animated (GIF, APNG, animated WEBP), extract the first frame only.
- Resize large images to reasonable bounds (avoid oversized payloads).

## Image Moderation Endpoint Tests
- Safe content (e.g., a stock photo of a person at a coffee shop) → `is_safe: true`
- Clearly explicit content → `is_safe: false` with reason
- Tests must be deterministic; use the same fixture image set across runs.
- Verify timeout behavior: if Gemini call takes >10s, request must fail open (allow upload, log warning).
