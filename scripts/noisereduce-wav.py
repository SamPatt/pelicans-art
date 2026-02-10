#!/usr/bin/env python3
"""
Spectral noise reduction for a single WAV file.
Called by the server voice processing pipeline.

Usage: python3 noisereduce-wav.py <input.wav> <output.wav>

Applies:
  - High-pass filter at 80Hz (room rumble)
  - Stationary spectral noise reduction at 60%
  - Peak normalization to -1dB
"""

import sys
import numpy as np
import soundfile as sf
import noisereduce as nr
from scipy.signal import butter, sosfilt


def butter_highpass(data, sr, cutoff=80, order=3):
    nyq = 0.5 * sr
    sos = butter(order, cutoff / nyq, btype='highpass', output='sos')
    return sosfilt(sos, data)


def normalize(data, target_db=-1.0):
    peak = np.max(np.abs(data))
    if peak == 0:
        return data
    target = 10 ** (target_db / 20.0)
    return data * (target / peak)


def main():
    if len(sys.argv) != 3:
        print("Usage: noisereduce-wav.py <input.wav> <output.wav>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    data, sr = sf.read(input_path)

    # Convert to mono if stereo
    if len(data.shape) > 1:
        data = np.mean(data, axis=1)

    # High-pass filter at 80Hz
    data = butter_highpass(data, sr)

    # Spectral noise reduction - single pass, moderate
    data = nr.reduce_noise(
        y=data,
        sr=sr,
        stationary=True,
        prop_decrease=0.6,
        n_fft=2048,
        freq_mask_smooth_hz=500,
    )

    # Normalize to -1dB peak
    data = normalize(data)
    data = np.clip(data, -1.0, 1.0)

    # Write output, preserving sample rate
    sf.write(output_path, data, sr, subtype='PCM_16')


if __name__ == "__main__":
    main()
