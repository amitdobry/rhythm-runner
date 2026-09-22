/**
 * Every word a player can see. Components import `T` and never hold a Hebrew
 * string of their own, so the whole app can be read, checked and changed in
 * one place. `he.test.ts` is the guard that keeps English out.
 */

export const T = Object.freeze({
  brand: 'Rhythm Runner',
  tagline: 'רצים בקצב של הכביש',
  playNow: 'מתחילים!',
  start: 'יאללה, רצים!',
  practiceAgain: 'לתרגל שוב',
  skip: 'דלגו',
  left: 'שמאל',
  right: 'ימין',
  perfect: 'מושלם!',
  good: 'טוב!',
  otherFoot: 'הרגל השנייה!',
  tooFast: 'מהר מדי',
  tooSlow: 'לאט מדי',
  skipped: 'פספסתם צעד',
  stumble: 'אופס! נפילה',
  time: 'זמן',
  speed: 'מהירות',
  energy: 'אנרגיה',
  combo: 'קומבו',
  score: 'ניקוד',
  distance: 'מרחק',
  bestCombo: 'הקומבו הכי טוב',
  accuracy: 'דיוק',
  playedOnPc: 'מחשב',
  playedOnMobile: 'טלפון',
  runFinished: 'סיימתם את הריצה!',
  runAgain: 'עוד פעם!',
  home: 'לדף הבית',
  saveScore: 'שמירת התוצאה בטבלה',
  nicknameLabel: 'איך לקרוא לכם? כינוי, לא שם מלא',
  nicknamePlaceholder: 'למשל: קפטן קוד',
  enter: 'כניסה',
  playedBefore: 'כבר שיחקתי, יש לי כינוי',
  hello: 'שלום, {name}',
  logOut: 'יציאה',
  rank: 'מקום {n} בטבלה',
  scoreNotSaved: 'התוצאה לא נשמרה, אבל הריצה הייתה אמיתית',
  highScores: 'טבלת השיאים',
  yourBest: 'השיא שלכם: {score} · {runs} ריצות',
  yourBestOne: 'השיא שלכם: {score} · ריצה אחת',
  noRunsYet: 'עוד אין ריצות. תהיו הראשונים!',
  scoresUnavailable: 'הטבלה לא זמינה כרגע',
  tutorialTitle: 'בואו נתרגל',
  tutorialOtherFoot: 'הרגל השנייה!',
  tutorialDone: 'מעולה! מוכנים?',

  // One idea at a time: when, then which foot, then why the pace changes.
  tutorialWhenTitle: 'מתי ללחוץ?',
  tutorialWhenHint: 'הטבעת מתכווצת. לחצו בדיוק כשהיא מגיעה לירוק',
  tutorialEarly: 'קצת מוקדם. חכו לירוק',
  tutorialLate: 'קצת מאוחר. נסו שוב',
  tutorialFeetTitle: 'ועכשיו, איזו רגל?',
  tutorialFeetHint: 'שמאל, ימין, שמאל, ימין. תמיד הרגל שמאירה',
  tutorialRoadTitle: 'הכביש קובע את הקצב',
  tutorialRoadBody:
    'עלייה איטית יותר, ירידה מהירה יותר, מים הכי איטיים. אתם לא צריכים לספור: הטבעת תמיד מראה מתי.',
  tutorialRoadFlat: 'ישר',
  tutorialRoadUphill: 'עלייה',
  tutorialRoadWater: 'מים',
  firstRunHint: 'לחצו כשהטבעת על הירוק',
  pcHowTo: 'רגל שמאל: ← או F. רגל ימין: → או J. שומרים על הקצב של הכביש.',
  mobileHowTo: 'לוחצים שמאל, ימין, שמאל, ימין, בקצב של הכביש.',
  landscapeHint: 'סובבו את הטלפון לעמידה',
  revealTitle: 'שיחקתם במשחק שנבנה עם בינה מלאכותית',
  revealBody:
    'עמית בנה את המשחק הזה יחד עם AI. בסדנה "בונים עם AI" ילדים לומדים להפוך רעיונות משלהם למשחקים ולאפליקציות אמיתיים.',
  revealCta: 'לפרטים והרשמה לסדנה',
  behindLink: 'איך בינה מלאכותית עזרה לבנות את המשחק?',
  behindTitle: 'מאחורי המשחק',
  behindSteps:
    '1. עמית תיאר את רעיון המשחק. 2. ה-AI עזר לתכנן את החוקים. 3. ה-AI כתב קוד. 4. עמית בדק, תיקן ושיפר. 5. ביחד הפכו רעיון למשחק חי.',
  behindRule: 'חוק אחד מתוך המנוע: צעד מושלם = מהירות +2.5, אנרגיה +3, קומבו +1',
  behindBridge: 'בסדנה הילדים לומדים בדיוק את הדרך הזאת: מרעיון לאפליקציה.',
  behindClose: 'סגירה',
  builtWith: 'נבנה על ידי עמית עם Claude Code',

  pinLabel: 'קוד סודי, 4 ספרות',
  pinHint: 'הקוד שומר על השם שלכם: בלי הקוד אף אחד אחר לא יכול לשמור תוצאה בשם הזה. תזכרו אותו!',
  pinFormat: 'הקוד הוא בדיוק 4 ספרות',
  wrongPin: 'הקוד לא מתאים לשם הזה. אם זה לא השם שלכם, בחרו שם אחר. נותרו {n} ניסיונות',
  pinLocked: 'יותר מדי ניסיונות. נסו שוב בעוד {minutes} דקות, או בחרו שם אחר',
  nameClaimed: 'השם {name} שלכם עכשיו. הקוד שומר עליו',
  welcomeBack: 'ברוכים השבים, {name}!',

  thisWeek: 'השבוע',
  allTime: 'כל הזמנים',
  resetsSunday: 'הטבלה מתאפסת ביום ראשון',
  yourRow: 'המקום שלכם',

  turbo: 'טורבו!',
  turbosLabel: 'טורבו',

  newBest: 'שיא חדש!',
  firstBest: 'השיא הראשון שלכם!',
  ranks: 'מקום {week} השבוע · מקום {all} בכל הזמנים',

  soundOn: 'הקול פועל',
  soundOff: 'הקול כבוי',

  // Short popups over the runner, where a whole sentence would not fit.
  popupSkipped: 'פספוס',
  popupStumble: 'אופס!',

  // Added in the same register, for places the table did not name.
  name: 'שם',
  meters: 'מ׳',
  device: 'מכשיר',
  savingScore: 'שומרים את התוצאה...',
  entering: 'נכנסים...',
  enterFailed: 'לא הצלחנו להיכנס. נסו שוב.',
});

export type TextKey = keyof typeof T;

/** Fills {name}, {n}, {score}, {runs} and friends into a string from T. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole
  );
}

/** Hebrew digits grouping, so 1240 reads as 1,240 the way a child expects. */
export function formatNumber(value: number): string {
  return value.toLocaleString('he-IL');
}
