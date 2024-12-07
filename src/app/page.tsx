'use client'

import { useState, useRef } from 'react'
import { Box, Button, VStack, Text, useToast } from '@chakra-ui/react'
import useWebSocket from 'react-use-websocket'

function createWavHeader(sampleRate: number, bitsPerSample: number, channels: number, dataLength: number) {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    // "RIFF" chunk descriptor
    view.setUint8(0, 0x52); // R
    view.setUint8(1, 0x49); // I
    view.setUint8(2, 0x46); // F
    view.setUint8(3, 0x46); // F
    view.setUint32(4, 36 + dataLength, true);
    view.setUint8(8, 0x57); // W
    view.setUint8(9, 0x41); // A
    view.setUint8(10, 0x56); // V
    view.setUint8(11, 0x45); // E

    // "fmt " sub-chunk
    view.setUint8(12, 0x66); // f
    view.setUint8(13, 0x6d); // m
    view.setUint8(14, 0x74); // t
    view.setUint8(15, 0x20); // " "
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true); // byte rate
    view.setUint16(32, channels * (bitsPerSample / 8), true); // block align
    view.setUint16(34, bitsPerSample, true);

    // "data" sub-chunk
    view.setUint8(36, 0x64); // d
    view.setUint8(37, 0x61); // a
    view.setUint8(38, 0x74); // t
    view.setUint8(39, 0x61); // a
    view.setUint32(40, dataLength, true);

    return buffer;
}

export default function Home() {
    const [isRecording, setIsRecording] = useState(false)
    const [translations, setTranslations] = useState<Array<{ english: string; khmer: string }>>([])
    const audioContextRef = useRef<AudioContext | null>(null)
    const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const toast = useToast()

    const { sendMessage } = useWebSocket('ws://localhost:3001', {
        onMessage: (event) => {
            try {
                const data = JSON.parse(event.data)
                console.log('Received WebSocket message:', data)
                if (data.translation) {
                    setTranslations(prev => [...prev, {
                        english: data.text || '',
                        khmer: data.translation
                    }])
                } else if (data.type === 'error') {
                    console.error('Server error:', data.message)
                    toast({
                        title: 'Server Error',
                        description: data.message,
                        status: 'error',
                        duration: 5000,
                    })
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error)
            }
        },
        onError: (error) => {
            console.error('WebSocket error:', error)
            toast({
                title: 'Connection Error',
                description: 'Failed to connect to translation server',
                status: 'error',
                duration: 3000,
            })
        }
    })

    const handleStartRecording = async () => {
        try {
            if (!audioContextRef.current) {
                const audioContext = new AudioContext({
                    sampleRate: 48000,
                    latencyHint: 'interactive'
                })
                await audioContext.audioWorklet.addModule('/worklet.js')
                audioContextRef.current = audioContext
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 48000,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            })
            mediaStreamRef.current = stream

            const source = audioContextRef.current.createMediaStreamSource(stream)
            const workletNode = new AudioWorkletNode(audioContextRef.current, 'audio-processor')

            workletNode.port.onmessage = (event) => {
                if (event.data.audioData) {
                    try {
                        console.log('Received audio data from worklet:', {
                            length: event.data.audioData.length,
                            sampleRate: event.data.sampleRate
                        })

                        // Create WAV header
                        const wavHeader = createWavHeader(
                            event.data.sampleRate,
                            16, // bits per sample
                            1,  // channels
                            event.data.audioData.length * 2 // data length (2 bytes per sample)
                        )

                        // Combine header and audio data
                        const audioBuffer = new ArrayBuffer(event.data.audioData.length * 2)
                        const view = new DataView(audioBuffer)
                        for (let i = 0; i < event.data.audioData.length; i++) {
                            view.setInt16(i * 2, event.data.audioData[i], true)
                        }

                        const wavBlob = new Blob([wavHeader, audioBuffer], { type: 'audio/wav' })
                        const reader = new FileReader()
                        reader.onloadend = () => {
                            const base64data = (reader.result as string).split(',')[1]
                            sendMessage(JSON.stringify({
                                type: 'audio',
                                data: base64data,
                                format: 'wav'
                            }))
                        }
                        reader.readAsDataURL(wavBlob)

                    } catch (error) {
                        console.error('Error processing audio data:', error)
                        toast({
                            title: 'Error Processing Audio',
                            description: 'Failed to process audio data',
                            status: 'error',
                            duration: 3000,
                        })
                    }
                }
            }

            source.connect(workletNode)
            workletNode.connect(audioContextRef.current.destination)
            audioWorkletNodeRef.current = workletNode

            workletNode.port.postMessage({ command: 'startRecording' })
            setIsRecording(true)
        } catch (error) {
            console.error('Error starting recording:', error)
            toast({
                title: 'Error starting recording',
                status: 'error',
                duration: 3000,
            })
        }
    }

    const handleStopRecording = () => {
        if (audioWorkletNodeRef.current) {
            audioWorkletNodeRef.current.port.postMessage({ command: 'stopRecording' })
            audioWorkletNodeRef.current.disconnect()
            audioWorkletNodeRef.current = null
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop())
            mediaStreamRef.current = null
        }

        setIsRecording(false)
    }

    return (
        <Box p={8} maxW="800px" mx="auto" bg="gray.900" color="white">
            <Text fontSize="2xl" mb={4} textAlign="center">English to Khmer Live Translation</Text>
            
            <Box textAlign="center" mb={6}>
                <Button
                    colorScheme={isRecording ? "red" : "green"}
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    size="lg"
                    px={8}
                >
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Button>
            </Box>

            <VStack spacing={4} align="stretch" maxH="70vh" overflowY="auto">
                {translations.map((item, index) => (
                    <Box 
                        key={index} 
                        p={4} 
                        borderWidth="1px" 
                        borderRadius="md" 
                        bg="gray.800"
                        borderColor="gray.600"
                    >
                        <Text mb={2}><strong>English:</strong> {item.english}</Text>
                        <Text><strong>ខ្មែរ:</strong> {item.khmer}</Text>
                    </Box>
                ))}
            </VStack>
        </Box>
    )
}
