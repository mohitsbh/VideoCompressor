const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: true,
    progress: ({ ratio }) => {
        const percent = Math.round(ratio * 100);
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;
    }
});

// DOM elements
const elements = {
    fileInput: document.getElementById('fileInput'),
    dropZone: document.getElementById('dropZone'),
    previewContainer: document.getElementById('previewContainer'),
    videoPreview: document.getElementById('videoPreview'),
    videoInfo: document.getElementById('videoInfo'),
    compressBtn: document.getElementById('compressBtn'),
    crfSlider: document.getElementById('crf'),
    crfValue: document.getElementById('crfValue'),
    presetSelect: document.getElementById('preset'),
    progressContainer: document.getElementById('progressContainer'),
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    result: document.getElementById('result'),
    compressedVideo: document.getElementById('compressedVideo'),
    compressionInfo: document.getElementById('compressionInfo'),
    downloadBtn: document.getElementById('downloadBtn'),
    stats: document.getElementById('stats'),
    resolutionSelect: document.getElementById('resolution'),
    customResolutionGroup: document.getElementById('customResolutionGroup'),
    customWidth: document.getElementById('customWidth'),
    customHeight: document.getElementById('customHeight'),
    customResError: document.getElementById('customResError'),
    upscaleWarning: document.getElementById('upscaleWarning')
};

// Video metadata
let videoData = {
    file: null,
    originalSize: 0,
    width: 0,
    height: 0,
    duration: 0,
    aspectRatio: 0
};

// Initialize the app
function init() {
    setupEventListeners();
    updateCrfDisplay();
}

// Set up event listeners
function setupEventListeners() {
    // CRF slider
    elements.crfSlider.addEventListener('input', updateCrfDisplay);
    
    // File input
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleDrop);
    elements.dropZone.addEventListener('click', () => elements.fileInput.click());
    
    // Resolution selection
    elements.resolutionSelect.addEventListener('change', handleResolutionChange);
    
    // Custom resolution inputs
    elements.customWidth.addEventListener('input', validateCustomResolution);
    elements.customHeight.addEventListener('input', validateCustomResolution);
    
    // Compression button
    elements.compressBtn.addEventListener('click', compressVideo);
}

// Update CRF value display
function updateCrfDisplay() {
    elements.crfValue.textContent = elements.crfSlider.value;
}

// Handle file selection
function handleFileSelect(e) {
    if (e.target.files.length) {
        processVideoFile(e.target.files[0]);
    }
}

// Handle drag over
function handleDragOver(e) {
    e.preventDefault();
    elements.dropZone.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
    elements.dropZone.style.borderColor = '#2980b9';
}

// Handle drag leave
function handleDragLeave() {
    elements.dropZone.style.backgroundColor = '';
    elements.dropZone.style.borderColor = '#3498db';
}

// Handle drop
function handleDrop(e) {
    e.preventDefault();
    handleDragLeave();
    
    if (e.dataTransfer.files.length) {
        processVideoFile(e.dataTransfer.files[0]);
    }
}

// Process video file and extract metadata
function processVideoFile(file) {
    if (!file.type.startsWith('video/')) {
        alert('Please select a video file');
        return;
    }

    videoData.file = file;
    videoData.originalSize = file.size;
    
    const videoURL = URL.createObjectURL(file);
    elements.videoPreview.src = videoURL;
    elements.previewContainer.style.display = 'flex';
    
    // Extract video metadata when loaded
    elements.videoPreview.onloadedmetadata = () => {
        videoData.width = elements.videoPreview.videoWidth;
        videoData.height = elements.videoPreview.videoHeight;
        videoData.duration = elements.videoPreview.duration;
        videoData.aspectRatio = videoData.width / videoData.height;
        
        updateVideoInfo();
        elements.compressBtn.disabled = false;
    };
}

// Update video information display
function updateVideoInfo() {
    elements.videoInfo.innerHTML = `
        <p><strong>Original Video Info:</strong></p>
        <p>Resolution: ${videoData.width}×${videoData.height}</p>
        <p>Duration: ${formatTime(videoData.duration)}</p>
        <p>Size: ${formatFileSize(videoData.originalSize)}</p>
        <p>Aspect Ratio: ${videoData.aspectRatio.toFixed(2)}:1</p>
    `;
}

// Handle resolution selection change
function handleResolutionChange() {
    elements.customResolutionGroup.style.display = 
        elements.resolutionSelect.value === 'custom' ? 'flex' : 'none';
    
    // Check if selected resolution is larger than original
    if (elements.resolutionSelect.value !== 'original' && elements.resolutionSelect.value !== 'custom') {
        const [selectedWidth, selectedHeight] = elements.resolutionSelect.value.split('x').map(Number);
        elements.upscaleWarning.style.display = 
            (selectedWidth > videoData.width || selectedHeight > videoData.height) ? 'block' : 'none';
    } else {
        elements.upscaleWarning.style.display = 'none';
    }
}

