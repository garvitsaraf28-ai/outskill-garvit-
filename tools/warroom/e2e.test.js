const out = [];
global.Logger = { log: m => out.push(String(m)) };
global.Utilities = { formatDate(d, tz, fmt) {
  const p = n => String(n).padStart(2,'0');
  const M=['January','February','March','April','May','June','July','August','September','October','November','December'];
  return fmt.replace('yyyy',d.getFullYear()).replace('MMMM',M[d.getMonth()]).replace('MMM',M[d.getMonth()].slice(0,3))
            .replace('MM',p(d.getMonth()+1)).replace('dd',p(d.getDate())).replace(/\bd\b/,d.getDate())
            .replace('HH',p(d.getHours())).replace('mm',p(d.getMinutes()));
}};
global.PropertiesService={getScriptProperties:()=>({getProperty:()=>null,setProperty:()=>{},deleteProperty:()=>{}})};
global.CacheService={getScriptCache:()=>({get:()=>null,put:()=>{}})};
global.ContentService={MimeType:{},createTextOutput:()=>({setMimeType:()=>({})})};

const D = (dd) => new Date(2026, 8, dd, 12, 0, 0);   // September 2026
// roster: col3 is the unheaded capacity ramp. Includes a totals row that must be dropped.
const roster = [
  ['Agent','Manager','Office','Team','Target','Month','','AIGF Upgrade'],
  ['Alisha Khan','Saeed','Hyderabad','International',500000,'2026-09',0.5,0],
  ['Kshitij','Deepika M','Bengaluru','Intl',800000,'2026-09',1,160000],
  ['Gowtham C','Saeed','HYD','International',400000,'2026-09',0.75,0],
  ['J Joel','Spurthi','BBSR','India',300000,'2026-09',1,0],
  ['Salman Rashid','Vaibhav Tiwari','Bhubaneswar','India',300000,'2026-09',0.5,0],
  ['New Joiner','Saeed','Hyderabad','India',0,'2026-09',0,0],
  ['Headcount','Sum agent revenue','Sum targets','',0,'2026-09',1,0],
  ['Old Agent','Saeed','Hyderabad','India',100000,'2026-08',1,0]
];
const pay = [
  ['Date','Lead Owner','On Roster','Amount Paid','Is Unit','Program','Segment','Status','Is Refund','Payment Type'],
  [D(3),'Alisha Khan','YES',200000,'YES','AIAP C14','International','',''],
  [D(12),'Alisha Khan','YES',150000,'YES','AIAP C15','International','','','Full Payment'],   // counts
  [D(12),'Kshitij','YES',300000,'YES','AI Bootcamp','International','','','Full Payment'], // barred
  [D(13),'Gowtham C','YES',120000,'YES','AIAP C14','International','','','Full Payment'],   // counts
  [D(13),'J Joel','YES',90000,'YES','','India','','','Full Payment'],                  // unknown
  [D(11),'Salman Rashid','YES',80000,'YES','AIAP C15','India','','','Full Payment'],          // before window
  [D(15),'Kshitij','YES',70000,'YES','AIAP C14','International','','','Full Payment'],  // after window
  [D(5),'Kshitij','YES',500000,'YES','AIAP C14','International','','YES','Full Payment'], // REFUND
  [D(6),'J Joel','YES',400000,'YES','AIAP C14','India','CANCELLED','','Full Payment'],  // CANCELLED
  [D(13),'Mastermind','NO',8300000,'YES','AIAP C14','India','','','Full Payment'],         // off roster, INSIDE the window
  [D(8),'Total','', 999999,'','','','','','']                                        // totals row
];
const mk = rows => ({
  getLastRow:()=>rows.length, getLastColumn:()=>rows[0].length,
  getRange:(r,c,nr,nc)=>({getValues:()=>rows.slice(r-1,r-1+nr).map(x=>x.slice(c-1,c-1+(nc||x.length)))})
});
global.SpreadsheetApp = { getActive: () => ({ getSheetByName: n =>
  n==='mdl_Roster' ? mk(roster) : n==='mdl_Payments' ? mk(pay) : null }) };

require('./_check.js');
const p = wr_build_('2026-09');
let fails = 0;
const eq = (what, got, want) => { const ok = String(got)===String(want);
  if(!ok) fails++; console.log((ok?'  PASS  ':'  FAIL  ')+what+(ok?'':`   got [${got}] want [${want}]`)); };

