class AudioProcessor extends AudioWorkletProcessor {
  private chunks: Float32Array[] = [];

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    // Get the input data from the first input's first channel
    const input = inputs[0][0];
    if (input) {
      this.chunks.push(new Float32Array(input));
      
      // If we have enough data (about 1 second worth at 16kHz)
      if (this.chunks.length >= 16) {
        // Concatenate all chunks
        const audioData = new Float32Array(this.chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        this.chunks.forEach(chunk => {
          audioData.set(chunk, offset);
          offset += chunk.length;
        });

        // Send the data to the main thread
        this.port.postMessage({ audioData });
        
        // Clear the chunks
        this.chunks = [];
      }
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor); 