// Validate custom resolution inputs
function validateCustomResolution() {
    const width = parseInt(elements.customWidth.value);
    const height = parseInt(elements.customHeight.value);
    
    if (isNaN(width) || isNaN(height) || width < 100 || height < 100) {
        elements.customResError.textContent = 'Please enter valid width and height (minimum 100)';
        elements.customResError.style.display = 'block';
        return false;
    }
    
    elements.customResError.style.display = 'none';
    return true;
}

// Compress video
async function compressVideo() {
    if (!videoData.file) return;
    
    // Validate custom resolution if selected
    if (elements.resolutionSelect.value === 'custom' && !validateCustomResolution()) {
        return;
    }
    
    elements.compressBtn.disabled = true;
    elements.progressContainer.style.display = 'block';
    elements.result.style.display = 'none';
    
    try {
        if (!ffmpeg.isLoaded()) {
            await ffmpeg.load();
        }
        
        const crf = elements.crfSlider.value;
        const preset = elements.presetSelect.value;
        let resolution = elements.resolutionSelect.value;
        let resolutionWarning = '';
        
        // Handle custom resolution
        if (resolution === 'custom') {
            const width = parseInt(elements.customWidth.value);
            const height = parseInt(elements.customHeight.value);
            resolution = `${width}x${height}`;
            
            if (width > videoData.width || height > videoData.height) {
                resolutionWarning = ' (Upscaled)';
            }
        } else if (resolution !== 'original') {
            const [selectedWidth, selectedHeight] = resolution.split('x').map(Number);
            if (selectedWidth > videoData.width || selectedHeight > videoData.height) {
                resolutionWarning = ' (Upscaled)';
            }
        }
        
        // Prepare FFmpeg command
        const command = [
            '-i', 'input.mp4',
            '-c:v', 'libx264',
            '-crf', crf,
            '-preset', preset,
            '-c:a', 'aac',
            '-b:a', '128k'
        ];
        
        // Add scale filter if not original resolution
        if (resolution !== 'original') {
            command.push('-vf', `scale=${resolution}`);
        }
        
        command.push('output.mp4');
        
        // Write the file to FFmpeg's file system
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoData.file));
        
        // Run the FFmpeg command
        await ffmpeg.run(...command);
        
        // Read the result
        const data = ffmpeg.FS('readFile', 'output.mp4');
        
        // Create a download URL
        const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });
        const compressedURL = URL.createObjectURL(compressedBlob);
        const compressedSize = compressedBlob.size;
        
        // Display the compressed video
        elements.compressedVideo.src = compressedURL;
        
        // Set up download link
        elements.downloadBtn.href = compressedURL;
        elements.downloadBtn.download = `compressed_${videoData.file.name.replace(/\.[^/.]+$/, '')}.mp4`;
        
        // Show compression stats
        const compressionRatio = ((videoData.originalSize - compressedSize) / videoData.originalSize * 100).toFixed(2);
        elements.stats.innerHTML = `
            <p><strong>Compression Results:</strong></p>
            <p>Original size: ${formatFileSize(videoData.originalSize)}</p>
            <p>Compressed size: ${formatFileSize(compressedSize)}</p>
            <p>Reduction: ${compressionRatio}%</p>
        `;
        
        // Extract compressed video info
        elements.compressedVideo.onloadedmetadata = () => {
            const compressedWidth = elements.compressedVideo.videoWidth;
            const compressedHeight = elements.compressedVideo.videoHeight;
            
            elements.compressionInfo.innerHTML = `
                <p><strong>Compressed Video Info:</strong></p>
                <p>Resolution: ${compressedWidth}×${compressedHeight}${resolutionWarning}</p>
                <p>Duration: ${formatTime(elements.compressedVideo.duration)}</p>
                <p>New Aspect Ratio: ${(compressedWidth / compressedHeight).toFixed(2)}:1</p>
            `;
        };
        
        // Show result
        elements.result.style.display = 'block';
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'An error occurred during compression. Please try again.');
    } finally {
        elements.compressBtn.disabled = false;
    }
}

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to format time (seconds to HH:MM:SS)
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    return [h, m > 9 ? m : (h ? '0' + m : m || '0'), s > 9 ? s : '0' + s]
        .filter(Boolean)
        .join(':');
}

// Initialize the application
init();
