from flask import Flask, render_template, request, jsonify
import yt_dlp as youtube_dl
import speech_recognition as sr
from pydub import AudioSegment
import os
import tempfile
import time
import webvtt
from io import StringIO

app = Flask(__name__)

def get_youtube_captions(video_url):
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitlesformat': 'vtt',
        'subtitleslangs': ['en'],
        'quiet': True,
        'no_warnings': True,
    }

    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            with youtube_dl.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                
                if 'requested_subtitles' in info and info['requested_subtitles']:
                    caption_content = ""
                    for sub in info['requested_subtitles'].values():
                        if sub.get('ext') == 'vtt':
                            caption_url = sub['url']
                            caption_content = ydl.urlopen(caption_url).read().decode('utf-8')
                            break
                    
                    if caption_content:
                        captions = webvtt.read_buffer(StringIO(caption_content))
                        transcript_lines = []
                        prev_line = None
                        
                        for caption in captions:
                            # Remove extra whitespace and normalize
                            line = " ".join(caption.text.strip().split())
                            
                            # Skip if empty or same as previous line
                            if line and line != prev_line:
                                transcript_lines.append(line)
                                prev_line = line
                        
                        return "\n".join(transcript_lines)
        except Exception as e:
            print(f"Caption extraction error: {str(e)}")
        return None
def download_youtube_audio(url, temp_dir):
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '192',
        }],
        'outtmpl': os.path.join(temp_dir, 'audio.%(ext)s'),
        'quiet': False,
        'extractaudio': True,
        'audioformat': 'wav',
        'noplaylist': True,
        'audioquality': '0',
        'prefer_ffmpeg': True,
        'postprocessor_args': [
            '-ar', '44100',
            '-ac', '2',
            '-vol', '200',
            '-af', 'highpass=f=300,lowpass=f=3000'
        ],
    }
    
    try:
        with youtube_dl.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            return filename.replace('.webm', '.wav').replace('.m4a', '.wav')
    except Exception as e:
        raise Exception(f"Download failed: {str(e)}")

def transcribe_audio(audio_file):
    recognizer = sr.Recognizer()
    full_text = []
    prev_text = ""
    
    try:
        with sr.AudioFile(audio_file) as source:
            duration = source.DURATION
            chunk_size = 15  # 15-second chunks (non-overlapping)
            
            for i in range(0, int(duration), chunk_size):
                print(f"Processing chunk {i//chunk_size + 1}/{(int(duration)//chunk_size)+1}")
                
                with source as s:
                    recognizer.adjust_for_ambient_noise(s, duration=1)
                    chunk = recognizer.record(s, duration=chunk_size, offset=i)
                
                for attempt in range(3):
                    try:
                        text = recognizer.recognize_google(chunk, language="en-US")
                        if text != prev_text:  # Skip duplicates
                            full_text.append(text)
                            prev_text = text
                        time.sleep(1)
                        break
                    except sr.UnknownValueError:
                        if attempt == 2:
                            full_text.append(f"[unclear audio {i//60}m:{i%60}s]")
                        continue
                    except sr.RequestError:
                        if attempt == 2:
                            raise Exception("Speech recognition service unavailable")
                        time.sleep(2)
                        continue
                
        return " ".join(full_text)
    except Exception as e:
        raise Exception(f"Transcription error: {str(e)}")
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    data = request.json
    youtube_url = data.get('youtube_url')
    
    if not youtube_url:
        return jsonify({'error': 'No URL provided'}), 400
    
    try:
        # First try to get captions
        transcript = get_youtube_captions(youtube_url)
        if transcript:
            return jsonify({
                'transcription': transcript,
                'source': 'captions',
                'status': 'success'
            })
        
        # Fall back to audio transcription
        with tempfile.TemporaryDirectory() as temp_dir:
            audio_filename = download_youtube_audio(youtube_url, temp_dir)
            transcript = transcribe_audio(audio_filename)
            
            return jsonify({
                'transcription': transcript,
                'source': 'speech_recognition',
                'status': 'success'
            })
    
    except Exception as e:
        return jsonify({
            'error': str(e),
            'status': 'failed'
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)