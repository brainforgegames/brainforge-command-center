import test from "node:test";
import assert from "node:assert/strict";
import { workRows, readableBullets, noteSections, reportEntry } from "../src/reading.js";
import { studioSummary, ownerView } from "../src/presentation.js";
import { initialState } from "../src/domain.js";

test("stat drilldowns contain exactly the counted updates and open work, at India midnight", () => {
  const s=initialState(),now=Date.parse("2026-10-26T00:10:00+05:30");
  s.tasks=[{id:"closed",status:"done",updatedAt:now},{id:"draft",status:"review",updatedAt:now,projectId:"a"},{id:"blocked",status:"blocked",updatedAt:now-3600000,projectId:"b"}];
  s.settings.studioUpdate={updatedAt:now,ownerUpdate:{done:"Checks continue."}};
  const summary=studioSummary(s,now);
  assert.deepEqual(workRows(s,"today","all","all",now).map(t=>t.id),summary.today.map(t=>t.id));
  assert.deepEqual(workRows(s,"open","all","all",now).map(t=>t.id),summary.open.map(t=>t.id));
  assert.equal(summary.completed.length,1); // A studio check-in is not finished product work.
  assert.equal(ownerView(workRows(s,"today","all","all",now).find(t=>t.id==="studio-update")).done,"Checks continue.");
  assert.deepEqual(workRows(s,"today","a","review",now).map(t=>t.id),["draft"]);
  assert.deepEqual(workRows(s,"open","all","done",now),[]);
});

test("readable notes keep version numbers, decimal values and links intact", () => {
  assert.deepEqual(readableBullets("Uses Unity 6.3.26f1. Six checks pass. See https://example.com/docs."),["Uses Unity 6.3.26f1.","Six checks pass.","See https://example.com/docs."]);
  assert.deepEqual(noteSections("# Result\n- First change. Second change.\n## Evidence\n1. Six tests pass."),[{heading:"Result",items:["First change.","Second change."]},{heading:"Evidence",items:["Six tests pass."]}]);
  assert.deepEqual(reportEntry("Sikhi Khoj: Saved progress is safer. · 25 Oct, 9:24 pm IST"),{project:"Sikhi Khoj",items:["Saved progress is safer."],time:"25 Oct, 9:24 pm IST"});
});
