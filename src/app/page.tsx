'use client'

import { useState, useRef } from 'react'
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
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error)
            }
        },
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
                }
            }

            source.connect(workletNode)
            workletNode.connect(audioContextRef.current.destination)
            audioWorkletNodeRef.current = workletNode

            workletNode.port.postMessage({ command: 'startRecording' })
            setIsRecording(true)
        } catch (error) {
            console.error('Error starting recording:', error)
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
        <div className="px-6 py-24 sm:py-32 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
                <h1 className="text-4xl font-bold tracking-tight sm:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500 pb-2">
                    English to Khmer
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-300">
                    Speak in English and get real-time translations in Khmer
                </p>
            </div>

            <div className="mt-10 flex justify-center">
                <button
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    className={`
                        relative inline-flex items-center gap-x-2 rounded-full px-8 py-4 text-lg font-semibold 
                        shadow-sm transition-all duration-300 ease-in-out transform hover:scale-105
                        ${isRecording 
                            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                            : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600'
                        }
                    `}
                >
                    {isRecording ? (
                        <>
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-300"></span>
                            </span>
                            Stop Recording
                        </>
                    ) : (
                        <>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                            </svg>
                            Start Recording
                        </>
                    )}
                </button>
            </div>

            <div className="mt-10 mx-auto max-w-2xl">
                <div className="space-y-4 max-h-[60vh] overflow-y-auto rounded-2xl bg-white/5 p-4 backdrop-blur-lg ring-1 ring-white/10">
                    {translations.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <svg className="mx-auto h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                            </svg>
                            <p className="mt-4">Start speaking to see translations</p>
                        </div>
                    ) : (
                        translations.map((item, index) => (
                            <div
                                key={index}
                                className={`
                                    rounded-lg p-4 transition-all duration-300 ease-in-out
                                    ${index === translations.length - 1 
                                        ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 ring-1 ring-purple-500/20' 
                                        : 'bg-white/5'
                                    }
                                `}
                            >
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-xs font-medium text-gray-400">English</span>
                                        <p className="mt-1 text-sm text-gray-200">{item.english}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium text-gray-400">ខ្មែរ</span>
                                        <p className="mt-1 text-sm text-gray-200">{item.khmer}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
