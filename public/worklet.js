class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.chunks = [];
        this.processCount = 0;
        this.isRecording = false;
        this.port.onmessage = (event) => {
            if (event.data.command === 'startRecording') {
                console.log('Worklet: Starting recording');
                this.isRecording = true;
                this.chunks = [];
            } else if (event.data.command === 'stopRecording') {
                console.log('Worklet: Stopping recording');
                this.isRecording = false;
                // Send all accumulated chunks
                if (this.chunks.length > 0) {
                    this.sendChunks();
                }
            }
        };
        console.log('AudioProcessor initialized');
    }

    sendChunks() {
        try {
            // Calculate total length
            const totalLength = this.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            console.log('Processing audio chunks...', {
                numChunks: this.chunks.length,
                totalLength
            });

            // Concatenate all chunks into one array
            const audioData = new Float32Array(totalLength);
            let offset = 0;
            for (const chunk of this.chunks) {
                audioData.set(chunk, offset);
                offset += chunk.length;
            }

            // Convert Float32Array to Int16Array
            const int16Data = new Int16Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                const s = Math.max(-1, Math.min(1, audioData[i]));
                int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Send the complete audio data
            this.port.postMessage({
                audioData: int16Data,
                sampleRate: 48000
            });

            console.log('Sent complete audio data', {
                length: int16Data.length,
                sampleRate: 48000
            });

            // Clear the chunks
            this.chunks = [];
        } catch (error) {
            console.error('Error processing audio chunks:', error);
        }
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]?.[0];

        // Copy input to output to maintain audio chain
        if (input && outputs[0] && outputs[0][0]) {
            outputs[0][0].set(input);
        }

        if (this.isRecording && input && input.length > 0) {
            // Store a copy of the input data
            this.chunks.push(new Float32Array(input));
            
            // Log recording status periodically
            this.processCount++;
            if (this.processCount % 100 === 0) {
                console.log('Recording audio...', {
                    count: this.processCount,
                    totalChunks: this.chunks.length,
                    lastChunkSize: input.length,
                    hasAudioData: input.some(sample => sample !== 0)
                });
            }
        }

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor); 