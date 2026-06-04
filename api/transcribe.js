export default function handler(req, res) {
  res.status(501).json({ error: "not_supported", message: "Local Whisper transcription is not available on Vercel. Run the app locally for this feature." });
}
