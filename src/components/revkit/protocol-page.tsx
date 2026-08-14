"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileQuestion,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { InfoTooltip } from "@/components/revkit/info-tooltip";
import { useReviewStore } from "@/lib/project/state";
import { newId } from "@/lib/project/id";
import type { DtaProtocolQuestion, ProsperoFieldId, ProtocolWorkspace } from "@/lib/types";
import {
  PROSPERO_FIELDS,
  PROSPERO_SECTION_LABELS,
  buildDtaQuestion,
  createProtocolWorkspace,
  createSepsisDtaTemplate,
  exportProsperoDraft,
  protocolCompletion,
  type ProsperoFieldDefinition,
  type ProtocolSectionId,
} from "@/lib/protocol/prospero";

const PROSPERO_URL = "https://www.crd.york.ac.uk/PROSPERO/";

export function ProtocolPage() {
  const review = useReviewStore((state) => state.review);
  const setProtocolWorkspace = useReviewStore((state) => state.setProtocolWorkspace);
  const updateMeta = useReviewStore((state) => state.updateMeta);

  const workspace = review?.protocol ?? null;
  const completion = useMemo(
    () => workspace ? protocolCompletion(workspace) : { complete: 0, total: 0, percent: 0 },
    [workspace],
  );

  if (!review) return null;

  function startProtocol() {
    setProtocolWorkspace(createProtocolWorkspace(review!));
  }

  function commit(next: ProtocolWorkspace) {
    setProtocolWorkspace({ ...next, updatedAt: new Date().toISOString() });
  }

  function updateAnswer(id: ProsperoFieldId, value: string) {
    if (!workspace) return;
    commit({ ...workspace, answers: { ...workspace.answers, [id]: value } });
  }

  function updateQuestions(nextQuestions: DtaProtocolQuestion[]) {
    if (!workspace) return;
    const populations = Array.from(new Set(nextQuestions.map((item) => item.population.trim()).filter(Boolean)));
    const references = Array.from(new Set(nextQuestions.map((item) => item.referenceStandard.trim()).filter(Boolean)));
    commit({
      ...workspace,
      dtaQuestions: nextQuestions,
      answers: {
        ...workspace.answers,
        populationIncluded: populations.join("; "),
        referenceStandards: references.join("; "),
      },
    });
  }

  function addQuestion() {
    if (!workspace) return;
    updateQuestions([
      ...workspace.dtaQuestions,
      { id: newId("pird"), population: "", referenceStandard: "", notes: "" },
    ]);
  }

  function patchQuestion(id: string, patch: Partial<DtaProtocolQuestion>) {
    if (!workspace) return;
    updateQuestions(workspace.dtaQuestions.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function deleteQuestion(id: string) {
    if (!workspace) return;
    updateQuestions(workspace.dtaQuestions.filter((item) => item.id !== id));
  }

  function loadSepsisTemplate() {
    if (!workspace) return;
    commit(createSepsisDtaTemplate(workspace));
    updateMeta({
      researchQuestion: "How accurately do clinical signs, clinical scores, and point-of-care tests diagnose sepsis across adult, pregnant, paediatric, and neonatal populations?",
    });
    toast.success("Sepsis DTA template loaded", { description: "Seven population/reference-standard questions added" });
  }

  function downloadDraft() {
    try {
      exportProsperoDraft(review!);
      toast.success("PROSPERO preparation draft downloaded", { description: "Word-compatible .doc" });
    } catch (error) {
      toast.error("Could not create the draft", { description: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  if (!workspace) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <section className="rounded-md border bg-card/55 p-6 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-md bg-teal-500/10 text-teal-600">
            <FileQuestion className="size-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Prepare the protocol</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Answer plain-language questions, map the review question, and download an editable PROSPERO preparation document.
          </p>
          <Button className="mt-5" onClick={startProtocol}><Plus className="size-4" />Start protocol builder</Button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Protocol & registration</h2>
            <Badge variant="secondary">{workspace.framework}</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Build the review question first, then prepare each registration section without leaving RevKit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {review.type === "DTA" && (
            <Button variant="outline" onClick={loadSepsisTemplate}>
              <Sparkles className="size-4" />Load sepsis DTA template
            </Button>
          )}
          <Button onClick={downloadDraft}><Download className="size-4" />Download draft</Button>
        </div>
      </header>

      <section className="grid gap-3 rounded-md border bg-card/45 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold">Registration readiness</span>
            <span className="font-mono text-muted-foreground">{completion.complete}/{completion.total} essentials</span>
          </div>
          <Progress value={completion.percent} className="mt-2 h-2" />
        </div>
        <a href={PROSPERO_URL} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted">
          Open PROSPERO <ExternalLink className="size-3.5" />
        </a>
      </section>

      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p>Use this as a working draft. PROSPERO currently directs non-intervention reviews to its intervention form while tailored forms are developed, so check the live fields and word limits before submission.</p>
      </div>

      <Tabs defaultValue="question">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="question" className="h-9 rounded-md border bg-card px-3 text-xs">Review question</TabsTrigger>
            {(Object.keys(PROSPERO_SECTION_LABELS) as ProtocolSectionId[]).map((section) => (
              <TabsTrigger key={section} value={section} className="h-9 rounded-md border bg-card px-3 text-xs">{PROSPERO_SECTION_LABELS[section]}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="question" className="space-y-4">
          <SectionHeading title={review.type === "DTA" ? "Build the PIRD questions" : "Build the PICO question"} description={review.type === "DTA" ? "Keep one parent review, then define each population and reference-standard analysis as a separate question." : "Define the population, intervention, comparator, and outcomes before completing the registration."} />

          <div className="grid gap-3 sm:grid-cols-2">
            <AnswerField field={fieldById("condition")} value={workspace.answers.condition ?? ""} onChange={(value) => updateAnswer("condition", value)} />
            <AnswerField field={fieldById("indexTests")} value={workspace.answers.indexTests ?? ""} onChange={(value) => updateAnswer("indexTests", value)} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5"><Label className="text-xs">Parent review question</Label><InfoTooltip title="Parent review question" what="The single umbrella question for this review." why="Population and reference-standard strata remain linked under one protocol." example="How accurately do clinical scores and point-of-care tests diagnose sepsis?" /></div>
            <Textarea value={review.researchQuestion ?? ""} onChange={(event) => updateMeta({ researchQuestion: event.target.value })} className="min-h-20 text-sm" />
          </div>

          {review.type === "DTA" && (
            <section className="space-y-3 border-t pt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div><h3 className="text-sm font-semibold">Planned analyses</h3><p className="mt-1 text-xs text-muted-foreground">One row becomes one focused diagnostic question and one planned synthesis stratum.</p></div>
                <Button size="sm" variant="outline" onClick={addQuestion}><Plus className="size-3.5" />Add question</Button>
              </div>
              {workspace.dtaQuestions.length === 0 ? (
                <button type="button" onClick={addQuestion} className="w-full rounded-md border border-dashed p-5 text-xs text-muted-foreground hover:bg-muted/30">Add the first population and reference standard</button>
              ) : (
                <div className="space-y-3">
                  {workspace.dtaQuestions.map((question, index) => (
                    <div key={question.id} className="rounded-md border bg-card/45 p-3">
                      <div className="mb-3 flex items-center gap-2"><span className="font-mono text-[10px] text-muted-foreground">Q{index + 1}</span><Button size="icon" variant="ghost" className="ml-auto size-8 text-destructive" onClick={() => deleteQuestion(question.id)} title="Delete question"><Trash2 className="size-3.5" /></Button></div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <SimpleField label="Population" helper="Be precise about age, pregnancy status, setting, and suspected condition." value={question.population} onChange={(value) => patchQuestion(question.id, { population: value })} placeholder="e.g. adults with suspected sepsis" />
                        <SimpleField label="Reference standard" helper="Name the standard used to classify the target condition." value={question.referenceStandard} onChange={(value) => patchQuestion(question.id, { referenceStandard: value })} placeholder="e.g. blood culture" />
                      </div>
                      <div className="mt-3 rounded-md bg-muted/45 px-3 py-2 text-xs leading-relaxed"><span className="mr-2 font-semibold text-teal-600 dark:text-teal-300">Generated</span>{buildDtaQuestion(question, workspace)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </TabsContent>

        {(Object.keys(PROSPERO_SECTION_LABELS) as ProtocolSectionId[]).map((section) => (
          <TabsContent key={section} value={section} className="space-y-4">
            <SectionHeading title={PROSPERO_SECTION_LABELS[section]} description={sectionDescription(section)} />
            <div className="grid gap-4 sm:grid-cols-2">
              {PROSPERO_FIELDS.filter((field) => field.section === section).map((field) => (
                <AnswerField key={field.id} field={field} value={workspace.answers[field.id] ?? ""} onChange={(value) => updateAnswer(field.id, value)} />
              ))}
            </div>
            {section === "methods" && <AmstarGuidance reviewType={review.type} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function fieldById(id: ProsperoFieldId): ProsperoFieldDefinition {
  const field = PROSPERO_FIELDS.find((item) => item.id === id);
  if (!field) throw new Error(`Missing protocol field: ${id}`);
  return field;
}

function AnswerField({ field, value, onChange }: { field: ProsperoFieldDefinition; value: string; onChange: (value: string) => void }) {
  return (
    <div className={field.short ? "space-y-1.5" : "space-y-1.5 sm:col-span-2"}>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs leading-snug">{field.prompt}{field.required && <span className="ml-1 text-destructive">*</span>}</Label>
        <InfoTooltip title={field.prompt} what={field.help} why="A specific answer can be transferred into the registration draft with less rewriting." example={field.example} />
        {field.required && value.trim() && <CheckCircle2 className="ml-auto size-3.5 text-emerald-500" />}
      </div>
      {field.short ? <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.example} className="h-9 text-xs" /> : <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.example} className="min-h-24 resize-y text-xs" />}
    </div>
  );
}

function SimpleField({ label, helper, value, onChange, placeholder }: { label: string; helper: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="space-y-1.5"><div className="flex items-center gap-1.5"><Label className="text-xs">{label}</Label><InfoTooltip title={label} what={helper} why="This value defines a separate diagnostic question." example={placeholder.replace("e.g. ", "")} /></div><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-9 text-xs" /></div>;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div className="border-b pb-3"><h3 className="text-base font-semibold">{title}</h3><p className="mt-1 max-w-3xl text-xs text-muted-foreground">{description}</p></div>;
}

function sectionDescription(section: ProtocolSectionId): string {
  return {
    basics: "Explain what the review is about, why it matters, and exactly what it will determine.",
    eligibility: "Write criteria that two reviewers could apply consistently to the same report.",
    methods: "Pre-specify how evidence will be found, selected, appraised, and synthesised.",
    administration: "Prepare the timeline, team, funding, protocol availability, and similarity checks needed for registration.",
  }[section];
}

function AmstarGuidance({ reviewType }: { reviewType: string }) {
  const overview = reviewType === "OVERVIEW";
  return (
    <div className="flex items-start gap-3 rounded-md border bg-card/45 p-3">
      <FileQuestion className="mt-0.5 size-4 shrink-0 text-violet-500" />
      <div><h4 className="text-xs font-semibold">Where AMSTAR 2 fits</h4><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{overview ? "AMSTAR 2 can be useful because this review appraises systematic reviews. ROBIS may also be appropriate when the focus is risk of bias rather than methodological quality." : "AMSTAR 2 appraises completed systematic reviews, not individual diagnostic-accuracy studies. For this review, use QUADAS-3 for primary studies; reserve AMSTAR 2 for an overview that includes systematic reviews."}</p></div>
    </div>
  );
}
