# English to Khmer Live Translation

A real-time web application that translates spoken English to Khmer using OpenAI's Whisper for speech recognition and GPT-4 for translation.

## Features

- Real-time speech recognition using OpenAI's Whisper API
- High-quality translations using GPT-4
- WebSocket-based communication for low latency
- Modern, responsive UI with Chakra UI
- Clean audio processing with AudioWorklet
- Scrollable translation history
- Support for continuous recording and translation

## Prerequisites

- Node.js 16+ installed
- OpenAI API key with access to Whisper and GPT-4
- Modern browser with microphone access (Chrome recommended)
- npm or yarn package manager

## Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/english2khmer.git
cd english2khmer
```

2. Install dependencies:

```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

3. Configure environment variables:
   - Copy `server/.env.example` to `server/.env`
   - Add your OpenAI API key to `server/.env`:
     ```
     OPENAI_API_KEY=your_api_key_here
     ```

## Running the Application

1. Start the WebSocket server:

```bash
cd server
npm start
```

2. In a new terminal, start the frontend:

```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Grant microphone access when prompted
2. Click the "Start Recording" button to begin capturing audio
3. Speak clearly in English
4. Your speech will be transcribed and translated to Khmer in real-time
5. View the translation history in the scrollable area
6. Click "Stop Recording" when finished

## Technical Details

### Frontend Stack
- Next.js 13+ with App Router
- React 18+
- TypeScript
- Chakra UI for styling
- WebSocket client for real-time communication
- AudioWorklet for efficient audio processing

### Backend Stack
- Node.js
- WebSocket server (ws package)
- OpenAI API integration
  - Whisper API for speech recognition
  - GPT-4 API for translation

### Audio Processing
- 48kHz sample rate
- 16-bit PCM WAV format
- Single channel audio
- Noise suppression and echo cancellation
- Efficient chunked processing

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security Notes

- Never commit your `.env` file or expose your API keys
- Keep your dependencies updated
- Use environment variables for all sensitive information
- Regularly check for security vulnerabilities with `npm audit`

## Acknowledgments

- OpenAI for providing the Whisper and GPT-4 APIs
- The Chakra UI team for the excellent component library
- The WebSocket team for enabling real-time communication
