import { initialState } from "./domain.js";
export function sampleState() {
  const s = initialState(),
    now = Date.now();
  s.settings.workerEnabled = true;
  s.worker = { status: "Working", lastSeen: now, quota: 18 };
  s.tasks = [
    {
      id: "sample-audit",
      projectId: "sikhi-khoj",
      target: "website",
      status: "review",
      createdAt: now - 3600000,
      updatedAt: now - 600000,
      title: "Website audit",
      acceptance: "Check the quiz and sign-up experience.",
      ownerUpdate: {
        title: "Make the website easier to use",
        done: "Reviewed the quiz and sign-up flow. Found a scoring issue and places where feedback is unclear.",
        next: "Fix quiz scoring first, then improve sign-up messages.",
        issue: "",
        needsOwner: false,
      },
    },
    {
      id: "sample-setup",
      projectId: "drivenix",
      status: "blocked",
      createdAt: now - 7200000,
      updatedAt: now - 300000,
      title: "Set up project checks",
      blockedReason: "Sample diagnostic only",
      ownerUpdate: {
        title: "Get Drivenix ready for reliable testing",
        done: "Located the current driving simulation project.",
        issue:
          "Windows could not prepare a working copy because some file names are too long.",
        next: "Adjust the local setup and retry. You do not need to change anything.",
        needsOwner: false,
      },
    },
    {
      id: "sample-research",
      kind: "research",
      projectId: "reflex-trainer",
      status: "running",
      createdAt: now - 700000,
      updatedAt: now - 120000,
      title: "Research",
      ownerUpdate: {
        title: "Plan a better training experience",
        done: "Reviewing the current game and comparing useful training ideas.",
        next: "Rank improvements to training, difficulty and progress feedback.",
        needsOwner: false,
      },
    },
    {
      id: "sample-question",
      projectId: "reflex-trainer",
      status: "blocked",
      createdAt: now - 900000,
      updatedAt: now - 60000,
      title: "Sample owner decision",
      ownerUpdate: {
        title: "Choose the focus of the next training mode",
        done: "Prepared two directions for discussion.",
        issue: "This sample shows how a decision that needs you will appear.",
        next: "Use your answer to prepare the next plan.",
        needsOwner: true,
        question:
          "Should the next mode focus on quick daily practice or longer challenge sessions?",
        answerHint:
          "Sample question only. In the live dashboard, reply in our chat with your preference.",
      },
    },
  ];
  return s;
}
