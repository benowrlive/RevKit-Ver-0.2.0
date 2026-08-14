"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileQuestion,
  GitBranch,
  ListChecks,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  QUADAS3_ANSWER_OPTIONS,
  QUADAS3_DOMAINS,
  QUADAS3_JUDGEMENTS,
  QUADAS3_SOURCE_URL,
  createQuadas3Workspace,
  getEstimateJudgements,
} from "@/lib/quadas3/config";
import { newId } from "@/lib/project/id";
import { useReviewStore } from "@/lib/project/state";
import type {
  Quadas3DomainAssessment,
  Quadas3DomainId,
  Quadas3Estimate,
  Quadas3IdealTrial,
  Quadas3Judgement,
  Quadas3OverallJudgement,
  Quadas3StudyFlow,
  Quadas3SynthesisQuestion,
  Quadas3Workspace,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const PHASES = [
  { id: "1", label: "Question", icon: FileQuestion },
  { id: "2", label: "Ideal trial", icon: Target },
  { id: "3", label: "Study flow", icon: GitBranch },
  { id: "4", label: "Estimates", icon: ListChecks },
  { id: "5", label: "Domains", icon: ShieldCheck },
  { id: "6", label: "Overall", icon: CheckCircle2 },
] as const;

type PhaseId = (typeof PHASES)[number]["id"];

function textValue(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function JudgementBadge({ value }: { value: Quadas3Judgement }) {
  const option = QUADAS3_JUDGEMENTS.find((item) => item.value === value)!;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold"
      style={{
        color: option.color,
        borderColor: `${option.color}66`,
        backgroundColor: `${option.color}16`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: option.color }} />
      {option.label}
    </span>
  );
}

function JudgementSelect({
  value,
  onChange,
  label,
}: {
  value?: Quadas3Judgement;
  onChange: (value: Quadas3Judgement) => void;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px]">{label}</Label>
      <Select
        value={value ?? "insufficient_information"}
        onValueChange={(next) => onChange(next as Quadas3Judgement)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUADAS3_JUDGEMENTS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyPrompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

export function Quadas3WorkspacePanel() {
  const review = useReviewStore((state) => state.review);
  const setQuadas3Workspace = useReviewStore((state) => state.setQuadas3Workspace);
  const [phase, setPhase] = useState<PhaseId>("1");
  const [selectedEstimateId, setSelectedEstimateId] = useState("");

  if (!review) return null;

  const workspace =
    review.quadas3 ?? createQuadas3Workspace(review.researchQuestion);
  const selectedEstimate =
    workspace.estimates.find((estimate) => estimate.id === selectedEstimateId) ??
    workspace.estimates[0] ??
    null;

  function save(next: Quadas3Workspace) {
    setQuadas3Workspace({ ...next, version: "1.2", updatedAt: new Date().toISOString() });
  }

  function patchQuestion(id: string, patch: Partial<Quadas3SynthesisQuestion>) {
    save({
      ...workspace,
      synthesisQuestions: workspace.synthesisQuestions.map((question) =>
        question.id === id ? { ...question, ...patch } : question,
      ),
    });
  }

  function addQuestion() {
    const id = newId("q3q");
    save({
      ...workspace,
      synthesisQuestions: [
        ...workspace.synthesisQuestions,
        {
          id,
          label: `Synthesis question ${workspace.synthesisQuestions.length + 1}`,
          question: "",
          population: "",
          indexTests: "",
          targetCondition: "",
        },
      ],
    });
  }

  function deleteQuestion(id: string) {
    const estimateIds = new Set(
      workspace.estimates
        .filter((estimate) => estimate.questionId === id)
        .map((estimate) => estimate.id),
    );
    save({
      ...workspace,
      synthesisQuestions: workspace.synthesisQuestions.filter((question) => question.id !== id),
      idealTrials: workspace.idealTrials.filter((trial) => trial.questionId !== id),
      estimates: workspace.estimates.filter((estimate) => estimate.questionId !== id),
      domainAssessments: workspace.domainAssessments.filter(
        (assessment) => !estimateIds.has(assessment.estimateId),
      ),
      overallJudgements: workspace.overallJudgements.filter(
        (judgement) => !estimateIds.has(judgement.estimateId),
      ),
    });
  }

  function patchIdealTrial(questionId: string, patch: Partial<Quadas3IdealTrial>) {
    const existing = workspace.idealTrials.find((trial) => trial.questionId === questionId);
    const next: Quadas3IdealTrial = {
      questionId,
      objective: "",
      participants: "",
      indexTests: "",
      targetCondition: "",
      analysis: "",
      ...existing,
      ...patch,
    };
    save({
      ...workspace,
      idealTrials: existing
        ? workspace.idealTrials.map((trial) =>
            trial.questionId === questionId ? next : trial,
          )
        : [...workspace.idealTrials, next],
    });
  }

  function patchFlow(studyId: string, patch: Partial<Quadas3StudyFlow>) {
    const existing = workspace.studyFlows.find((flow) => flow.studyId === studyId);
    const next: Quadas3StudyFlow = {
      studyId,
      enrolled: null,
      receivedIndexTest: null,
      receivedReferenceStandard: null,
      includedInAnalysis: null,
      exclusions: "",
      notes: "",
      ...existing,
      ...patch,
    };
    save({
      ...workspace,
      studyFlows: existing
        ? workspace.studyFlows.map((flow) => (flow.studyId === studyId ? next : flow))
        : [...workspace.studyFlows, next],
    });
  }

  function addEstimate(studyId: string) {
    const id = newId("q3est");
    const questionId = workspace.synthesisQuestions[0]?.id ?? "";
    const next: Quadas3Estimate = {
      id,
      studyId,
      questionId,
      label: `Estimate ${workspace.estimates.filter((item) => item.studyId === studyId).length + 1}`,
      numericalResult: "",
      participants: "",
      indexTest: "",
      threshold: "",
      targetCondition: "",
      referenceStandard: "",
      unitOfAnalysis: "participant",
      analysis: "",
      domains: ["D1", "D2", "D3", "D4"],
    };
    save({ ...workspace, estimates: [...workspace.estimates, next] });
    setSelectedEstimateId(id);
  }

  function patchEstimate(id: string, patch: Partial<Quadas3Estimate>) {
    save({
      ...workspace,
      estimates: workspace.estimates.map((estimate) =>
        estimate.id === id ? { ...estimate, ...patch } : estimate,
      ),
    });
  }

  function deleteEstimate(id: string) {
    save({
      ...workspace,
      estimates: workspace.estimates.filter((estimate) => estimate.id !== id),
      domainAssessments: workspace.domainAssessments.filter(
        (assessment) => assessment.estimateId !== id,
      ),
      overallJudgements: workspace.overallJudgements.filter(
        (judgement) => judgement.estimateId !== id,
      ),
    });
    if (selectedEstimateId === id) setSelectedEstimateId("");
  }

  function patchAssessment(
    estimateId: string,
    domainId: Quadas3DomainId,
    patch: Partial<Quadas3DomainAssessment>,
  ) {
    const existing = workspace.domainAssessments.find(
      (assessment) =>
        assessment.estimateId === estimateId && assessment.domainId === domainId,
    );
    const next: Quadas3DomainAssessment = {
      estimateId,
      domainId,
      description: "",
      answers: {},
      riskJudgement: "insufficient_information",
      riskRationale: "",
      ...existing,
      ...patch,
    };
    save({
      ...workspace,
      domainAssessments: existing
        ? workspace.domainAssessments.map((assessment) =>
            assessment.estimateId === estimateId && assessment.domainId === domainId
              ? next
              : assessment,
          )
        : [...workspace.domainAssessments, next],
    });
  }

  function patchOverall(
    estimateId: string,
    patch: Partial<Quadas3OverallJudgement>,
  ) {
    const existing = workspace.overallJudgements.find(
      (judgement) => judgement.estimateId === estimateId,
    );
    const calculated = getEstimateJudgements(workspace.domainAssessments, estimateId);
    const next: Quadas3OverallJudgement = {
      estimateId,
      riskRationale: "",
      applicabilityRationale: "",
      ...existing,
      ...patch,
      riskJudgement: calculated.risk,
      applicabilityJudgement: calculated.applicability,
    };
    save({
      ...workspace,
      overallJudgements: existing
        ? workspace.overallJudgements.map((judgement) =>
            judgement.estimateId === estimateId ? next : judgement,
          )
        : [...workspace.overallJudgements, next],
    });
  }

  const phaseCounts: Record<PhaseId, string> = {
    "1": `${workspace.synthesisQuestions.length}`,
    "2": `${workspace.idealTrials.length}/${workspace.synthesisQuestions.length}`,
    "3": `${workspace.studyFlows.length}/${review.studies.length}`,
    "4": `${workspace.estimates.length}`,
    "5": `${new Set(workspace.domainAssessments.map((item) => item.estimateId)).size}/${workspace.estimates.length}`,
    "6": `${workspace.overallJudgements.length}/${workspace.estimates.length}`,
  };

  return (
    <section className="space-y-4" aria-label="QUADAS-3 assessment workspace">
      <div className="flex flex-col gap-3 border-y bg-card/45 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-md border border-teal-500/30 bg-teal-500/10 text-teal-500">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">QUADAS-3</h3>
                <span className="rounded-full border px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                  v{workspace.version}
                </span>
                <span className="rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 text-[9px] font-semibold text-teal-600 dark:text-teal-300">
                  Current DTA standard
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Work from the review question to an estimate-level judgment. RevKit saves all six official phases with this review.
              </p>
            </div>
          </div>
        </div>
        <a
          href={QUADAS3_SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Official guidance
          <ExternalLink className="size-3" />
        </a>
      </div>

      <Tabs value={phase} onValueChange={(value) => setPhase(value as PhaseId)}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max justify-start gap-1 bg-transparent p-0">
            {PHASES.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="h-9 gap-1.5 rounded-md border bg-card px-3 text-[11px] data-[state=active]:border-teal-500/50 data-[state=active]:bg-teal-500/10"
                >
                  <span className="font-mono text-[9px] text-muted-foreground">{item.id}</span>
                  <Icon className="size-3.5" />
                  {item.label}
                  <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[8px]">
                    {phaseCounts[item.id]}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="1" className="space-y-3">
          <PhaseHeading
            title="State the synthesis question"
            description="Define each question once for the review. Include the population, index test, and target condition."
            action={<Button size="sm" onClick={addQuestion}><Plus className="size-3.5" />Question</Button>}
          />
          {workspace.synthesisQuestions.length === 0 ? (
            <EmptyPrompt>Add the first synthesis question to begin QUADAS-3.</EmptyPrompt>
          ) : (
            <div className="space-y-3">
              {workspace.synthesisQuestions.map((question) => (
                <div key={question.id} className="rounded-md border bg-card/55 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <Input
                      aria-label="Question label"
                      value={question.label}
                      onChange={(event) => patchQuestion(question.id, { label: event.target.value })}
                      className="h-8 max-w-xs text-xs font-semibold"
                    />
                    <Button size="icon" variant="ghost" className="ml-auto size-8 text-destructive" onClick={() => deleteQuestion(question.id)} title="Delete question">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Review question" value={question.question} onChange={(value) => patchQuestion(question.id, { question: value })} wide />
                    <TextField label="Population" value={question.population} onChange={(value) => patchQuestion(question.id, { population: value })} />
                    <TextField label="Index test(s)" value={question.indexTests} onChange={(value) => patchQuestion(question.id, { indexTests: value })} />
                    <TextField label="Target condition" value={question.targetCondition} onChange={(value) => patchQuestion(question.id, { targetCondition: value })} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="2" className="space-y-3">
          <PhaseHeading title="Define the ideal test accuracy trial" description="Describe the unbiased, clinically applicable trial that each real study will be compared with." />
          {workspace.synthesisQuestions.length === 0 ? (
            <EmptyPrompt>Complete phase 1 before defining the ideal trial.</EmptyPrompt>
          ) : workspace.synthesisQuestions.map((question) => {
            const trial = workspace.idealTrials.find((item) => item.questionId === question.id);
            return (
              <div key={question.id} className="rounded-md border bg-card/55 p-3">
                <h4 className="mb-3 text-xs font-semibold">{question.label}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["objective", "participants", "indexTests", "targetCondition", "analysis"] as const).map((field) => (
                    <TextField
                      key={field}
                      label={{ objective: "Objective", participants: "Participants", indexTests: "Index test(s)", targetCondition: "Target condition and reference standard", analysis: "Analysis" }[field]}
                      value={trial?.[field] ?? ""}
                      onChange={(value) => patchIdealTrial(question.id, { [field]: value })}
                      wide={field === "objective" || field === "analysis"}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="3" className="space-y-3">
          <PhaseHeading title="Record participant and test-result flow" description="Capture how participants moved from enrolment through testing, the reference standard, and analysis." />
          {review.studies.length === 0 ? (
            <EmptyPrompt>Add included studies before recording study flow.</EmptyPrompt>
          ) : review.studies.map((study) => {
            const flow = workspace.studyFlows.find((item) => item.studyId === study.id);
            return (
              <div key={study.id} className="rounded-md border bg-card/55 p-3">
                <h4 className="mb-3 text-xs font-semibold">{study.label}</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <NumberField label="Enrolled" value={flow?.enrolled} onChange={(value) => patchFlow(study.id, { enrolled: value })} />
                  <NumberField label="Received index test" value={flow?.receivedIndexTest} onChange={(value) => patchFlow(study.id, { receivedIndexTest: value })} />
                  <NumberField label="Received reference standard" value={flow?.receivedReferenceStandard} onChange={(value) => patchFlow(study.id, { receivedReferenceStandard: value })} />
                  <NumberField label="Included in analysis" value={flow?.includedInAnalysis} onChange={(value) => patchFlow(study.id, { includedInAnalysis: value })} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <TextField label="Exclusions and reasons" value={flow?.exclusions ?? ""} onChange={(value) => patchFlow(study.id, { exclusions: value })} />
                  <TextField label="Flow notes" value={flow?.notes ?? ""} onChange={(value) => patchFlow(study.id, { notes: value })} />
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="4" className="space-y-3">
          <PhaseHeading title="Identify the estimates to assess" description="Add only numerical accuracy estimates that will contribute to a narrative or statistical synthesis." />
          {review.studies.length === 0 ? (
            <EmptyPrompt>Add included studies before identifying estimates.</EmptyPrompt>
          ) : review.studies.map((study) => {
            const estimates = workspace.estimates.filter((estimate) => estimate.studyId === study.id);
            return (
              <div key={study.id} className="rounded-md border bg-card/55 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold">{study.label}</h4>
                  <Button size="sm" variant="outline" onClick={() => addEstimate(study.id)}><Plus className="size-3.5" />Estimate</Button>
                </div>
                {estimates.length === 0 ? <p className="text-[11px] text-muted-foreground">No selected estimates.</p> : (
                  <div className="space-y-3">
                    {estimates.map((estimate) => (
                      <EstimateEditor key={estimate.id} estimate={estimate} questions={workspace.synthesisQuestions} onChange={(patch) => patchEstimate(estimate.id, patch)} onDelete={() => deleteEstimate(estimate.id)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="5" className="space-y-3">
          <PhaseHeading title="Assess each selected estimate" description="Answer signaling questions, then make a reasoned risk-of-bias and applicability judgment for each domain." />
          <EstimatePicker estimates={workspace.estimates} studies={review.studies} value={selectedEstimate?.id ?? ""} onChange={setSelectedEstimateId} />
          {!selectedEstimate ? <EmptyPrompt>Add an estimate in phase 4 before assessing domains.</EmptyPrompt> : (
            <div className="space-y-3">
              {QUADAS3_DOMAINS.filter((domain) => selectedEstimate.domains.includes(domain.id)).map((domain) => {
                const assessment = workspace.domainAssessments.find((item) => item.estimateId === selectedEstimate.id && item.domainId === domain.id);
                return (
                  <div key={domain.id} className="rounded-md border bg-card/55 p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{domain.id}</span>
                      <h4 className="text-xs font-semibold">{domain.name}</h4>
                      <JudgementBadge value={assessment?.riskJudgement ?? "insufficient_information"} />
                    </div>
                    <TextField label={domain.descriptionPrompt} value={assessment?.description ?? ""} onChange={(value) => patchAssessment(selectedEstimate.id, domain.id, { description: value })} wide />
                    <div className="my-3 divide-y rounded-md border">
                      {domain.questions.map((question) => (
                        <div key={question.id} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <p className="text-[11px] leading-relaxed">{question.text}</p>
                          <div className="flex flex-wrap gap-1">
                            {QUADAS3_ANSWER_OPTIONS.map((option) => {
                              const active = assessment?.answers[question.id] === option.value;
                              return (
                                <button key={option.value} type="button" title={option.label} onClick={() => patchAssessment(selectedEstimate.id, domain.id, { answers: { ...(assessment?.answers ?? {}), [question.id]: option.value } })} className={cn("h-7 min-w-8 rounded border px-1.5 font-mono text-[9px]", active ? "border-teal-500 bg-teal-500/12 text-teal-600 dark:text-teal-300" : "text-muted-foreground hover:bg-muted")}>
                                  {option.short}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <JudgementSelect label="Risk of bias" value={assessment?.riskJudgement} onChange={(value) => patchAssessment(selectedEstimate.id, domain.id, { riskJudgement: value })} />
                      <TextField label="Risk-of-bias rationale" value={assessment?.riskRationale ?? ""} onChange={(value) => patchAssessment(selectedEstimate.id, domain.id, { riskRationale: value })} />
                      {domain.applicabilityPrompt && (
                        <>
                          <JudgementSelect label="Applicability concern" value={assessment?.applicabilityJudgement} onChange={(value) => patchAssessment(selectedEstimate.id, domain.id, { applicabilityJudgement: value })} />
                          <TextField label={domain.applicabilityPrompt} value={assessment?.applicabilityRationale ?? ""} onChange={(value) => patchAssessment(selectedEstimate.id, domain.id, { applicabilityRationale: value })} />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="6" className="space-y-3">
          <PhaseHeading title="Confirm the overall judgments" description="QUADAS-3 derives the overall result from the domain judgments. Record the limitations that drove the result." />
          <EstimatePicker estimates={workspace.estimates} studies={review.studies} value={selectedEstimate?.id ?? ""} onChange={setSelectedEstimateId} />
          {!selectedEstimate ? <EmptyPrompt>Add and assess an estimate before completing the overall judgment.</EmptyPrompt> : (() => {
            const calculated = getEstimateJudgements(workspace.domainAssessments, selectedEstimate.id);
            const overall = workspace.overallJudgements.find((item) => item.estimateId === selectedEstimate.id);
            return (
              <div className="rounded-md border bg-card/55 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-semibold">Overall risk of bias</h4><JudgementBadge value={calculated.risk} /></div>
                    <TextField label="Major limitations and rationale" value={overall?.riskRationale ?? ""} onChange={(value) => patchOverall(selectedEstimate.id, { riskRationale: value })} wide />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-semibold">Overall applicability concern</h4><JudgementBadge value={calculated.applicability} /></div>
                    <TextField label="Key applicability differences" value={overall?.applicabilityRationale ?? ""} onChange={(value) => patchOverall(selectedEstimate.id, { applicabilityRationale: value })} wide />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button size="sm" onClick={() => patchOverall(selectedEstimate.id, {})}>Save overall judgment<ArrowRight className="size-3.5" /></Button>
                </div>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function PhaseHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 max-w-2xl text-xs text-muted-foreground">{description}</p></div>
      {action}
    </div>
  );
}

function TextField({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return (
    <div className={cn("space-y-1.5", wide && "sm:col-span-2")}>
      <Label className="text-[11px] leading-snug">{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-16 resize-y text-xs" />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value?: number | null; onChange: (value: number | null) => void }) {
  return (
    <div className="space-y-1.5"><Label className="text-[11px]">{label}</Label><Input type="number" min={0} value={textValue(value)} onChange={(event) => onChange(optionalNumber(event.target.value))} className="h-8 text-xs" /></div>
  );
}

function EstimatePicker({ estimates, studies, value, onChange }: { estimates: Quadas3Estimate[]; studies: { id: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  if (estimates.length === 0) return null;
  return (
    <div className="max-w-lg space-y-1.5"><Label className="text-[11px]">Estimate being assessed</Label><Select value={value} onValueChange={onChange}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{estimates.map((estimate) => <SelectItem key={estimate.id} value={estimate.id}>{studies.find((study) => study.id === estimate.studyId)?.label ?? "Study"} · {estimate.label}</SelectItem>)}</SelectContent></Select></div>
  );
}

function EstimateEditor({ estimate, questions, onChange, onDelete }: { estimate: Quadas3Estimate; questions: Quadas3SynthesisQuestion[]; onChange: (patch: Partial<Quadas3Estimate>) => void; onDelete: () => void }) {
  const fields: { key: keyof Quadas3Estimate; label: string }[] = [
    { key: "numericalResult", label: "Numerical result" }, { key: "participants", label: "Participants" }, { key: "indexTest", label: "Index test" }, { key: "threshold", label: "Threshold" }, { key: "targetCondition", label: "Target condition" }, { key: "referenceStandard", label: "Reference standard" }, { key: "unitOfAnalysis", label: "Unit of analysis" }, { key: "analysis", label: "Analysis" },
  ];
  return (
    <div className="rounded-md border bg-background/45 p-3">
      <div className="mb-3 flex items-center gap-2"><Input value={estimate.label} onChange={(event) => onChange({ label: event.target.value })} className="h-8 max-w-xs text-xs font-semibold" /><Button size="icon" variant="ghost" className="ml-auto size-8 text-destructive" onClick={onDelete} title="Delete estimate"><Trash2 className="size-3.5" /></Button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label className="text-[11px]">Synthesis question</Label><Select value={estimate.questionId} onValueChange={(value) => onChange({ questionId: value })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose question" /></SelectTrigger><SelectContent>{questions.map((question) => <SelectItem key={question.id} value={question.id}>{question.label}</SelectItem>)}</SelectContent></Select></div>
        {fields.map((field) => <div key={field.key} className="space-y-1.5"><Label className="text-[11px]">{field.label}</Label><Input value={String(estimate[field.key] ?? "")} onChange={(event) => onChange({ [field.key]: event.target.value })} className="h-8 text-xs" /></div>)}
      </div>
      <div className="mt-3 space-y-1.5"><Label className="text-[11px]">Domains to assess</Label><div className="flex flex-wrap gap-1.5">{QUADAS3_DOMAINS.map((domain) => { const active = estimate.domains.includes(domain.id); return <button key={domain.id} type="button" onClick={() => onChange({ domains: active ? estimate.domains.filter((id) => id !== domain.id) : [...estimate.domains, domain.id] })} className={cn("rounded-md border px-2 py-1 text-[10px]", active ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-300" : "text-muted-foreground")}>{domain.id} {domain.name}</button>; })}</div></div>
    </div>
  );
}
