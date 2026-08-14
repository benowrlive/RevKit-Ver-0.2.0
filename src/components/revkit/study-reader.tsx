"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  HardDrive,
  Loader2,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useReviewStore } from "@/lib/project/state";
import { getStudyPdf, saveStudyPdf, type StoredPdf } from "@/lib/pdf-library";
import type { Study } from "@/lib/types";
import { toast } from "sonner";

interface StudyReaderProps {
  study: Study;
  studies: Study[];
  onClose: () => void;
  onSelectStudy: (study: Study) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StudyReader({ study, studies, onClose, onSelectStudy }: StudyReaderProps) {
  const review = useReviewStore((state) => state.review);
  const updateStudy = useReviewStore((state) => state.updateStudy);
  const inputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const [storedPdf, setStoredPdf] = useState<StoredPdf | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notesOpen, setNotesOpen] = useState(true);
  const [notes, setNotes] = useState(study.notes ?? "");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const currentIndex = studies.findIndex((item) => item.id === study.id);
  const previousStudy = currentIndex > 0 ? studies[currentIndex - 1] : null;
  const nextStudy = currentIndex >= 0 && currentIndex < studies.length - 1 ? studies[currentIndex + 1] : null;

  useEffect(() => {
    setNotes(study.notes ?? "");
  }, [study.id, study.notes]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === readerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let nextUrl: string | null = null;
    setLoading(true);
    setLoadError("");
    setStoredPdf(null);
    setPdfUrl(null);

    if (!study.pdfPath) {
      setLoading(false);
      return;
    }

    getStudyPdf(study.pdfPath)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setLoadError("This PDF is not stored in this browser yet.");
          return;
        }
        nextUrl = URL.createObjectURL(record.blob);
        setStoredPdf(record);
        setPdfUrl(nextUrl);
      })
      .catch(() => {
        if (!cancelled) setLoadError("RevKit could not open this PDF.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [study.id, study.pdfPath, reloadToken]);

  async function attachPdf(file: File) {
    if (!review) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Choose a PDF file");
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      toast.error("That PDF is too large", { description: "Choose a file smaller than 250 MB." });
      return;
    }
    try {
      const record = await saveStudyPdf(review.id, study.id, file);
      updateStudy(study.id, { pdfPath: record.key });
      setReloadToken((value) => value + 1);
      toast.success(study.pdfPath ? "PDF replaced" : "PDF attached", { description: file.name });
    } catch (error) {
      toast.error("PDF could not be saved", {
        description: error instanceof Error ? error.message : "Browser storage is unavailable.",
      });
    }
  }

  function saveNotes() {
    const value = notes.trim();
    if (value !== (study.notes ?? "")) updateStudy(study.id, { notes: value || null });
  }

  async function toggleFullscreen() {
    if (!readerRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await readerRef.current.requestFullscreen();
  }

  return (
    <div ref={readerRef} className="study-reader-shell">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void attachPdf(file);
          event.target.value = "";
        }}
      />

      <header className="study-reader-toolbar">
        <div className="study-reader-title-group">
          <button type="button" className="reader-icon-button" onClick={onClose} title="Back to studies">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to studies</span>
          </button>
          <div className="reader-document-icon" aria-hidden="true">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0">
            <h2>{study.label}</h2>
            <p>
              {storedPdf ? `${storedPdf.fileName} · ${formatBytes(storedPdf.size)}` : "Full-text paper"}
            </p>
          </div>
        </div>

        <div className="study-reader-actions">
          <div className="reader-study-nav" aria-label="Move between studies">
            <button
              type="button"
              className="reader-icon-button"
              disabled={!previousStudy}
              onClick={() => previousStudy && onSelectStudy(previousStudy)}
              title="Previous study"
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Previous study</span>
            </button>
            <span>{currentIndex + 1} / {studies.length}</span>
            <button
              type="button"
              className="reader-icon-button"
              disabled={!nextStudy}
              onClick={() => nextStudy && onSelectStudy(nextStudy)}
              title="Next study"
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">Next study</span>
            </button>
          </div>
          <button
            type="button"
            className="reader-icon-button"
            onClick={() => inputRef.current?.click()}
            title={pdfUrl ? "Replace PDF" : "Attach PDF"}
          >
            <Upload className="size-4" />
            <span className="sr-only">{pdfUrl ? "Replace PDF" : "Attach PDF"}</span>
          </button>
          {pdfUrl && storedPdf && (
            <a className="reader-icon-button" href={pdfUrl} download={storedPdf.fileName} title="Download PDF">
              <Download className="size-4" />
              <span className="sr-only">Download PDF</span>
            </a>
          )}
          <button
            type="button"
            className="reader-icon-button"
            onClick={() => setNotesOpen((open) => !open)}
            title={notesOpen ? "Hide notes" : "Show notes"}
          >
            {notesOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
            <span className="sr-only">{notesOpen ? "Hide notes" : "Show notes"}</span>
          </button>
          <button type="button" className="reader-icon-button" onClick={() => void toggleFullscreen()} title="Fullscreen">
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            <span className="sr-only">Fullscreen</span>
          </button>
        </div>
      </header>

      <div className={`study-reader-body ${notesOpen ? "with-notes" : ""}`}>
        <main className="study-reader-document">
          {loading ? (
            <div className="reader-empty-state"><Loader2 className="size-6 animate-spin" /><span>Opening paper...</span></div>
          ) : pdfUrl ? (
            <object
              key={pdfUrl}
              data={`${pdfUrl}#toolbar=1&navpanes=0&view=FitH`}
              type="application/pdf"
              className="study-pdf-frame"
              aria-label={`PDF: ${study.label}`}
            >
              <div className="reader-empty-state">
                <AlertCircle className="size-6" />
                <span>This browser cannot display the PDF here.</span>
                {storedPdf && <Button asChild size="sm"><a href={pdfUrl} download={storedPdf.fileName}>Download PDF</a></Button>}
              </div>
            </object>
          ) : (
            <div className="reader-empty-state">
              {loadError ? <AlertCircle className="size-7 text-amber-500" /> : <HardDrive className="size-7" />}
              <div>
                <h3>{loadError || "Attach the full-text PDF"}</h3>
                <p>The paper stays on this device and opens inside RevKit.</p>
              </div>
              <Button size="sm" onClick={() => inputRef.current?.click()} className="bg-teal-600 text-white hover:bg-teal-700">
                <Upload className="size-4" />
                Choose PDF
              </Button>
            </div>
          )}
        </main>

        {notesOpen && (
          <aside className="study-reader-notes">
            <div className="reader-notes-heading">
              <div>
                <span>STUDY NOTES</span>
                <h3>Reading notes</h3>
              </div>
              <HardDrive className="size-4" aria-label="Saved with this review" />
            </div>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={saveNotes}
              placeholder="Write notes while you read..."
              className="reader-notes-input"
            />
            <div className="reader-study-details">
              <div><span>Authors</span><strong>{study.authors || "Not added"}</strong></div>
              <div><span>Year</span><strong>{study.year ?? "Not added"}</strong></div>
              <div><span>DOI</span><strong>{study.doi || "Not added"}</strong></div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