console.log('=== END TO END ===');
eq('totals row never becomes an agent', p.agents.filter(a=>a.name==='Total').length, 0);
eq('summary roster row dropped',        p.agents.filter(a=>a.name==='Headcount').length, 0);
eq('last month roster row dropped',     p.agents.filter(a=>a.name==='Old Agent').length, 0);
eq('roster agents on the board',        p.totals.agents, 6);
eq('capacity column was found',         p.totals.hasManMonth, true);
eq('counted agents exclude the 0 ramp', p.totals.counted, 5);
eq('man-months add up',                 p.totals.manMonths, 3.75);
eq('upgrade column found',              p.totals.hasUpgrade, true);
eq('upgrade revenue carried',           p.totals.upgrade, 160000);
/* Every non-refunded, non-cancelled roster row counts toward month revenue. */
eq('month revenue counts all valid rows', p.totals.revenue,
   200000+150000+300000+120000+90000+80000+70000);
eq('the 5.00 L refund is excluded',
   p.totals.revenue.toString().indexOf('1510000'), -1);
eq('refund + cancel removed 9.00 L',
   (200000+150000+300000+120000+90000+80000+70000+500000+400000) - p.totals.revenue, 900000);
eq('off-roster money kept off board',   p.totals.offRoster, 8300000);
eq('Bengaluru folded to Bangalore',     p.cities.filter(c=>c.name==='Bangalore').length, 1);

/* THE CONTEST RULE: a unit is a unit. All four rows dated inside
   12-14 Sep are units by roster agents, so all four count - the Bootcamp
   sale and the one with no product named included. Nothing is filtered. */
eq('contest window saw all 5 rows',     p.contest.windowRows, 5);
eq('every row in the window counts',    p.contest.matchedRows, 5);
eq('4 of the 5 units are roster units', p.contest.totalUnits, 4);
eq('the 5th is held off, not lost',     p.contest.offRosterUnits, 1);
eq('a Bootcamp sale still counts',
   p.contest.agents.filter(a => a.name === 'Kshitij').length, 1);
eq('a row with no product still counts',
   p.contest.agents.filter(a => a.name === 'J Joel').length, 1);
eq('rows before the window stay out',
   p.contest.agents.filter(a => a.name === 'Salman Rashid').length, 0);
eq('no filter, so no alarm',            p.contest.programmeMatchedNothing, false);
/* Off-roster names are off the revenue board, so they are off the contest
   board too - otherwise the two TVs disagree about the same day's sales.
   Mastermind's 83.00 L unit sits inside the window and must not appear. */
eq('an off-roster unit never reaches the board',
   p.contest.agents.filter(a => a.name === 'Mastermind').length, 0);
eq('contest leader is Kshitij on 3.00 L', p.contest.agents[0].name, 'Kshitij');
eq('revenue per man-month present',     p.managers[0].revPerMM !== null, true);
const notes = p.notes.join(' | ');
eq('refund is disclosed',   /refunded row/.test(notes), true);
eq('cancellation disclosed',/cancelled row/.test(notes), true);
eq('off-roster disclosed',  /not on this month/.test(notes), true);

/* A future contest that DOES bar a product still works, and a filter that
   keeps nothing still shouts instead of showing a silent zero. */
WR_CONTEST.excludeProduct = 'bootcamp';
const barred = wr_build_('2026-09');
eq('barring Bootcamp drops Kshitij',
   barred.contest.agents.filter(a => a.name === 'Kshitij').length, 0);
eq('and leaves the other three',        barred.contest.totalUnits, 3);

/* The alarm: a filter that drops EVERY row in the window must shout, not
   show a quiet zero. Every window row here names a product starting "AI",
   so barring "ai" leaves nothing at all. */
const payAll = pay.map(r => r.slice());
payAll[5][5] = 'AI Bootcamp';                 // J Joel's blank product, filled in
const saved = global.SpreadsheetApp;
global.SpreadsheetApp = { getActive: () => ({ getSheetByName: n =>
  n==='mdl_Roster' ? mk(roster) : n==='mdl_Payments' ? mk(payAll) : null }) };
WR_CONTEST.excludeProduct = 'ai';
const bad = wr_build_('2026-09');
eq('a filter keeping nothing raises the alarm', bad.contest.programmeMatchedNothing, true);
eq('and counts zero units',             bad.contest.totalUnits, 0);
eq('the window rows are still seen',    bad.contest.windowRows, 5);
WR_CONTEST.excludeProduct = '';
global.SpreadsheetApp = saved;
console.log(fails ? `\n=== ${fails} FAILED ===` : '\n=== ALL PASS ===');
process.exit(fails?1:0);
