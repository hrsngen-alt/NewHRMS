import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bug, X, Camera, Mic, Paperclip, Monitor, Loader2, Send, Save, Undo, Square, Edit3, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { supabase } from "@/integrations/supabase/client";
import * as htmlToImage from "html-to-image";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "@/lib/utils";

const REPORT_TYPES = ["Bug", "UI Issue", "Performance Issue", "Feature Request", "Enhancement", "Data Issue", "Security Concern", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const CATEGORIES = ["Attendance", "Leave", "Payroll", "Recruitment", "Employee Profile", "HR Operations", "Reports", "Dashboard", "Settings", "Notifications", "Other"];

export function BugReportWidget() {
  const { user } = useAuth();
  const { myEmployee } = useMyEmployee();
  
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState("Bug");
  const [priority, setPriority] = useState("Medium");
  const [category, setCategory] = useState("Other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");

  // Media State
  const [attachments, setAttachments] = useState<File[]>([]);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  
  // Recording State
  const [isRecordingScreen, setIsRecordingScreen] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const screenChunksRef = useRef<BlobPart[]>([]);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Screenshot Canvas State
  const [isAnnotating, setIsAnnotating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<"draw"|"rect">("draw");
  const [history, setHistory] = useState<ImageData[]>([]);
  const startPos = useRef<{x: number, y: number} | null>(null);

  // System Info
  const [sysInfo, setSysInfo] = useState<any>({});

  useEffect(() => {
    if (isOpen) {
      setSysInfo({
        url: window.location.href,
        browser: navigator.userAgent,
        os: navigator.platform,
        resolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        timestamp: new Date().toISOString()
      });
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles = newFiles.filter(f => f.size <= 25 * 1024 * 1024);
      if (validFiles.length < newFiles.length) toast.warning("Some files exceeded the 25MB limit and were ignored.");
      setAttachments(prev => [...prev, ...validFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // ------------------------- SCREEN RECORDING -------------------------
  const startScreenRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const recorder = new MediaRecorder(stream);
      screenChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) screenChunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(screenChunksRef.current, { type: 'video/mp4' });
        setRecordingBlob(blob);
        setIsRecordingScreen(false);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingScreen(true);
      
      // Auto stop after 5 mins
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 5 * 60 * 1000);
      
    } catch (err) {
      toast.error("Could not start screen recording.");
    }
  };

  const stopScreenRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  // ------------------------- VOICE RECORDING -------------------------
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
        setIsRecordingAudio(false);
        stream.getTracks().forEach(t => t.stop());
      };

      audioRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
      
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 3 * 60 * 1000);
      
    } catch (err) {
      toast.error("Could not access microphone.");
    }
  };

  const stopVoiceRecording = () => {
    if (audioRecorderRef.current?.state === "recording") {
      audioRecorderRef.current.stop();
    }
  };

  // ------------------------- SCREENSHOT -------------------------
  const captureScreenshot = async () => {
    try {
      setIsOpen(false); // Hide widget before capture
      await new Promise(r => setTimeout(r, 300));
      
      const dataUrl = await htmlToImage.toPng(document.body, {
        filter: (node) => {
          if (node instanceof HTMLElement) {
             if (node.classList?.contains('leaflet-container') || node.tagName === 'IFRAME') return false;
          }
          return true;
        }
      });
      
      setScreenshotData(dataUrl);
      setIsOpen(true);
      setIsAnnotating(true);
      
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = img.width;
        bgCanvas.height = img.height;
        const ctx = bgCanvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
        setTimeout(() => initCanvas(bgCanvas), 100);
      };
      
    } catch (err: any) {
      console.error("Screenshot Error:", err);
      toast.error("Screenshot failed: " + (err?.message || "Unknown error"));
      setIsOpen(true);
    }
  };

  const initCanvas = (bgCanvas: HTMLCanvasElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Scale canvas to fit container while maintaining aspect ratio
    const containerWidth = canvas.parentElement?.clientWidth || 800;
    const scale = containerWidth / bgCanvas.width;
    
    canvas.width = bgCanvas.width;
    canvas.height = bgCanvas.height;
    canvas.style.width = `${bgCanvas.width * scale}px`;
    canvas.style.height = `${bgCanvas.height * scale}px`;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.drawImage(bgCanvas, 0, 0);
    ctxRef.current = ctx;
    
    setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
  };

  const getCanvasMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCanvasMousePos(e);
    startPos.current = { x, y };
    
    if (ctxRef.current && drawMode === "draw") {
      ctxRef.current.beginPath();
      ctxRef.current.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !ctxRef.current || !startPos.current || !canvasRef.current) return;
    e.preventDefault();
    const { x, y } = getCanvasMousePos(e);
    
    if (drawMode === "draw") {
      ctxRef.current.strokeStyle = "#ef4444";
      ctxRef.current.lineWidth = 4;
      ctxRef.current.lineTo(x, y);
      ctxRef.current.stroke();
    } else if (drawMode === "rect") {
      // Restore previous state and draw rect
      if (history.length > 0) {
        ctxRef.current.putImageData(history[history.length - 1], 0, 0);
      }
      ctxRef.current.strokeStyle = "#ef4444";
      ctxRef.current.lineWidth = 4;
      ctxRef.current.strokeRect(
        startPos.current.x, 
        startPos.current.y, 
        x - startPos.current.x, 
        y - startPos.current.y
      );
    }
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (ctxRef.current && canvasRef.current) {
      ctxRef.current.closePath();
      setHistory(prev => [...prev, ctxRef.current!.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height)]);
    }
  };

  const undoDraw = () => {
    if (history.length > 1 && ctxRef.current && canvasRef.current) {
      const newHistory = [...history];
      newHistory.pop(); // remove current state
      ctxRef.current.putImageData(newHistory[newHistory.length - 1], 0, 0);
      setHistory(newHistory);
    }
  };

  const saveAnnotation = () => {
    if (canvasRef.current) {
      setScreenshotData(canvasRef.current.toDataURL("image/png"));
    }
    setIsAnnotating(false);
  };

  // ------------------------- SUBMIT -------------------------
  const uploadFile = async (file: File | Blob, pathName: string): Promise<string | null> => {
    try {
      const ext = file instanceof File ? file.name.split('.').pop() : pathName.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage.from("bug_attachments").upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from("bug_attachments").getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) {
      console.error("Upload failed", err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myEmployee) return toast.error("User profile not found.");
    if (!title || !description) return toast.error("Title and Description are required.");
    
    setBusy(true);
    try {
      // 1. Upload files
      const uploadedUrls: any[] = [];
      
      for (const file of attachments) {
        const url = await uploadFile(file, file.name);
        if (url) uploadedUrls.push({ name: file.name, url, type: "file" });
      }

      if (screenshotData) {
        const blob = await (await fetch(screenshotData)).blob();
        const url = await uploadFile(blob, "screenshot.png");
        if (url) uploadedUrls.push({ name: "Screenshot", url, type: "image" });
      }

      if (recordingBlob) {
        const url = await uploadFile(recordingBlob, "recording.mp4");
        if (url) uploadedUrls.push({ name: "Screen Recording", url, type: "video" });
      }

      if (voiceBlob) {
        const url = await uploadFile(voiceBlob, "voicenote.webm");
        if (url) uploadedUrls.push({ name: "Voice Note", url, type: "audio" });
      }

      const ticketId = `BUG-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      const { error: insertError, data: bugRow } = await (supabase.from("bug_reports") as any).insert({
        ticket_id: ticketId,
        employee_id: myEmployee.id,
        report_type: type,
        priority: priority,
        category: category,
        title: title,
        description: description,
        steps_to_reproduce: steps,
        expected_result: expected,
        actual_result: actual,
        sys_url: sysInfo.url,
        sys_browser: sysInfo.browser,
        sys_os: sysInfo.os,
        sys_resolution: sysInfo.resolution,
        sys_timezone: sysInfo.timezone,
        sys_language: sysInfo.language,
        status: "New"
      }).select("id").single();

      if (insertError) throw insertError;

      // Insert files as an initial comment containing attachments
      if (uploadedUrls.length > 0 && bugRow) {
        await (supabase.from("bug_comments") as any).insert({
          bug_id: bugRow.id,
          employee_id: myEmployee.id,
          comment: "Attached initial bug report media and files.",
          attachments: uploadedUrls
        });
      }

      setSuccess(ticketId);
      
      // Reset
      setTitle(""); setDescription(""); setSteps(""); setExpected(""); setActual("");
      setAttachments([]); setScreenshotData(null); setRecordingBlob(null); setVoiceBlob(null);
      
    } catch (err: any) {
      toast.error(err.message || "Failed to submit bug report.");
    } finally {
      setBusy(false);
    }
  };

  const resetAndClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setSuccess(null);
    }, 500);
  };

  if (!myEmployee) return null;

  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center cursor-move"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button 
          onClick={() => !isAnnotating && setIsOpen(true)}
          className="size-14 rounded-full bg-slate-900 text-white shadow-2xl shadow-slate-900/40 hover:bg-slate-800 transition-colors flex items-center justify-center border-2 border-white/10"
          title="Report a Bug or Suggest Improvement"
        >
          <Bug className="size-6" />
        </Button>
      </motion.div>

      <AnimatePresence>
        {isOpen && !isAnnotating && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-32px)] sm:w-[450px] max-h-[80vh] bg-background border-2 shadow-2xl rounded-3xl z-50 overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 border-b bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-lg">Report an Issue</h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Feedback & Bug Tracking</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="rounded-full size-8">
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {success ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-10">
                  <div className="size-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-2">
                    <Bug className="size-8" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground">Ticket Submitted!</h3>
                  <p className="text-sm text-muted-foreground">Thank you. Your bug report has been successfully submitted to our engineering team.</p>
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-lg font-bold text-slate-700 dark:text-slate-300">
                    {success}
                  </div>
                  <Button onClick={resetAndClose} className="w-full rounded-xl mt-4">Close Window</Button>
                </div>
              ) : (
                <form id="bug-form" onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Report Type</Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="h-10 rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {REPORT_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Priority</Label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger className="h-10 rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {PRIORITIES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category Module</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-10 rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {CATEGORIES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Short Title</Label>
                    <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Unable to apply leave..." className="h-10 rounded-xl text-sm font-medium" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description Details</Label>
                    <Textarea required value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the issue in detail. What happened? What did you expect?" className="min-h-[100px] rounded-xl resize-none text-sm" />
                  </div>

                  {/* Media Tools */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Diagnostic Media</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant={screenshotData ? "default" : "outline"} className="rounded-lg h-9 gap-2 text-xs font-bold" onClick={captureScreenshot}>
                        <Camera className="size-3" /> {screenshotData ? "Retake Screenshot" : "Screenshot"}
                      </Button>
                      
                      <Button type="button" size="sm" variant={recordingBlob ? "default" : (isRecordingScreen ? "destructive" : "outline")} className={cn("rounded-lg h-9 gap-2 text-xs font-bold", isRecordingScreen && "animate-pulse")} onClick={isRecordingScreen ? stopScreenRecording : startScreenRecording}>
                        <Monitor className="size-3" /> {isRecordingScreen ? "Stop Recording" : recordingBlob ? "Retake Screen" : "Record Screen"}
                      </Button>

                      <Button type="button" size="sm" variant={voiceBlob ? "default" : (isRecordingAudio ? "destructive" : "outline")} className={cn("rounded-lg h-9 gap-2 text-xs font-bold", isRecordingAudio && "animate-pulse")} onClick={isRecordingAudio ? stopVoiceRecording : startVoiceRecording}>
                        <Mic className="size-3" /> {isRecordingAudio ? "Stop Voice" : voiceBlob ? "Retake Voice" : "Voice Note"}
                      </Button>
                      
                      <div className="relative">
                        <Input type="file" multiple onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <Button type="button" size="sm" variant={attachments.length > 0 ? "default" : "outline"} className="rounded-lg h-9 gap-2 text-xs font-bold w-full pointer-events-none">
                          <Paperclip className="size-3" /> {attachments.length > 0 ? `${attachments.length} Files` : "Attach Files"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Auto Collected Info */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-dashed text-[9px] font-mono text-muted-foreground space-y-1">
                    <p><strong className="uppercase">User:</strong> {myEmployee.full_name} ({myEmployee.employee_code})</p>
                    <p><strong className="uppercase">URL:</strong> {sysInfo.url}</p>
                    <p className="truncate"><strong className="uppercase">Browser:</strong> {sysInfo.browser}</p>
                  </div>

                </form>
              )}
            </div>

            {!success && (
              <div className="p-4 border-t bg-slate-50/50 dark:bg-slate-900/20 shrink-0">
                <Button form="bug-form" type="submit" disabled={busy} className="w-full h-12 rounded-xl font-black bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                  {busy ? <><Loader2 className="size-4 mr-2 animate-spin" /> Submitting Ticket...</> : <><Send className="size-4 mr-2" /> Submit Bug Report</>}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ANNOTATION OVERLAY */}
        {isOpen && isAnnotating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 flex flex-col p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 rounded-2xl p-3 sm:p-4 mb-4 border border-zinc-800 shadow-2xl text-zinc-100">
              <div className="flex items-center gap-1 sm:gap-2">
                <Button variant={drawMode === "draw" ? "default" : "ghost"} size="icon" onClick={() => setDrawMode("draw")} className="rounded-xl bg-zinc-800 hover:bg-zinc-700 size-9 sm:size-10">
                  <Edit3 className="size-4" />
                </Button>
                <Button variant={drawMode === "rect" ? "default" : "ghost"} size="icon" onClick={() => setDrawMode("rect")} className="rounded-xl bg-zinc-800 hover:bg-zinc-700 size-9 sm:size-10">
                  <Square className="size-4" />
                </Button>
                <div className="w-px h-6 bg-zinc-700 mx-1 sm:mx-2" />
                <Button variant="ghost" size="icon" onClick={undoDraw} disabled={history.length <= 1} className="rounded-xl text-zinc-400 hover:text-white size-9 sm:size-10">
                  <Undo className="size-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => { setIsAnnotating(false); setScreenshotData(null); }} className="rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 h-9 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm">
                  <Trash2 className="size-4 sm:mr-2" /> <span className="hidden sm:inline">Discard</span>
                </Button>
                <Button onClick={saveAnnotation} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm">
                  <Save className="size-4 mr-1 sm:mr-2" /> Save
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto rounded-2xl border-2 border-zinc-800 bg-zinc-950 flex items-center justify-center custom-scrollbar touch-none relative p-4">
              <canvas 
                ref={canvasRef}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
                className="cursor-crosshair shadow-2xl rounded max-w-full max-h-full object-contain touch-none"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
