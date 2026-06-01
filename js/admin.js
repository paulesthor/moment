import { supabase } from './config.js';
import { compressImage } from './image-utils.js';

// Export for auth.js
window.disableInlineEditing = null;

// Wait for Admin Mode to be enabled AND edit mode toggle
window.addEventListener('admin-mode-enabled', () => {
    // Only enable if edit mode is active
    if (document.body.classList.contains('edit-mode')) {
        enableInlineEditing();
        enableGenericImageDragAndDrop();
    }
});

// Listen for edit mode toggle
window.addEventListener('edit-mode-toggled', (e) => {
    const heroBtn = document.getElementById('hero-edit-btn');
    if (e.detail.active) {
        enableInlineEditing();
        enableGenericImageDragAndDrop();
        if (heroBtn) heroBtn.style.display = 'block';
    } else {
        disableInlineEditing();
        if (heroBtn) heroBtn.style.display = 'none';
    }
});

function enableInlineEditing() {
    // Select all elements that are editable (static content)
    const editableElements = document.querySelectorAll('[data-content-key]');

    editableElements.forEach(el => {
        el.setAttribute('contenteditable', 'true');
        el.classList.add('editable'); // For CSS styling

        // Save on focus out
        el.addEventListener('blur', async () => {
            const key = el.getAttribute('data-content-key');
            let newContent = el.innerHTML; // Use innerHTML to preserve line breaks if any, or innerText

            // Clean up some artifacts if needed
            newContent = newContent.trim();

            console.log(`Saving ${key}...`);

            // Save to Supabase
            const { error } = await supabase
                .from('static_content')
                .upsert({ key, content: newContent });

            if (error) {
                console.error('Error saving content:', error);
                alert('Erreur lors de la sauvegarde !');
                el.style.outline = '2px solid red';
            } else {
                console.log('Content saved:', key);
                el.style.outline = '2px solid green';
                setTimeout(() => el.style.outline = '', 1000);
            }
        });

        // Prevent enter key from creating divs, make it br or just blur
        el.addEventListener('keydown', (e) => {
            // Optional: handle enter key specific behaviors
        });
    });
}

function disableInlineEditing() {
    // Remove contenteditable from all elements
    const editableElements = document.querySelectorAll('[contenteditable="true"]');
    editableElements.forEach(el => {
        el.removeAttribute('contenteditable');
        el.classList.remove('editable');
    });
}

// Expose globally for auth.js
window.disableInlineEditing = disableInlineEditing;

function enableGenericImageDragAndDrop() {
    // Handle ANY image with data-image-key attribute
    const editableImages = document.querySelectorAll('img[data-image-key]');

    console.log(`Found ${editableImages.length} editable images with data-image-key`);

    // Existing functionality for standard images...

    // NEW: Handle Hero Backgrounds specifically
    const heroSection = document.querySelector('.hero');
    if (heroSection) {
        const heroBg = heroSection.querySelector('.hero-background[data-image-key]');
        if (heroBg) {
            // Create hidden input specific for hero
            let heroInput = document.getElementById('hero-file-input');
            if (!heroInput) {
                heroInput = document.createElement('input');
                heroInput.id = 'hero-file-input';
                heroInput.type = 'file';
                heroInput.accept = 'image/*';
                heroInput.style.display = 'none';
                heroSection.appendChild(heroInput);

                heroInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const imageKey = heroBg.getAttribute('data-image-key');
                        await handleGenericImageUpload(file, imageKey, heroBg);
                    }
                });
            }

            // Inject the visible button (will be toggled via CSS or JS based on edit mode)
            let editBtn = document.getElementById('hero-edit-btn');
            if (!editBtn) {
                editBtn = document.createElement('button');
                editBtn.id = 'hero-edit-btn';
                editBtn.innerHTML = '📷 Changer le fond';
                editBtn.style.position = 'absolute';
                editBtn.style.bottom = '20px';
                editBtn.style.right = '20px';
                editBtn.style.zIndex = '1000';
                editBtn.style.padding = '10px 20px';
                editBtn.style.background = 'white';
                editBtn.style.color = '#333';
                editBtn.style.border = 'none';
                editBtn.style.borderRadius = '30px';
                editBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                editBtn.style.fontWeight = 'bold';
                editBtn.style.cursor = 'pointer';
                editBtn.style.display = 'none'; // Hidden by default

                editBtn.onclick = () => heroInput.click();

                heroSection.appendChild(editBtn);
            }

            // Show/Hide based on Edit Mode
            if (document.body.classList.contains('edit-mode')) {
                editBtn.style.display = 'block';
            } else {
                editBtn.style.display = 'none';
            }
        }
    }

    editableImages.forEach(imgElement => {
        // ... (rest of the existing loop)
        imgElement.style.cursor = 'pointer'; // Changed to pointer to indicate clickability

        // Create a hidden file input for this image if it doesn't exist
        let fileInput = imgElement.nextElementSibling;
        if (!fileInput || !fileInput.classList.contains('admin-file-input')) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.className = 'admin-file-input';
            fileInput.style.display = 'none';
            imgElement.parentNode.insertBefore(fileInput, imgElement.nextSibling);

            // Handle file selection
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const imageKey = imgElement.getAttribute('data-image-key');
                    await handleGenericImageUpload(file, imageKey, imgElement);
                }
            });
        }

        // Prevent default link behavior and trigger file input
        const parentLink = imgElement.closest('a');

        imgElement.addEventListener('click', (e) => {
            if (document.body.classList.contains('edit-mode')) {
                e.preventDefault();
                e.stopPropagation();
                // Trigger the hidden file input
                fileInput.click();
            }
        });

        imgElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (document.body.classList.contains('edit-mode')) {
                imgElement.classList.add('drag-over');
            }
        });

        imgElement.addEventListener('dragleave', () => {
            imgElement.classList.remove('drag-over');
        });

        imgElement.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            imgElement.classList.remove('drag-over');

            if (!document.body.classList.contains('edit-mode')) return;

            const file = e.dataTransfer.files[0];
            if (!file || !file.type.startsWith('image/')) {
                alert('Veuillez déposer un fichier image');
                return;
            }

            const imageKey = imgElement.getAttribute('data-image-key');
            console.log(`Dropped image for key: ${imageKey}`);
            await handleGenericImageUpload(file, imageKey, imgElement);
        });
    });
}

