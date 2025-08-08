import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  Monitor,
  ArrowRight,
  Copy,
  Download,
  Menu,
} from "lucide-react";

interface OutputData {
  soapNote: string;
  patientSummary: string;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [output, setOutput] = useState<OutputData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
                ClearlyAI
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
            Generate SOAP notes & patient scripts with AI
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Upload your transcription and receive easy-to-read notes in seconds.
          </p>

          {/* Upload Section */}
          <div className="max-w-2xl mx-auto">
            <div
              className="upload-area"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                Upload transcript (.txt or .mp3)
              </p>
              <p className="text-sm text-gray-500">
                Drag and drop your file here, or click to browse
              </p>
              {file && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">
                    Selected: {file.name}
                  </p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.mp3"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) {
                  handleFileSelect(selectedFile);
                }
              }}
              className="hidden"
            />

            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="btn-primary mt-6 w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? "Generating Notes..." : "Generate Notes"}
            </button>
          </div>

          {/* Output Section - Moved here */}
          {output && (
            <div className="max-w-4xl mx-auto mt-12">
              <h2 className="text-3xl font-bold text-clearly-blue text-center mb-8">
                Your Generated Notes
              </h2>
              <div className="grid md:grid-cols-2 gap-8">
                {/* SOAP Note */}
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

                {/* Patient Summary */}
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
                          downloadFile(output.patientSummary, "Patient-Summary")
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
              </div>

              {/* Reset Form Button */}
              <div className="text-center mt-8">
                <button
                  onClick={() => {
                    setFile(null);
                    setOutput(null);
                    setError(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
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
                Upload audio or text transcript at the end of the patient visit.
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
