document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const form = document.getElementById('transcribe-form');
    const urlInput = document.getElementById('youtube-url');
    const transcribeBtn = document.getElementById('transcribe-btn');
    const videoContainer = document.getElementById('video-container');
    const videoWrapper = document.querySelector('.video-wrapper');
    const statusMessage = document.getElementById('status-message');
    const progressBar = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    const progressDetails = document.getElementById('progress-details');
    const progressContainer = document.getElementById('progress');
    const resultsContainer = document.getElementById('results-container');
    const transcriptionResult = document.getElementById('transcription-result');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const buttonText = document.querySelector('.button-text');
    const spinner = document.querySelector('.spinner');
    const sourceBadge = document.getElementById('source-badge');
    const exampleLinks = document.querySelectorAll('.example-link');

    // State
    let currentVideoId = null;
    let progressInterval;
    let currentTranscript = '';

    // Event Listeners
    form.addEventListener('submit', handleFormSubmit);
    copyBtn.addEventListener('click', copyToClipboard);
    downloadBtn.addEventListener('click', downloadTranscript);
    exampleLinks.forEach(link => {
        link.addEventListener('click', handleExampleClick);
    });

    // Main Functions
    async function handleFormSubmit(e) {
        e.preventDefault();
        resetUI();
        showLoading(true);
        
        const youtubeUrl = urlInput.value.trim();
        
        if (!isValidYouTubeUrl(youtubeUrl)) {
            showStatus('Please enter a valid YouTube URL', 'error');
            showLoading(false);
            return;
        }
        
        try {
            currentVideoId = extractVideoId(youtubeUrl);
            if (currentVideoId) {
                embedYouTubeVideo(currentVideoId);
            }
            
            startProgressTracking();
            const response = await fetch('/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtube_url: youtubeUrl })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Transcription failed');
            }
            
            if (data.status === 'success') {
                currentTranscript = data.transcription;
                showResults(data.transcription, data.source);
                showStatus(getSuccessMessage(data.source), 'success');
            }
        } catch (error) {
            handleTranscriptionError(error);
        } finally {
            stopProgressTracking();
            showLoading(false);
        }
    }

    function handleExampleClick(e) {
        e.preventDefault();
        const url = e.target.getAttribute('data-url');
        urlInput.value = url;
    }

    function copyToClipboard() {
        if (!currentTranscript) return;
        
        navigator.clipboard.writeText(currentTranscript)
            .then(() => {
                showTooltip(copyBtn, 'Copied!');
            })
            .catch(err => {
                showTooltip(copyBtn, 'Failed to copy');
                console.error('Failed to copy text: ', err);
            });
    }

    function downloadTranscript() {
        if (!currentTranscript) return;
        
        const blob = new Blob([currentTranscript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript_${currentVideoId || 'video'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showTooltip(downloadBtn, 'Downloaded!');
    }

    // UI Functions
    function showLoading(isLoading) {
        if (isLoading) {
            transcribeBtn.disabled = true;
            buttonText.textContent = 'Processing...';
            spinner.classList.remove('hidden');
        } else {
            transcribeBtn.disabled = false;
            buttonText.textContent = 'Transcribe';
            spinner.classList.add('hidden');
        }
    }

    function startProgressTracking() {
        let progress = 0;
        progressContainer.classList.remove('hidden');
        updateProgress(0, 'Starting transcription process...');
        
        progressInterval = setInterval(() => {
            progress = Math.min(progress + Math.random() * 5, 90);
            updateProgress(progress, getRandomProgressMessage());
        }, 1000);
    }

    function stopProgressTracking() {
        clearInterval(progressInterval);
        updateProgress(100, 'Finishing up...');
        setTimeout(() => {
            progressContainer.classList.add('hidden');
        }, 1000);
    }

    function updateProgress(percent, message) {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `Processing... ${Math.round(percent)}%`;
        if (message) {
            progressDetails.textContent = message;
        }
    }

    function showResults(transcript, source) {
        transcriptionResult.textContent = transcript;
        resultsContainer.classList.remove('hidden');
        
        // Update source badge
        sourceBadge.textContent = source === 'captions' ? 'YouTube Captions' : 'Audio Transcription';
        sourceBadge.className = 'source-badge ' + (source === 'captions' ? 'captions' : 'audio');
        
        // Add quality note if from audio
        if (source === 'speech_recognition') {
            const qualityNote = document.createElement('div');
            qualityNote.className = 'quality-note';
            qualityNote.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <span>Audio transcription may contain minor inaccuracies. Videos with captions provide perfect transcripts.</span>
            `;
            resultsContainer.appendChild(qualityNote);
        }
    }

    function showStatus(message, type) {
        statusMessage.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
        statusMessage.className = type;
        statusMessage.classList.remove('hidden');
    }

    function showTooltip(element, message) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = message;
        element.appendChild(tooltip);
        
        setTimeout(() => {
            tooltip.classList.add('visible');
            setTimeout(() => {
                tooltip.remove();
            }, 2000);
        }, 10);
    }

    function resetUI() {
        statusMessage.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        videoContainer.classList.add('hidden');
        videoWrapper.innerHTML = '';
        transcriptionResult.textContent = '';
        sourceBadge.className = 'source-badge';
        currentTranscript = '';
        
        // Remove any existing quality notes
        const qualityNote = document.querySelector('.quality-note');
        if (qualityNote) qualityNote.remove();
    }

    // Helper Functions
    function isValidYouTubeUrl(url) {
        const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
        return pattern.test(url);
    }

    function extractVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    function embedYouTubeVideo(videoId) {
        videoWrapper.innerHTML = `
            <iframe width="100%" height="100%" 
                    src="https://www.youtube.com/embed/${videoId}?enablejsapi=1" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
            </iframe>
        `;
        videoContainer.classList.remove('hidden');
    }

    function handleTranscriptionError(error) {
        console.error('Transcription error:', error);
        
        let errorMessage = error.message;
        const errorMap = {
            'Private video': 'This is a private video and cannot be accessed',
            'Age restricted': 'Age-restricted videos require login',
            'unavailable': 'Video is not available in your region',
            'API request failed': 'Speech recognition service unavailable',
            'Download failed': 'Could not download video content'
        };
        
        Object.keys(errorMap).forEach(key => {
            if (error.message.includes(key)) {
                errorMessage = errorMap[key];
            }
        });
        
        showStatus(`Error: ${errorMessage}`, 'error');
        
        // If we got partial results before error
        if (currentTranscript) {
            transcriptionResult.textContent = currentTranscript;
            resultsContainer.classList.remove('hidden');
            showStatus('Partial transcript generated (may be incomplete)', 'warning');
        }
    }

    function getSuccessMessage(source) {
        return source === 'captions' 
            ? 'Perfect transcript from YouTube captions' 
            : 'Transcript generated from audio';
    }

    function getRandomProgressMessage() {
        const messages = [
            'Downloading video content...',
            'Processing audio...',
            'Transcribing speech...',
            'Analyzing content...',
            'Finalizing transcript...'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }
});