#!/usr/bin/env python3
"""
Generate simple PNG icons for the Session Capture extension
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create a simple icon with a key/lock symbol"""
    # Create a new image with a gradient background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw gradient background (purple to blue)
    for y in range(size):
        # Gradient from purple (102, 126, 234) to darker purple (118, 75, 162)
        r = int(102 + (118 - 102) * y / size)
        g = int(126 - (126 - 75) * y / size)
        b = int(234 - (234 - 162) * y / size)
        draw.rectangle([(0, y), (size, y+1)], fill=(r, g, b, 255))
    
    # Draw a simple key icon
    center_x = size // 2
    center_y = size // 2
    
    # Scale elements based on icon size
    scale = size / 128
    
    # Draw key shape (simplified)
    # Key handle (circle)
    circle_radius = int(20 * scale)
    circle_width = int(4 * scale)
    draw.ellipse(
        [center_x - circle_radius, center_y - circle_radius - int(10 * scale),
         center_x + circle_radius, center_y + circle_radius - int(10 * scale)],
        outline=(255, 255, 255, 255),
        width=circle_width
    )
    
    # Key shaft
    shaft_width = int(8 * scale)
    shaft_length = int(30 * scale)
    draw.rectangle(
        [center_x - shaft_width // 2, center_y - int(10 * scale),
         center_x + shaft_width // 2, center_y + shaft_length],
        fill=(255, 255, 255, 255)
    )
    
    # Key teeth
    teeth_width = int(4 * scale)
    teeth_positions = [
        center_y + shaft_length - int(10 * scale),
        center_y + shaft_length - int(5 * scale),
    ]
    for pos in teeth_positions:
        draw.rectangle(
            [center_x + shaft_width // 2, pos,
             center_x + shaft_width // 2 + teeth_width, pos + int(3 * scale)],
            fill=(255, 255, 255, 255)
        )
    
    # Add "S" letter in the center of the key handle (for Session)
    if size >= 48:  # Only add text for larger icons
        try:
            # Try to use a basic font, fall back to default if not available
            font_size = int(14 * scale)
            from PIL import ImageFont
            try:
                # Try Windows font
                font = ImageFont.truetype("arial.ttf", font_size)
            except:
                try:
                    # Try common fonts
                    font = ImageFont.truetype("Arial.ttf", font_size)
                except:
                    # Use default font
                    font = ImageFont.load_default()
            
            text = "S"
            # Get text bounding box
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            text_x = center_x - text_width // 2
            text_y = center_y - int(10 * scale) - text_height // 2
            draw.text((text_x, text_y), text, fill=(102, 126, 234, 255), font=font)
        except:
            pass  # Skip text if font loading fails
    
    # Save the image
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

def main():
    """Generate all required icon sizes"""
    icons = [
        (16, 'icon16.png'),
        (48, 'icon48.png'),
        (128, 'icon128.png')
    ]
    
    for size, filename in icons:
        create_icon(size, filename)
    
    print("\nAll icons generated successfully!")
    print("\nTo use the extension:")
    print("1. Open Chrome and go to chrome://extensions/")
    print("2. Enable 'Developer mode'")
    print("3. Click 'Load unpacked'")
    print("4. Select this folder")

if __name__ == "__main__":
    # Check if PIL is installed
    try:
        from PIL import Image, ImageDraw
        main()
    except ImportError:
        print("Pillow is not installed. Installing...")
        import subprocess
        subprocess.run(["pip", "install", "Pillow"])
        print("Pillow installed. Please run this script again.")