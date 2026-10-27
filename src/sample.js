import { initialState } from "./domain.js";
export function sampleState() {
  const s = initialState(),
    now = Date.now();
  s.settings.workerEnabled = true;
  s.worker = { status: "Working", lastSeen: now, quota: 18 };
  s.tasks = [
    {id:'sample-queued',projectId:'sikhi-khoj',status:'queued',priority:3,approved:true,title:'Improve lesson navigation',acceptance:'Keep the next lesson easy to reach without extra scrolling.',dependencies:[],createdAt:now,updatedAt:now},
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
  s.tasks.push({id:"sample-finished",projectId:"reflex-trainer",status:"done",updatedAt:now-1800000,title:"Improve score counting",ownerUpdate:{title:"More trustworthy reflex scores",done:"Repeated taps no longer count twice.\nMisses no longer affect the average reaction time.",next:"Review the next training improvement."},acceptance:"Check repeated taps, misses and restart behaviour.",result:"# Changes\n- Count each target once.\n- Keep misses out of the reaction-time average.\n## Checks\nScoring checks passed. Restart resets the score."});
  s.settings.studioUpdate={updatedAt:now,ownerUpdate:{title:"Today’s studio check-in",done:"The next app changes are being checked.",next:"Finish the checks before adding the changes."}};
  s.reports=[{id:"sample-report",date:new Date(now).toISOString().slice(0,10),createdAt:now,expiresAt:now+86400000,ownerSections:[{heading:"What was finished",items:["Reflex Trainer: Fixed repeated taps counting twice.","Reflex Trainer: Misses no longer distort the reaction-time average."]},{heading:"Prepared, still being checked",items:["Sikhi Khoj: Prepared website quiz and sign-up improvements."]},{heading:"What got in the way",items:["Drivenix: The laptop setup needs a fix before the next check can run."]},{heading:"Coming next",items:["Check the website changes before the weekly update.","Resolve the laptop setup issue and retry the driving checks."]}],body:"# Supporting record\nSample data only. No live project result is represented by this report.\n## Checks\nThis sample demonstrates optional technical notes."}];
  s.ideasLoaded = true;
  s.ideas = ["light-fold","movable-track","counterweight"].map((mechanicKey,i)=>({id:`sample-idea-${i}`,projectId:"brainforge-company",name:["Sample light puzzle","Sample delivery puzzle","Sample balance puzzle"][i],hook:"Synthetic layout example. Open this card to explore the concept illustration.",mechanicKey,stage:"proposal",playSteps:["Choose a piece on the small board.","Try a move and see what changes."],whyItMayWork:["A small rule can lead to interesting choices."],risks:["The idea needs real player feedback."],firstTest:"Try a paper example before making a game.",recommendation:i===0,updatedAt:now}));
  return s;
}
