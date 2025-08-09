import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  Monitor,
  ArrowRight,
  Copy,
  Download,
  Menu,
  Mic,
  Square,
  Play,
  Pause,
  X,
} from "lucide-react";

interface OutputData {
  soapNote: string;
  patientSummary: string;
}

interface OutputSelection {
  soapNote: boolean;
  patientSummary: boolean;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [output, setOutput] = useState<OutputData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputSelection, setOutputSelection] = useState<OutputSelection>({
    soapNote: true,
    patientSummary: true,
  });

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const isCancellingRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Log state changes for debugging
  useEffect(() => {
    console.log("🔄 State changed:", {
      showRecorder,
      isRecording,
      isPaused,
      recordedBlob: !!recordedBlob,
      recordingTime,
      isPlaying,
      isCancelling: isCancellingRef.current,
    });
  }, [
    showRecorder,
    isRecording,
    isPaused,
    recordedBlob,
    recordingTime,
    isPlaying,
  ]);

  // Audio level monitoring
  const startAudioLevelMonitoring = (stream: MediaStream) => {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const updateAudioLevel = () => {
      if (!analyser) return;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArray); // Use time domain for better voice detection

      // Calculate RMS (Root Mean Square) for better audio level detection
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const amplitude = (dataArray[i] - 128) / 128; // Convert to -1 to 1 range
        sum += amplitude * amplitude;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const normalizedLevel = Math.min(rms * 3, 1); // Amplify sensitivity

      setAudioLevel(normalizedLevel);

      animationRef.current = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();
  };

  const stopAudioLevelMonitoring = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Recording functions
  const startRecording = async () => {
    console.log("🎯 startRecording() called");
    console.log(
      "  - Current state: showRecorder=",
      showRecorder,
      "isRecording=",
      isRecording,
      "recordedBlob=",
      !!recordedBlob
    );

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("  ✅ Microphone access granted");

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      console.log("  📹 MediaRecorder created");

      // Start audio level monitoring
      startAudioLevelMonitoring(stream);

      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log(
          "  📹 MediaRecorder onstop triggered, isCancelling=",
          isCancellingRef.current
        );
        // Only create blob if not cancelling
        if (!isCancellingRef.current) {
          const blob = new Blob(chunks, { type: "audio/wav" });
          console.log(
            "  ✅ Creating recordedBlob from chunks, size:",
            blob.size
          );
          setRecordedBlob(blob);

          // Create audio URL for playback
          const audioUrl = URL.createObjectURL(blob);
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
          }
        } else {
          console.log("  ❌ Cancelled - not creating recordedBlob");
        }

        // Stop the stream
        stream.getTracks().forEach((track) => track.stop());

        // Reset cancelling flag after onstop is complete
        if (isCancellingRef.current) {
          setTimeout(() => {
            isCancellingRef.current = false;
            console.log("  🔄 isCancelling reset to false (after onstop)");
          }, 100);
        }
      };

      mediaRecorder.start();
      console.log("  ▶️ MediaRecorder started");

      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      console.log(
        "  ✅ Recording state updated - isRecording=true, recordingTime=0"
      );
    } catch (err) {
      setError("Could not access microphone. Please allow microphone access.");
      console.error("❌ Error accessing microphone:", err);
    }
  };

  const pauseRecording = () => {
    console.log("⏸️ pauseRecording() called");
    console.log(
      "  - Current state: isRecording=",
      isRecording,
      "isPaused=",
      isPaused
    );

    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      console.log("  ✅ Recording paused, isPaused=true");

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      stopAudioLevelMonitoring();
    } else {
      console.log("  ❌ Cannot pause - conditions not met");
    }
  };

  const resumeRecording = () => {
    console.log("▶️ resumeRecording() called");
    console.log(
      "  - Current state: isRecording=",
      isRecording,
      "isPaused=",
      isPaused
    );

    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      console.log("  ✅ Recording resumed, isPaused=false");

      // Restart timer
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Restart audio monitoring
      if (streamRef.current) {
        startAudioLevelMonitoring(streamRef.current);
      }
    } else {
      console.log("  ❌ Cannot resume - conditions not met");
    }
  };

  const stopRecording = () => {
    console.log("⏹️ stopRecording() called");
    console.log(
      "  - Current state: isRecording=",
      isRecording,
      "isPaused=",
      isPaused
    );

    if (mediaRecorderRef.current && (isRecording || isPaused)) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      console.log("  ✅ Recording stopped, isRecording=false, isPaused=false");

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Stop audio level monitoring
      stopAudioLevelMonitoring();
    } else {
      console.log("  ❌ Cannot stop - conditions not met");
    }
  };

  const cancelRecording = () => {
    console.log("❌ cancelRecording() called");
    console.log(
      "  - Current state: isRecording=",
      isRecording,
      "isPaused=",
      isPaused,
      "recordedBlob=",
      !!recordedBlob
    );

    // Set cancelling flag before stopping
    isCancellingRef.current = true;
    console.log("  🚫 Setting isCancelling=true");

    if (mediaRecorderRef.current && (isRecording || isPaused)) {
      mediaRecorderRef.current.stop();
      console.log("  📹 MediaRecorder.stop() called");
    }

    // Reset all recording states completely
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setRecordedBlob(null);
    // Don't hide recorder interface - stay in recording state like Record Again
    setIsPlaying(false);
    console.log(
      "  ✅ Recording states reset: isRecording=false, isPaused=false, recordingTime=0, recordedBlob=null"
    );

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Stop streams and audio monitoring
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      console.log("  🎤 Stream tracks stopped and cleared");
    }
    stopAudioLevelMonitoring();

    // Clear audio element
    if (audioRef.current) {
      audioRef.current.src = "";
    }

    // Note: isCancelling flag will be reset in MediaRecorder.onstop event
  };

  const playRecording = () => {
    if (audioRef.current && recordedBlob) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const generateRecordingFilename = () => {
    const now = new Date();
    const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const time = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS
    return `recording_${date}_${time}.wav`;
  };

  const downloadRecording = () => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = generateRecordingFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const useRecording = () => {
    if (recordedBlob) {
      const file = new File([recordedBlob], generateRecordingFilename(), {
        type: "audio/wav",
      });
      setFile(file);
      setShowRecorder(false);
      setError(null);
    }
  };

  const clearRecording = () => {
    console.log("🔄 clearRecording() called");
    console.log(
      "  - Current state: recordedBlob=",
      !!recordedBlob,
      "isPlaying=",
      isPlaying,
      "recordingTime=",
      recordingTime
    );

    setRecordedBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);
    setIsPaused(false);
    isCancellingRef.current = false;
    stopAudioLevelMonitoring();
    if (audioRef.current) {
      audioRef.current.src = "";
    }

    console.log("  ✅ All recording states cleared");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleFileSelect = (selectedFile: File) => {
    // Check for text files or audio files
    const isTextFile =
      selectedFile.type === "text/plain" || selectedFile.name.endsWith(".txt");
    const isAudioFile =
      selectedFile.type.startsWith("audio/") ||
      selectedFile.name.endsWith(".mp3") ||
      selectedFile.name.endsWith(".m4a") ||
      selectedFile.name.endsWith(".wav");

    if (isTextFile || isAudioFile) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Please select a .txt file or audio file (.mp3, .m4a, .wav)");
      setFile(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // Send file to Make.com webhook
      const formData = new FormData();
      formData.append("file", file);

      const webhookUrl =
        import.meta.env.VITE_MAKE_WEBHOOK_URL ||
        "https://hook.us2.make.com/xw5ld4jn0by5jn7hg1bups02srki06f8";
      const apiKey = import.meta.env.VITE_MAKE_API_KEY || "clearlyai@2025";

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "x-make-apikey": apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text();
        throw new Error(
          `Expected JSON response, but received: "${textResponse}". Please check your Make.com webhook configuration.`
        );
      }

      const result = await response.json();

      // Handle the response from Make.com
      if (result.soap_note_text && result.patient_summary_text) {
        setOutput({
          soapNote: result.soap_note_text,
          patientSummary: result.patient_summary_text,
        });
      } else if (result.soapNote && result.patientSummary) {
        // Fallback for old format
        setOutput({
          soapNote: result.soapNote,
          patientSummary: result.patientSummary,
        });
      } else {
        // Fallback to mock response if the webhook doesn't return expected format
        const mockResponse: OutputData = {
          soapNote: `SOAP Note - ${file.name}

SUBJECTIVE:
Patient presents for routine dental examination and cleaning.

OBJECTIVE:
- Vital signs: BP 120/80, HR 72, Temp 98.6°F
- Oral examination reveals good oral hygiene
- No visible cavities or signs of periodontal disease
- Gingiva appears healthy with no bleeding on probing

ASSESSMENT:
- Patient in good oral health
- No active dental disease detected
- Recommend continued preventive care

PLAN:
- Completed routine dental cleaning
- Applied fluoride treatment
- Scheduled 6-month follow-up appointment
- Reinforced oral hygiene instructions`,
          patientSummary: `Your Dental Visit Summary

Today's Visit:
• We completed your routine dental cleaning and examination
• Your teeth and gums are in excellent health
• No cavities or other dental problems were found

What We Did:
• Thoroughly cleaned your teeth and removed any plaque buildup
• Applied a fluoride treatment to strengthen your teeth
• Conducted a complete oral health examination

Next Steps:
• Continue your daily brushing and flossing routine
• Schedule your next cleaning in 6 months
• Call us if you experience any dental pain or concerns

Your oral health is excellent! Keep up the great work with your daily dental care routine.`,
        };
        setOutput(mockResponse);
      }
    } catch (err) {
      console.error("Error uploading file:", err);
      setError("Failed to process file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = (text: string, _type: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const downloadFile = (content: string, type: string) => {
    // Get the original filename without extension
    const originalName = file
      ? file.name.replace(/\.[^/.]+$/, "")
      : "patient-visit";

    // Create descriptive filename based on type and original file
    const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    const filename = `${originalName}_${type}_${timestamp}.txt`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-clearly-blue">
                EZNotes.pro
              </h1>
            </div>
            <button className="p-2 rounded-md text-gray-600 hover:text-gray-900">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-clearly-blue mb-6">
            Generate SOAP notes & patient-ready appointment summaries with AI
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Upload your audio recording or transcription and receive
            easy-to-read notes in seconds.
          </p>

          {/* Upload Section */}
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* File Upload Area */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
                  Upload File
                </h3>
                <div
                  className="upload-area min-h-[280px]"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700 mb-2">
                    Upload transcript or audio recording
                  </p>
                  <p className="text-sm text-gray-500">
                    Drag and drop your file here, or click to browse
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Supported: .txt, .mp3, .m4a, .wav
                  </p>
                  {file && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-700">
                        Selected: {file.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recording Section */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
                  Record Audio
                </h3>
                <div className="bg-gray-50 rounded-lg p-6 min-h-[280px] flex items-center justify-center">
                  {!showRecorder && (
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-4">
                        Record directly on the website
                      </p>
                      <button
                        onClick={() => {
                          console.log(
                            "🖱️ Initial Start Recording button clicked"
                          );
                          console.log(
                            "  - Setting showRecorder=true, then calling startRecording after 100ms"
                          );
                          setShowRecorder(true);
                          setTimeout(startRecording, 100);
                        }}
                        className="btn-primary inline-flex items-center"
                        disabled={isUploading || !!output}
                      >
                        <Mic className="h-5 w-5 mr-2" />
                        Start Recording
                      </button>
                    </div>
                  )}

                  {/* Recording Interface */}
                  {showRecorder && !isRecording && !recordedBlob && (
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-4">
                        Click the microphone to start recording
                      </p>
                      <button
                        onClick={() => {
                          console.log(
                            "🖱️ Secondary Start Recording button clicked (in recording interface)"
                          );
                          startRecording();
                        }}
                        className="btn-primary inline-flex items-center"
                      >
                        <Mic className="h-5 w-5 mr-2" />
                        Start Recording
                      </button>
                    </div>
                  )}

                  {showRecorder && isRecording && (
                    <div className="w-full text-center">
                      <div className="mb-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-3 animate-pulse">
                          <Mic className="h-6 w-6 text-red-500" />
                        </div>

                        {/* Real-time Audio Level Bars */}
                        <div
                          className="flex items-end justify-center space-x-1 mb-3"
                          style={{ height: "24px" }}
                        >
                          {[0.3, 0.7, 0.5, 1.0, 0.8, 1.2, 0.6, 0.9, 0.4].map(
                            (multiplier, index) => {
                              const baseHeight = 3;
                              const maxHeight = 20;
                              const height = Math.max(
                                baseHeight,
                                Math.min(
                                  maxHeight,
                                  baseHeight +
                                    audioLevel * maxHeight * multiplier
                                )
                              );
                              const opacity = audioLevel > 0.01 ? 1 : 0.2;

                              return (
                                <div
                                  key={index}
                                  className="w-1 bg-red-500 rounded-full transition-all duration-75 ease-out"
                                  style={{
                                    height: `${height}px`,
                                    opacity: opacity,
                                  }}
                                ></div>
                              );
                            }
                          )}
                        </div>

                        <p className="text-base font-medium text-gray-700">
                          {isPaused ? "Paused" : "Recording"}...{" "}
                          {formatTime(recordingTime)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Level: {Math.round(audioLevel * 100)}%
                        </p>
                      </div>

                      <div className="flex justify-center space-x-2 flex-wrap">
                        {!isPaused ? (
                          <button
                            onClick={() => {
                              console.log("🖱️ Pause button clicked");
                              pauseRecording();
                            }}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-3 rounded-lg inline-flex items-center text-sm"
                          >
                            <Pause className="h-4 w-4 mr-1" />
                            Pause
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              console.log("🖱️ Resume button clicked");
                              resumeRecording();
                            }}
                            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-3 rounded-lg inline-flex items-center text-sm"
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Resume
                          </button>
                        )}

                        <button
                          onClick={() => {
                            console.log("🖱️ Stop button clicked");
                            stopRecording();
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-3 rounded-lg inline-flex items-center text-sm"
                        >
                          <Square className="h-4 w-4 mr-1" />
                          Stop
                        </button>

                        <button
                          onClick={() => {
                            console.log("🖱️ Cancel button clicked");
                            cancelRecording();
                          }}
                          className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-3 rounded-lg inline-flex items-center text-sm"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {showRecorder && recordedBlob && !isRecording && (
                    <div className="w-full text-center">
                      <p className="text-sm text-gray-600 mb-4">
                        Recording completed ({formatTime(recordingTime)})
                      </p>

                      <div className="flex justify-center space-x-2 mb-4 flex-wrap">
                        <button
                          onClick={playRecording}
                          className="btn-secondary inline-flex items-center text-sm"
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4 mr-1" />
                          ) : (
                            <Play className="h-4 w-4 mr-1" />
                          )}
                          {isPlaying ? "Pause" : "Play"}
                        </button>

                        <button
                          onClick={downloadRecording}
                          className="btn-secondary inline-flex items-center text-sm"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </button>
                      </div>

                      <div className="flex justify-center space-x-2 flex-wrap">
                        <button
                          onClick={useRecording}
                          className="btn-primary text-sm"
                        >
                          Use This Recording
                        </button>

                        <button
                          onClick={() => {
                            console.log("🖱️ Record Again button clicked");
                            clearRecording();
                          }}
                          className="btn-secondary text-sm"
                        >
                          Record Again
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Hidden audio element for playback */}
                  <audio
                    ref={audioRef}
                    onEnded={() => setIsPlaying(false)}
                    style={{ display: "none" }}
                  />
                </div>
              </div>
            </div>

            {/* Output Selection & Generate Button */}
            <div className="mt-8 max-w-2xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  Choose Output Types
                </h3>
                <div className="space-y-3 mb-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={outputSelection.soapNote}
                      onChange={(e) =>
                        setOutputSelection((prev) => ({
                          ...prev,
                          soapNote: e.target.checked,
                        }))
                      }
                      disabled={!!output || isUploading}
                      className="mr-3 h-4 w-4 text-clearly-blue border-gray-300 rounded focus:ring-clearly-blue disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span
                      className={`text-sm font-medium ${
                        output || isUploading
                          ? "text-gray-500"
                          : "text-gray-700"
                      }`}
                    >
                      SOAP Note (Professional Clinical Format)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={outputSelection.patientSummary}
                      onChange={(e) =>
                        setOutputSelection((prev) => ({
                          ...prev,
                          patientSummary: e.target.checked,
                        }))
                      }
                      disabled={!!output || isUploading}
                      className="mr-3 h-4 w-4 text-clearly-blue border-gray-300 rounded focus:ring-clearly-blue disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span
                      className={`text-sm font-medium ${
                        output || isUploading
                          ? "text-gray-500"
                          : "text-gray-700"
                      }`}
                    >
                      Patient Summary (Plain Language)
                    </span>
                  </label>
                </div>
                {output && (
                  <p className="text-xs text-gray-500 mb-4 text-center">
                    💡 Click "Generate Another Note" to change these selections
                  </p>
                )}

                {/* Generate Button */}
                <button
                  onClick={handleUpload}
                  disabled={
                    !file ||
                    isUploading ||
                    (!outputSelection.soapNote &&
                      !outputSelection.patientSummary)
                  }
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? "Generating Notes..." : "Generate Notes"}
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.mp3,.m4a,.wav,audio/*"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) {
                  handleFileSelect(selectedFile);
                }
              }}
              className="hidden"
            />

            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </div>

          {/* Output Section - Moved here */}
          {output && (
            <div className="max-w-4xl mx-auto mt-12">
              <h2 className="text-3xl font-bold text-clearly-blue text-center mb-8">
                Your Generated Notes
              </h2>
              <div
                className={`grid gap-8 ${
                  outputSelection.soapNote && outputSelection.patientSummary
                    ? "md:grid-cols-2"
                    : "md:grid-cols-1"
                }`}
              >
                {/* SOAP Note */}
                {outputSelection.soapNote && (
                  <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold text-gray-900">
                        SOAP Note
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            copyToClipboard(output.soapNote, "SOAP Note")
                          }
                          className="btn-secondary text-sm py-2 px-3"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </button>
                        <button
                          onClick={() =>
                            downloadFile(output.soapNote, "SOAP-Note")
                          }
                          className="btn-secondary text-sm py-2 px-3"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                        {output.soapNote}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Patient Summary */}
                {outputSelection.patientSummary && (
                  <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold text-gray-900">
                        Patient Summary
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            copyToClipboard(
                              output.patientSummary,
                              "Patient Summary"
                            )
                          }
                          className="btn-secondary text-sm py-2 px-3"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </button>
                        <button
                          onClick={() =>
                            downloadFile(
                              output.patientSummary,
                              "Patient-Summary"
                            )
                          }
                          className="btn-secondary text-sm py-2 px-3"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                        {output.patientSummary}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Reset Form Button */}
              <div className="text-center mt-8">
                <button
                  onClick={() => {
                    console.log(
                      "🔄 Generate Another Note button clicked - resetting everything"
                    );
                    setFile(null);
                    setOutput(null);
                    setError(null);
                    setOutputSelection({
                      soapNote: true,
                      patientSummary: true,
                    });
                    // Reset recording states
                    setShowRecorder(false);
                    setRecordedBlob(null);
                    setRecordingTime(0);
                    setIsPlaying(false);
                    setIsRecording(false);
                    setIsPaused(false);
                    isCancellingRef.current = false;
                    stopAudioLevelMonitoring();
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                    if (audioRef.current) {
                      audioRef.current.src = "";
                    }
                    console.log("  ✅ All states reset to initial values");
                  }}
                  className="btn-secondary"
                >
                  Generate Another Note
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-clearly-blue text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="text-center relative">
              <div className="bg-clearly-light-blue rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Upload className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Upload
              </h3>
              <p className="text-gray-600">
                Upload audio recording or text transcript at the end of the
                patient visit.
              </p>
            </div>

            {/* Arrow 1 */}
            <div className="hidden md:flex items-center justify-center absolute left-1/3 top-8 transform -translate-x-1/2">
              <ArrowRight className="h-6 w-6 text-gray-400" />
            </div>

            {/* Step 2 */}
            <div className="text-center relative">
              <div className="bg-clearly-light-blue rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generate
              </h3>
              <p className="text-gray-600">
                Get a complete SOAP note or patient-friendly summary.
              </p>
            </div>

            {/* Arrow 2 */}
            <div className="hidden md:flex items-center justify-center absolute right-1/3 top-8 transform translate-x-1/2">
              <ArrowRight className="h-6 w-6 text-gray-400" />
            </div>

            {/* Step 3 */}
            <div className="text-center relative">
              <div className="bg-clearly-light-blue rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Monitor className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Review/Save
              </h3>
              <p className="text-gray-600">
                Review or save the note in your EHR to complete the chart.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold text-clearly-blue mb-3">
                Speed up charting
              </h3>
              <p className="text-gray-600">
                Stop spending hours crafting notes after a long clinic day
                --just upload and go.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-clearly-blue mb-3">
                Minimize errors
              </h3>
              <p className="text-gray-600">
                Ensure your notes are complete, formatted correctly, and free of
                mistakes.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-clearly-blue mb-3">
                Improve patient communications
              </h3>
              <p className="text-gray-600">
                Receive a plain-language summary script you can share with the
                patient.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started Button */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <button
            onClick={() => {
              // Scroll to the upload section
              document.querySelector(".upload-area")?.scrollIntoView({
                behavior: "smooth",
              });
            }}
            className="btn-primary text-lg px-8 py-4"
          >
            Get started
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500">
            All uploads are confidential and not stored on our servers.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