async function handleGenericImageUpload(file, imageKey, imgElement) {
    try {
        // 1. Visual Feedback
        const originalSrc = imgElement.src;
        imgElement.style.opacity = '0.5';

        // 2. Compress Image
        const compressedBlob = await compressImage(file);
        const fileName = `${imageKey}_${Date.now()}.webp`;

        // 3. Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('images') // Ensure this bucket exists
            .upload(fileName, compressedBlob);

        if (uploadError) throw uploadError;

        // 4. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(fileName);

        // 5. Save URL in database
        const { error: dbError } = await supabase
            .from('static_content')
            .upsert({ key: imageKey, content: publicUrl });

        if (dbError) throw dbError;

        // 6. Update Image
        imgElement.src = publicUrl;
        imgElement.style.opacity = '1';
        console.log(`✅ Image uploaded: ${imageKey}`);

    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Erreur upload image: ' + error.message);
        imgElement.style.opacity = '1';
    }
}

// Load content on page load
async function loadDynamicContent() {
    // Select all dynamic images that need to be revealed
    const dynamicImages = document.querySelectorAll('img[data-image-key]');

    if (!supabase) {
        // Fallback if supabase not init: reveal all immediately
        dynamicImages.forEach(img => img.classList.add('loaded'));
        return;
    }

    const { data, error } = await supabase
        .from('static_content')
        .select('key, content');

    if (error) {
        console.warn('Error fetching content:', error.message);
        // On error, still reveal images so user sees defaults
        dynamicImages.forEach(img => img.classList.add('loaded'));
        return;
    }

    if (data) {
        // Create a map for faster lookup
        const dataMap = new Map(data.map(item => [item.key, item.content]));

        data.forEach(item => {
            // Update Text
            const textEl = document.querySelector(`[data-content-key="${item.key}"]`);
            if (textEl) textEl.innerHTML = item.content;
        });

        // Update Images and Reveal ALL dynamic images
        dynamicImages.forEach(img => {
            const key = img.getAttribute('data-image-key');
            if (dataMap.has(key)) {
                img.src = dataMap.get(key);

                // Wait for new image to actually load before revealing
                img.onload = () => {
                    img.classList.add('loaded');
                };

                // Handle case where image is cached/already loaded
                if (img.complete) {
                    img.classList.add('loaded');
                }
            } else {
                // No custom image found, reveal default immediately
                img.classList.add('loaded');
            }
        });
    } else {
        // No data at all, reveal defaults
        dynamicImages.forEach(img => img.classList.add('loaded'));
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', loadDynamicContent);
