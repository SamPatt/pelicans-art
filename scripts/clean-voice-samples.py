#!/usr/bin/env python3
"""
Aggressive voice sample cleaner for voice cloning.
Processes WAV files to remove background noise, room tone, and artifacts.

Pipeline:
1. Load & convert to mono
2. High-pass filter at 80Hz (room rumble)
3. Low-pass filter at 8kHz (hiss/artifacts)
4. Spectral noise reduction (noisereduce) - two passes, aggressive
5. Noise gate (silence anything below threshold)
6. Trim silence from head/tail
7. Normalize to -1dB peak
8. Export as 16-bit 44.1kHz mono WAV (standard for most TTS/cloning APIs)
"""

import os
import sys
import numpy as np
import soundfile as sf
import noisereduce as nr
from scipy.signal import butter, sosfilt

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
INPUT_DIR = os.path.join(PROJECT_ROOT, "src")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "voice-samples", "cleaned")


def butter_filter(data, sr, cutoff, btype, order=5):
    """Apply a Butterworth filter."""
    nyq = 0.5 * sr
    normal_cutoff = cutoff / nyq
    # Clamp to valid range
    normal_cutoff = min(normal_cutoff, 0.99)
    sos = butter(order, normal_cutoff, btype=btype, output='sos')
    return sosfilt(sos, data)


def noise_gate(data, sr, threshold_db=-40, attack_ms=5, release_ms=50):
    """Simple noise gate - silence anything below threshold."""
    threshold = 10 ** (threshold_db / 20.0)

    # Calculate envelope using RMS in short windows
    window_size = int(sr * 0.02)  # 20ms windows
    hop = window_size // 2

    envelope = np.zeros_like(data)
    for i in range(0, len(data) - window_size, hop):
        rms = np.sqrt(np.mean(data[i:i+window_size] ** 2))
        envelope[i:i+hop] = rms
    # Fill the last bit
    envelope[-(len(data) % hop or hop):] = envelope[-(hop+1)]

    # Smooth the gate with attack/release
    attack_samples = int(sr * attack_ms / 1000)
    release_samples = int(sr * release_ms / 1000)

    gate = (envelope > threshold).astype(float)

    # Smooth transitions
    smoothed = np.zeros_like(gate)
    smoothed[0] = gate[0]
    for i in range(1, len(gate)):
        if gate[i] > smoothed[i-1]:
            # Attack (opening)
            alpha = 1.0 / max(attack_samples, 1)
            smoothed[i] = smoothed[i-1] + alpha * (gate[i] - smoothed[i-1])
        else:
            # Release (closing)
            alpha = 1.0 / max(release_samples, 1)
            smoothed[i] = smoothed[i-1] + alpha * (gate[i] - smoothed[i-1])

    return data * smoothed


def trim_silence(data, sr, threshold_db=-35, pad_ms=50):
    """Trim leading and trailing silence, keeping a small pad."""
    threshold = 10 ** (threshold_db / 20.0)
    pad_samples = int(sr * pad_ms / 1000)

    # Find first sample above threshold
    window = int(sr * 0.01)  # 10ms window
    start = 0
    for i in range(0, len(data) - window, window):
        rms = np.sqrt(np.mean(data[i:i+window] ** 2))
        if rms > threshold:
            start = max(0, i - pad_samples)
            break

    # Find last sample above threshold
    end = len(data)
    for i in range(len(data) - window, 0, -window):
        rms = np.sqrt(np.mean(data[i:i+window] ** 2))
        if rms > threshold:
            end = min(len(data), i + window + pad_samples)
            break

    return data[start:end]


def normalize(data, target_db=-1.0):
    """Normalize peak to target dB."""
    peak = np.max(np.abs(data))
    if peak == 0:
        return data
    target = 10 ** (target_db / 20.0)
    return data * (target / peak)


def clean_voice(input_path, output_path):
    """Full cleaning pipeline for a single voice sample."""
    filename = os.path.basename(input_path)
    print(f"\n{'='*50}")
    print(f"Processing: {filename}")
    print(f"{'='*50}")

    # Load
    data, sr = sf.read(input_path)
    print(f"  Input: {sr}Hz, {data.shape}, {len(data)/sr:.1f}s")

    # Convert to mono if stereo
    if len(data.shape) > 1:
        data = np.mean(data, axis=1)
        print(f"  Converted to mono")

    # High-pass filter at 80Hz (remove room rumble)
    data = butter_filter(data, sr, 80, 'highpass', order=3)
    print(f"  High-pass filter: 80Hz")

    # Spectral noise reduction - single pass, moderate
    data = nr.reduce_noise(
        y=data,
        sr=sr,
        stationary=True,
        prop_decrease=0.6,
        n_fft=2048,
        freq_mask_smooth_hz=500,
    )
    print(f"  Noise reduction: stationary, 60% reduction")

    # Trim silence
    original_len = len(data)
    data = trim_silence(data, sr, threshold_db=-35, pad_ms=100)
    trimmed = (original_len - len(data)) / sr
    print(f"  Trimmed {trimmed:.2f}s of silence")

    # Normalize to -1dB peak
    data = normalize(data, target_db=-1.0)
    print(f"  Normalized to -1dB peak")

    # Resample to 44.1kHz if needed (standard for most cloning APIs)
    if sr != 44100:
        from scipy.signal import resample
        new_length = int(len(data) * 44100 / sr)
        data = resample(data, new_length)
        sr = 44100
        print(f"  Resampled to 44100Hz")

    # Clip to prevent any overs
    data = np.clip(data, -1.0, 1.0)

    # Write output
    sf.write(output_path, data, sr, subtype='PCM_16')

    duration = len(data) / sr
    print(f"  Output: {sr}Hz, mono, {duration:.1f}s")
    print(f"  Saved: {output_path}")

    return duration


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    wav_files = [f for f in os.listdir(INPUT_DIR) if f.endswith('.wav')]

    if not wav_files:
        print("No WAV files found in src/")
        sys.exit(1)

    print(f"Found {len(wav_files)} voice samples to clean")
    print(f"Output directory: {OUTPUT_DIR}")

    total_duration = 0
    for filename in sorted(wav_files):
        input_path = os.path.join(INPUT_DIR, filename)
        output_path = os.path.join(OUTPUT_DIR, filename)
        duration = clean_voice(input_path, output_path)
        total_duration += duration

    print(f"\n{'='*50}")
    print(f"Done! Cleaned {len(wav_files)} files ({total_duration:.1f}s total)")
    print(f"Output: {OUTPUT_DIR}/")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
