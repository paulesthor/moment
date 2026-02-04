
// Image Compression Utility

/**
 * Compresses an image file to WebP format with strict size limits
 * @param {File} file - The image file to compress
 * @param {number} maxWidth - Maximum width (default 1200px)
 * @param {number} quality - Quality 0-1 (default 0.8)
 * @returns {Promise<Blob>} - Combined promise resolving to compressed Blob
 */
export async function compressImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP
                canvas.toBlob((blob) => {
                    if (blob) {
                        console.log(`Image compressed: ${(blob.size / 1024).toFixed(2)} KB`);
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas to Blob conversion failed'));
                    }
                }, 'image/webp', quality);
            };

            img.onerror = (err) => reject(err);
        };

        reader.onerror = (err) => reject(err);
    });
}
