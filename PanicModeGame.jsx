import React, { useState, useEffect, useRef, useCallback } from "react";

/* ══════════════════════════════════════════════════
   SOUND ENGINE
══════════════════════════════════════════════════ */
class SFX {
  static ctx = null;
  static get() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }
  static tone(f=440, dur=0.3, vol=0.2, wave="sine", bend=0) {
    try {
      const c=this.get(), o=c.createOscillator(), g=c.createGain();
      o.type=wave; o.frequency.setValueAtTime(f,c.currentTime);
      if(bend) o.frequency.exponentialRampToValueAtTime(f+bend, c.currentTime+dur);
      g.gain.setValueAtTime(vol,c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+dur);
    } catch(e){}
  }
  static noise(freq=80, dur=0.6, vol=0.3) {
    try {
      const c=this.get(), buf=c.createBuffer(1,c.sampleRate*dur,c.sampleRate);
      const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
      const s=c.createBufferSource(); s.buffer=buf;
      const f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=freq;
      const g=c.createGain();
      g.gain.setValueAtTime(vol,c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(); s.stop(c.currentTime+dur);
    } catch(e){}
  }
  static jump()   { this.tone(320,0.12,0.2,"sine",280); }
  static land()   { this.noise(120,0.07,0.22); }
  static coin()   { [660,880,1100].forEach((f,i)=>setTimeout(()=>this.tone(f,0.09,0.2),i*50)); }
  static hit()    { this.noise(160,0.28,0.5); this.tone(180,0.2,0.25,"sawtooth"); }
  static dash()   { this.tone(700,0.07,0.18,"sine",-400); }
  static die()    { [360,270,190,120].forEach((f,i)=>setTimeout(()=>this.tone(f,0.2,0.3,"sawtooth"),i*100)); }
  static win()    { [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>this.tone(f,0.18,0.25),i*85)); }
  static select() { this.tone(660,0.08,0.2); setTimeout(()=>this.tone(880,0.1,0.2),100); }
  static alarm()   { [880,660,880,660].forEach((f,i)=>setTimeout(()=>this.tone(f,0.18,0.22,"square"),i*220)); }
  static success() { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.tone(f,0.18,0.22,"sine"),i*80)); }
  static fail()    { [350,280,210].forEach((f,i)=>setTimeout(()=>this.tone(f,0.22,0.28,"sawtooth"),i*100)); }
  static quake()   { for(let i=0;i<10;i++) setTimeout(()=>this.noise(55+i*8, 0.45, 0.5-i*0.03), i*140); }
  static flood()   { for(let i=0;i<8;i++)  setTimeout(()=>{ this.noise(180+i*25,0.55,0.2); this.tone(160+i*18,0.4,0.08,"sine",20); }, i*180); }
  static fire()    { for(let i=0;i<12;i++) setTimeout(()=>this.noise(280+Math.random()*220,0.28,0.12+Math.random()*0.1), i*90); }
  static wind()    { for(let i=0;i<10;i++) setTimeout(()=>{ this.noise(360+i*45,0.5,0.13); this.tone(110+i*12,0.38,0.07,"sawtooth"); }, i*160); }
  static wave()    { for(let i=0;i<14;i++) setTimeout(()=>this.noise(70+i*10, 0.9, 0.45-i*0.02), i*180); }
  static rumble()  { for(let i=0;i<6;i++)  setTimeout(()=>this.noise(40+i*6,  0.6, 0.4-i*0.04), i*200); }
}

/* ══════════════════════════════════════════════════
   CHARACTERS  (same as original)
══════════════════════════════════════════════════ */
const CHARS = [
  { id:"arjun",  name:"Arjun",  em:"👦", col:"#3b82f6",
    skin:"#f5cba7", hair:"#1a1a1a", outfit:"#1d4ed8", pants:"#1e3a8a",
    role:"Scout",        power:"DOUBLE JUMP", powerDesc:"Press ↑ again mid-air for a 2nd boost" },
  { id:"priya",  name:"Priya",  em:"👧", col:"#ec4899",
    skin:"#f8c471", hair:"#2c1810", outfit:"#9d174d", pants:"#831843",
    role:"Medic",        power:"SHIELD",      powerDesc:"First obstacle hit is absorbed — no damage" },
  { id:"ravi",   name:"Ravi",   em:"🧔", col:"#f97316",
    skin:"#c68a5e", hair:"#0a0a0a", outfit:"#c2410c", pants:"#7c2d12",
    role:"Firefighter",  power:"4 LIVES",     powerDesc:"Start with one extra life" },
  { id:"meera",  name:"Meera",  em:"👩", col:"#a855f7",
    skin:"#f5cba7", hair:"#1a0a0a", outfit:"#6b21a8", pants:"#581c87",
    role:"Nurse",        power:"SLOW-MO",     powerDesc:"Obstacles move 25% slower" },
  { id:"vikram", name:"Vikram", em:"👨", col:"#10b981",
    skin:"#8d6e4e", hair:"#0d0d0d", outfit:"#065f46", pants:"#064e3b",
    role:"Army Officer", power:"DASH",        powerDesc:"Hold SHIFT to dash & become invincible" },
  { id:"ananya", name:"Ananya", em:"🧕", col:"#f59e0b",
    skin:"#f8c471", hair:"#1a0d00", outfit:"#b45309", pants:"#92400e",
    role:"Civil Officer",power:"SCORE ×1.5",  powerDesc:"All pickups worth 50% more points" },
];

/* ══════════════════════════════════════════════════
   LEVELS  (matching original disasters)
══════════════════════════════════════════════════ */
const LEVELS = [
  { id:"earthquake", name:"EARTHQUAKE",   em:"🌍", col:"#dc2626", diff:"HARD",   speed:310,
    skyTop:"#1a0600", skyBot:"#080200",
    gndTop:"#3a1200", gndBot:"#1e0800",
    tip:"DROP → COVER under desk → HOLD ON → Stairs only" },
  { id:"flood",      name:"FLASH FLOOD",  em:"🌊", col:"#2563eb", diff:"MEDIUM", speed:285,
    skyTop:"#020c1e", skyBot:"#010810",
    gndTop:"#0d2840", gndBot:"#071520",
    tip:"Move to HIGH GROUND. Never wade through floodwater" },
  { id:"fire",       name:"BUILDING FIRE",em:"🔥", col:"#ea580c", diff:"HARD",   speed:270,
    skyTop:"#160200", skyBot:"#0d0100",
    gndTop:"#2e0800", gndBot:"#1c0400",
    tip:"CRAWL LOW — smoke rises. Feel door before opening" },
  { id:"cyclone",    name:"CYCLONE",      em:"🌀", col:"#7c3aed", diff:"EXTREME", speed:360,
    skyTop:"#060012", skyBot:"#04000a",
    gndTop:"#0a1808", gndBot:"#060e04",
    tip:"Reach government shelter. Never go out during the eye" },
  { id:"tsunami",    name:"TSUNAMI",      em:"🏄", col:"#0891b2", diff:"EXTREME", speed:340,
    skyTop:"#000c14", skyBot:"#000810",
    gndTop:"#a06010", gndBot:"#784808",
    tip:"Retreating sea = wave incoming. Run to 30m elevation NOW" },
  { id:"tornado",    name:"TORNADO",      em:"🌪️", col:"#4f46e5", diff:"EXTREME", speed:395,
    skyTop:"#04030e", skyBot:"#08061a",
    gndTop:"#163a0c", gndBot:"#0c2208",
    tip:"Get underground. Bridges are DEADLY — never shelter there" },
  { id:"wildfire",   name:"WILDFIRE",     em:"🌲", col:"#c2410c", diff:"HARD",   speed:280,
    skyTop:"#0a0100", skyBot:"#060100",
    gndTop:"#2a0a00", gndBot:"#180600",
    tip:"Run DOWNHILL & sideways. Drop heavy gear to move faster" },
  { id:"avalanche",  name:"AVALANCHE",    em:"🏔️", col:"#60a5fa", diff:"EXTREME", speed:375,
    skyTop:"#1a2a3e", skyBot:"#0e1a28",
    gndTop:"#d0e8ff", gndBot:"#a8d0f0",
    tip:"Ski SIDEWAYS off path. Create air pocket if buried" },
  { id:"heatwave",   name:"HEATWAVE",     em:"🌡️", col:"#d97706", diff:"EASY",   speed:245,
    skyTop:"#3d1200", skyBot:"#2a0c00",
    gndTop:"#8a3000", gndBot:"#5a1e00",
    tip:"Min 3L water/day. Move elderly to cooling centres fast" },
  { id:"landslide",  name:"LANDSLIDE",    em:"⛰️", col:"#b45309", diff:"HARD",   speed:305,
    skyTop:"#060200", skyBot:"#040100",
    gndTop:"#5c2800", gndBot:"#3a1800",
    tip:"Run PERPENDICULAR to slide. Never downhill" },
];
/* ══════════════════════════════════════════════════
   DO YOU KNOW? — 25 MCQ Quiz Questions
══════════════════════════════════════════════════ */
const QUIZ_QUESTIONS = [
  // ─── EARTHQUAKE (25 questions) ───────────────────────────────────────────
  { id:1,  cat:"Earthquake", em:"🌍", q:"What is the FIRST thing to do when you feel an earthquake?",
    opts:["Run outside immediately","Drop, Cover, and Hold On","Stand in a doorframe","Call emergency services"],
    ans:1, exp:"DROP to hands and knees, take COVER under a sturdy desk, and HOLD ON until shaking stops. This protects your head and neck from falling debris — the leading cause of earthquake injury." },
  { id:2,  cat:"Earthquake", em:"🌍", q:"Why should you NEVER use an elevator during an earthquake?",
    opts:["It wastes electricity","The shaft may collapse and trap you","It moves too slowly","Elevators get crowded"],
    ans:1, exp:"Elevator shafts can collapse or doors can jam during earthquakes, trapping people with no escape route. Power failures also leave you stuck. Always use stairs during and after an earthquake." },
  { id:3,  cat:"Earthquake", em:"🌍", q:"After an earthquake you smell gas inside the building. What should you do?",
    opts:["Light a torch to find the leak","Open windows and stay inside","Evacuate immediately and call 112 from outside","Turn on the AC to ventilate"],
    ans:2, exp:"Leave immediately WITHOUT using electrical switches (they can spark). Call 112 from a safe distance outside. A single spark near a gas leak can cause a fatal explosion." },
  { id:4,  cat:"Earthquake", em:"🌍", q:"The 'Triangle of Life' method says to shelter BESIDE furniture. According to NDMA this is:",
    opts:["Correct — it is the official guideline","An outdated myth — Drop-Cover-Hold On is proven safer","Only valid in wooden buildings","True only above 7.0 magnitude"],
    ans:1, exp:"The Triangle of Life is a debunked myth. NDMA and international agencies confirm DROP-COVER-HOLD ON significantly reduces injury. Modern buildings rarely 'pancake collapse' as the myth assumes." },
  { id:5,  cat:"Earthquake", em:"🌍", q:"What magnitude on the Richter scale is considered 'major' and potentially devastating?",
    opts:["Above 4.0","Above 5.0","Above 7.0","Above 9.0"],
    ans:2, exp:"Earthquakes above 7.0 are classified as 'major' and can cause widespread destruction over large areas. The 2001 Bhuj earthquake in India measured 7.7 and killed over 20,000 people." },
  { id:6,  cat:"Earthquake", em:"🌍", q:"Where is the SAFEST place to be during an earthquake if you are outdoors?",
    opts:["Under a large tree","Inside a parked car","An open area away from buildings and power lines","Against a tall wall"],
    ans:2, exp:"In the open, away from buildings, trees, overpasses, and power lines. Falling debris and collapsing structures are the biggest outdoor earthquake hazards." },
  { id:7,  cat:"Earthquake", em:"🌍", q:"What is a seismic 'aftershock'?",
    opts:["A secondary earthquake following the main one","The sound produced by the earthquake","Ground liquefaction","A small tremor warning a bigger quake is coming"],
    ans:0, exp:"Aftershocks are smaller earthquakes that follow the main event, sometimes for days or weeks. They can collapse already-damaged structures. Treat each aftershock as a new emergency." },
  { id:8,  cat:"Earthquake", em:"🌍", q:"Ground liquefaction during an earthquake means:",
    opts:["Water pipes burst","Saturated soil temporarily behaves like a liquid","Underground gas ignites","River water flows backwards"],
    ans:1, exp:"Liquefaction occurs when saturated sandy soil loses its strength under seismic vibration and behaves like a liquid, causing buildings to sink, tilt, or collapse even on 'flat' ground." },
  { id:9,  cat:"Earthquake", em:"🌍", q:"An earthquake preparedness 'Go Bag' should contain supplies for at least how long?",
    opts:["6 hours","24 hours","72 hours (3 days)","2 weeks"],
    ans:2, exp:"NDMA recommends at least 72 hours (3 days) of supplies: water (4L/person/day), food, medicines, torch, first aid kit, important documents, and warm clothing in a waterproof bag." },
  { id:10, cat:"Earthquake", em:"🌍", q:"Which Indian state is located in the HIGHEST seismic hazard zone (Zone V)?",
    opts:["Maharashtra","Tamil Nadu","Andaman & Nicobar Islands / North-East India","Rajasthan"],
    ans:2, exp:"Zone V — the highest risk — includes the Andaman & Nicobar Islands, North-East India (Assam, Mizoram, etc.), parts of Himachal Pradesh, Uttarakhand, and Kashmir. These regions require the strictest building codes." },
  { id:11, cat:"Earthquake", em:"🌍", q:"You are trapped under debris after an earthquake. The best way to signal rescuers is:",
    opts:["Shout continuously","Use a whistle or tap on pipes/metal","Dig furiously upward","Flash a torch repeatedly"],
    ans:1, exp:"Tapping on metal pipes or using a whistle carries sound farther than shouting and conserves energy. Continuous shouting wastes energy and can cause you to inhale dangerous dust." },
  { id:12, cat:"Earthquake", em:"🌍", q:"Which type of building material performs BEST in earthquakes?",
    opts:["Unreinforced brick masonry","Mud and straw construction","Reinforced concrete with seismic design","Stone walls without mortar"],
    ans:2, exp:"Reinforced concrete designed to seismic codes absorbs and distributes energy best. Unreinforced masonry (bricks, stone, mud) is the most dangerous material in earthquakes." },
  { id:13, cat:"Earthquake", em:"🌍", q:"After safely evacuating a building post-earthquake, you should NOT re-enter until:",
    opts:["The shaking stops for 5 minutes","A structural engineer declares the building safe","Local news says it's OK","Emergency services leave the area"],
    ans:1, exp:"Only a qualified structural engineer can assess whether a building is safe to re-enter. Visible cracks don't always indicate danger, and invisible damage can cause delayed collapse." },
  { id:14, cat:"Earthquake", em:"🌍", q:"What is the 'epicentre' of an earthquake?",
    opts:["The deepest point of the quake underground","The point on the surface directly above the focus","The hardest-hit building","The centre of the seismic warning zone"],
    ans:1, exp:"The epicentre is the point on the Earth's surface directly above the focus (hypocenter) where the earthquake originates underground. Damage is typically greatest at the epicentre." },
  { id:15, cat:"Earthquake", em:"🌍", q:"Water stored in your home before an earthquake should be stored in:",
    opts:["Open buckets for easy access","Sealed, food-grade containers away from chemicals","The refrigerator only","Glass jars on high shelves"],
    ans:1, exp:"Store water in clean, sealed, food-grade containers in a cool, dark place away from chemicals. Glass jars on high shelves will shatter. Open buckets become contaminated. Store at least 12 litres per person." },
  { id:16, cat:"Earthquake", em:"🌍", q:"The Richter scale measures earthquake magnitude. What does 'magnitude' represent?",
    opts:["The duration of shaking","The energy released by the earthquake","How many buildings collapsed","The depth of the earthquake"],
    ans:1, exp:"Magnitude measures the total energy released by the earthquake at its source. Each whole number increase represents approximately 32 times more energy released." },
  { id:17, cat:"Earthquake", em:"🌍", q:"You are in bed when an earthquake starts at night. The safest action is:",
    opts:["Run to the nearest wall","Stay in bed, protect head with pillow, hold on","Get up and run outside","Hide under the bed"],
    ans:1, exp:"Stay in bed if you are there when it starts. Hold on and protect your head with a pillow. Getting up means walking through broken glass and falling objects in the dark." },
  { id:18, cat:"Earthquake", em:"🌍", q:"Which NDMA guideline covers earthquake preparedness in India?",
    opts:["The National Building Code 2016","Disaster Management Act 2005","Both — NDMA's earthquake guidelines and the seismic provisions of the National Building Code","Only state government guidelines"],
    ans:2, exp:"Earthquake preparedness in India is governed by both the Disaster Management Act 2005 (through NDMA) and the seismic design provisions of the National Building Code 2016." },
  { id:19, cat:"Earthquake", em:"🌍", q:"A 'tsunami earthquake' is dangerous because:",
    opts:["It lasts longer than normal earthquakes","It causes a disproportionately large tsunami relative to its felt magnitude","It has more aftershocks","It travels faster through the ground"],
    ans:1, exp:"Tsunami earthquakes generate very large tsunamis despite relatively mild shaking felt by people, meaning residents may not react with urgency. The 1896 Sanriku, Japan earthquake is a classic example." },
  { id:20, cat:"Earthquake", em:"🌍", q:"The safest table position during an earthquake is:",
    opts:["On top of the table to avoid floor debris","Under the table, gripping the legs, protecting head","Beside the table with back against it","Under the table but not holding it"],
    ans:1, exp:"Grip the table legs so it moves with you if it shifts. The table's surface protects your head. Not holding it means the table moves away and you lose your cover." },
  { id:21, cat:"Earthquake", em:"🌍", q:"If you are in a crowded theatre during an earthquake, you should:",
    opts:["Rush to the exits immediately","Drop to the floor, cover your head, stay in your seat until shaking stops","Shout for everyone to evacuate","Run toward the stage area"],
    ans:1, exp:"Rushing to exits in a crowd causes stampedes. Stay in your seat, drop low, protect your head. Exit only after shaking stops and when directed calmly by staff." },
  { id:22, cat:"Earthquake", em:"🌍", q:"After an earthquake, which food is SAFEST to use first?",
    opts:["Canned goods in storage","Fresh refrigerated food","Food from the freezer","Raw grains"],
    ans:1, exp:"Use refrigerated food first — it will spoil fastest once power is disrupted. Frozen food can last 24–48 hours if the door stays closed. Canned goods last longest and should be used last." },
  { id:23, cat:"Earthquake", em:"🌍", q:"The Himalayan region has frequent earthquakes because:",
    opts:["It is close to the sea","The Indian tectonic plate is colliding with the Eurasian plate","Glaciers create ground vibration","It is near volcanic zones"],
    ans:1, exp:"The Indian plate is actively pushing northward into the Eurasian plate at about 5cm/year, creating enormous stress along the Himalayan arc — making this one of the world's most earthquake-prone regions." },
  { id:24, cat:"Earthquake", em:"🌍", q:"What is a 'soft story' building failure during earthquakes?",
    opts:["A building on soft soil","A building where one floor is less stiff than others (e.g. open ground floor), causing it to collapse","A single-storey building","A building with soft interior walls"],
    ans:1, exp:"Soft-story buildings have one floor (often ground level, with parking or open shops) far less stiff than others. During earthquakes this floor collapses first, bringing all upper floors down with it." },
  { id:25, cat:"Earthquake", em:"🌍", q:"How should you prepare your home's furniture to reduce earthquake injury risk?",
    opts:["Place heavy items on top shelves for stability","Secure tall furniture to walls with straps and brackets","Leave furniture free-standing to act as a natural barrier","Store breakables on the floor"],
    ans:1, exp:"Strap and anchor tall bookshelves, water heaters, refrigerators, and cabinets to walls. This prevents them from toppling during shaking — a leading cause of home earthquake injuries." },

  // ─── FLOOD (25 questions) ─────────────────────────────────────────────────
  { id:26, cat:"Flood", em:"🌊", q:"How deep does fast-moving floodwater need to be to knock an adult off their feet?",
    opts:["3 feet (90cm)","6 inches (15cm)","2 feet (60cm)","1 foot (30cm)"],
    ans:1, exp:"Just 6 inches (15cm) of fast-moving floodwater can sweep an adult off their feet. Never walk through flowing floodwater — the force is far greater than it appears." },
  { id:27, cat:"Flood", em:"🌊", q:"Your car is being swept by rapidly rising floodwater. The safest action is:",
    opts:["Stay inside and call for help","Drive faster to escape","Abandon the car and move to high ground","Honk the horn to alert rescuers"],
    ans:2, exp:"A car can be swept away in just 2 feet of water. Abandon the vehicle immediately and move uphill. The car is replaceable — your life is not." },
  { id:28, cat:"Flood", em:"🌊", q:"You see a flooded road that looks ankle-deep. You should:",
    opts:["Drive through slowly","Turn around — don't drown","Wade across on foot","Wait 10 minutes for it to clear"],
    ans:1, exp:"'Turn Around, Don't Drown' is the NDMA guideline. Roads may be entirely washed away under the surface. Even 6 inches of water can stall a vehicle." },
  { id:29, cat:"Flood", em:"🌊", q:"Before a flood, NDMA recommends storing emergency supplies for at least how many days?",
    opts:["1 day","3 days","7 days","14 days"],
    ans:1, exp:"NDMA recommends at least 3 days of essentials: drinking water (4L/person/day), non-perishable food, medicines, torch, first aid kit, and important documents in waterproof packaging." },
  { id:30, cat:"Flood", em:"🌊", q:"Floodwater should be treated as dangerous because it may contain:",
    opts:["Only rainwater — harmless","Sewage, chemicals, debris, and live electrical current","Salt water from the sea only","Excessive minerals"],
    ans:1, exp:"Floodwater is a toxic mix of sewage, industrial chemicals, agricultural runoff, debris, snakes, and potentially live electricity from submerged cables. Never assume it is harmless." },
  { id:31, cat:"Flood", em:"🌊", q:"What is 'vertical evacuation' in a flood?",
    opts:["Being evacuated by helicopter","Moving to higher floors of a building when horizontal evacuation is impossible","Climbing trees to escape water","Being rescued by boat"],
    ans:1, exp:"Vertical evacuation means moving to higher floors within a building when you cannot safely escape horizontally. It is the recommended last resort when moving to high ground is not possible." },
  { id:32, cat:"Flood", em:"🌊", q:"When should you turn off electricity in your home before a flood?",
    opts:["Never — it's too dangerous to touch the fuse box","When water reaches your ankles inside","Before water enters — at the main circuit breaker","Only when instructed by emergency services"],
    ans:2, exp:"Turn off electricity at the main breaker BEFORE water enters. Once water contacts electrical outlets or wiring, the risk of electrocution is extreme — and you cannot safely touch the breaker while standing in water." },
  { id:33, cat:"Flood", em:"🌊", q:"Which Indian state system sends SMS alerts for flood warnings?",
    opts:["Flood Alert India (FAI)","Common Alerting Protocol (CAP) via NDMA/IMD","ISRO Satellite Network","Private telecom companies only"],
    ans:1, exp:"NDMA coordinates with IMD (India Meteorological Department) using the Common Alerting Protocol to send flood, cyclone, and disaster SMS alerts to mobile users in at-risk zones." },
  { id:34, cat:"Flood", em:"🌊", q:"After floodwaters recede, which is the MOST critical health risk?",
    opts:["Sunburn from being outdoors","Waterborne diseases like cholera, typhoid, hepatitis A","Frostbite from wet clothes","Respiratory infections from cold air"],
    ans:1, exp:"Post-flood disease outbreaks are a major killer. Contaminated water spreads cholera, typhoid, hepatitis A, and leptospirosis. Boil all water and avoid floodwater contact even after it recedes." },
  { id:35, cat:"Flood", em:"🌊", q:"What is a 'flash flood' and why is it more dangerous than a regular flood?",
    opts:["A flood that occurs at night — harder to see","A rapid, intense flood that arrives with little or no warning","A flood caused by dam failure only","A shallow flood covering large areas"],
    ans:1, exp:"Flash floods develop within 6 hours of heavy rainfall and arrive with devastating speed and force. The lack of warning time makes them the most deadly type of flood, responsible for most flood deaths." },
  { id:36, cat:"Flood", em:"🌊", q:"Sandbags are most effective for floods when:",
    opts:["Stacked as high as possible against walls","Placed in a staggered, pyramid pattern with the open end folded away from water","Filled with dry sand and loosely piled","Used only around doorways"],
    ans:1, exp:"Sandbags should be filled 2/3 full, the open end folded under, and stacked in a staggered pattern like brickwork. Overfilled bags leave gaps; loose piles fail. They are a temporary measure only." },
  { id:37, cat:"Flood", em:"🌊", q:"What does 'NDRF' stand for in India?",
    opts:["National Disaster Response Force","National Defence Reserve Force","Natural Disaster Relief Fund","National Development and Relief Force"],
    ans:0, exp:"NDRF (National Disaster Response Force) is India's specialised response force for natural and man-made disasters including floods, earthquakes, and cyclones. It operates under NDMA." },
  { id:38, cat:"Flood", em:"🌊", q:"How can you make flood drinking water safe if no purification tablets are available?",
    opts:["Filter through cloth and let it settle","Boil it vigorously for at least 1 minute (3 minutes at altitude)","Add a teaspoon of salt per litre","Mix with equal parts fresh rainwater"],
    ans:1, exp:"Boiling is the most reliable method — 1 minute at sea level, 3 minutes above 2000m altitude. Cloth filtration removes particles but NOT pathogens. Salt does nothing to purify water." },
  { id:39, cat:"Flood", em:"🌊", q:"Leptospirosis is a disease spread during floods through:",
    opts:["Mosquito bites","Contact with floodwater contaminated by animal (especially rat) urine","Breathing floodwater vapour","Eating flood-contaminated fruit"],
    ans:1, exp:"Leptospirosis spreads when floodwater contaminated by rodent urine enters the body through skin cuts, eyes, or the mouth. It causes jaundice, kidney failure, and can be fatal. Cover wounds and avoid wading." },
  { id:40, cat:"Flood", em:"🌊", q:"A 'flood plain' is:",
    opts:["A government-designated flood shelter","The flat area adjacent to a river that periodically floods","A drainage map used by engineers","An agricultural field below a dam"],
    ans:1, exp:"A flood plain is the naturally flat land alongside a river that floods regularly. Building homes in flood plains is extremely high-risk — yet it is very common due to fertile soil and flat land." },
  { id:41, cat:"Flood", em:"🌊", q:"Children and the elderly are more vulnerable in floods because:",
    opts:["They are less experienced at swimming","They have lower body strength and mass, making them easier to knock over in moving water, and may not recognise danger","They are less likely to follow evacuation orders","They require more food supplies"],
    ans:1, exp:"Even shallow moving water can overpower children and the elderly due to their lower body weight and strength. They may also not recognise warning signs. Prioritise their evacuation first." },
  { id:42, cat:"Flood", em:"🌊", q:"What is the India Meteorological Department's (IMD) colour code for the MOST severe flood rainfall warning?",
    opts:["Yellow","Orange","Red","Purple"],
    ans:2, exp:"IMD uses a four-colour system: Green (normal), Yellow (watch), Orange (alert/ready), and Red (warning/act now). Red alerts indicate extreme rainfall requiring immediate protective action." },
  { id:43, cat:"Flood", em:"🌊", q:"If caught in a river current and swept away, the correct swimming technique is:",
    opts:["Swim directly against the current to stop movement","Swim diagonally toward the bank with the current","Tread water in the centre of the river","Dive under the surface to avoid surface currents"],
    ans:1, exp:"Do NOT fight the current directly — you will exhaust yourself. Float on your back with feet downstream to deflect rocks, and swim at a 45-degree angle toward the bank, using the current's momentum." },
  { id:44, cat:"Flood", em:"🌊", q:"Urban flooding is made worse by:",
    opts:["High buildings that block wind","Paved surfaces and blocked drains that prevent water absorption","Clear skies after rainfall","Wide roads"],
    ans:1, exp:"Urban areas have extensive concrete and asphalt surfaces that prevent water absorption (runoff). Combined with blocked storm drains and encroachment on natural water channels, cities flood far worse than rural areas with same rainfall." },
  { id:45, cat:"Flood", em:"🌊", q:"What is India's Central Flood Control Room?",
    opts:["A monitoring room inside ISRO","The 24x7 national flood monitoring centre under the Ministry of Jal Shakti","A private flood insurance company","A state-level warning system only"],
    ans:1, exp:"India's Central Flood Control Room operates 24x7 under the Ministry of Jal Shakti during flood season (June–November), coordinating real-time data from river gauges, reservoirs, and weather stations across the country." },
  { id:46, cat:"Flood", em:"🌊", q:"During a flood evacuation, pets and livestock should be:",
    opts:["Left behind — human life comes first","Released or moved to high ground if possible before evacuating","Kept indoors with enough food","Put in a sealed room on the ground floor"],
    ans:1, exp:"If time permits, move livestock to higher ground and take pets. Releasing domestic animals prevents them from being trapped and drowning. Never delay human evacuation for animals, but plan for them in advance." },
  { id:47, cat:"Flood", em:"🌊", q:"Which of these household items can be used as an emergency flotation device?",
    opts:["A full suitcase","A sealed, empty jerrycan or plastic bottle","A wooden chair","A metal bucket"],
    ans:1, exp:"Sealed, empty plastic containers (jerrycans, large bottles) have enough buoyancy to support a person's head above water. A wooden chair provides some flotation. Metal objects sink." },
  { id:48, cat:"Flood", em:"🌊", q:"Flood insurance in India for homeowners falls under:",
    opts:["NDMA-managed government policy","The Pradhan Mantri Fasal Bima Yojana (for crops) and private general insurance for homes","RBI-mandated bank insurance","It is not available in India"],
    ans:1, exp:"India has crop flood insurance under PMFBY and home flood insurance is available from private general insurers. Most standard home insurance policies do NOT automatically cover floods — check your policy." },
  { id:49, cat:"Flood", em:"🌊", q:"The correct way to rescue someone caught in floodwater from a bank is:",
    opts:["Jump in and swim to them","Throw a rope or floating object, or extend a branch — do NOT enter the water","Shout instructions to them","Wait for professional rescuers only"],
    ans:1, exp:"'Reach-Throw-Don't Go' is the rescue rule. Entering moving floodwater to save someone puts two lives at risk instead of one. Throw a rope, branch, or floating object from a secure position." },
  { id:50, cat:"Flood", em:"🌊", q:"After returning home post-flood, what is the first safety step?",
    opts:["Turn the electricity back on to check for damage","Have a structural engineer or authority inspect before entering","Start cleaning and removing mud immediately","Check that all doors and windows still close properly"],
    ans:1, exp:"A building may be structurally compromised by floodwater soaking and undermining foundations. Gas lines may be damaged. Have it inspected before entering. Never turn electricity on with wet wiring." },

  // ─── FIRE (25 questions) ──────────────────────────────────────────────────
  { id:51, cat:"Fire", em:"🔥", q:"The best way to test if a closed door is safe to open during a fire is:",
    opts:["Look for smoke under the door","Touch the door near the top with the back of your hand","Knock loudly and listen","Push it open quickly and close it if smoke enters"],
    ans:1, exp:"Use the back of your hand (not palm) near the TOP of the door — heat rises so the top is hotter first. If hot, do not open. Use the palm risks burning the more sensitive skin you need to escape." },
  { id:52, cat:"Fire", em:"🔥", q:"When escaping a building fire with smoke, you should:",
    opts:["Stand up and run quickly","Crawl low to the ground where air is cleaner","Hold your breath and run","Open all doors to ventilate the building"],
    ans:1, exp:"Smoke and toxic gases rise. The cleanest air in a smoke-filled space is near the floor. Crawl on hands and knees and cover your mouth with cloth. Most fire deaths are from smoke inhalation, not flames." },
  { id:53, cat:"Fire", em:"🔥", q:"If your clothes catch fire, the correct response is:",
    opts:["Run to find water","Fan the flames to blow them out","Stop, Drop, and Roll","Take the clothes off quickly while running"],
    ans:2, exp:"STOP running (it fans flames), DROP to the ground, and ROLL repeatedly to smother the fire. Running increases oxygen supply to the fire. Remove burning clothing only after flames are out." },
  { id:54, cat:"Fire", em:"🔥", q:"A fire extinguisher is remembered using the acronym PASS. What does it stand for?",
    opts:["Pull, Aim, Squeeze, Sweep","Push, Activate, Spray, Stop","Prepare, Aim, Start, Stop","Pull, Apply, Stand, Secure"],
    ans:0, exp:"PASS: Pull the pin, Aim at the base of the fire (not the flames), Squeeze the handle, and Sweep from side to side. Always aim at the BASE where fuel is, not the visible flames." },
  { id:55, cat:"Fire", em:"🔥", q:"Which type of fire extinguisher should NEVER be used on an electrical fire?",
    opts:["CO2 extinguisher","Dry chemical powder","Water extinguisher","Clean agent extinguisher"],
    ans:2, exp:"Water conducts electricity — using it on an electrical fire can electrocute you. Use CO2 (carbon dioxide) or dry powder extinguishers on electrical fires. CO2 is preferred as it leaves no residue on equipment." },
  { id:56, cat:"Fire", em:"🔥", q:"The most important fire safety device to install in a home is:",
    opts:["Fire sprinkler system","Smoke detector / alarm","Fire extinguisher","Fireproof doors"],
    ans:1, exp:"A working smoke detector (alarm) is the single most effective life-saving device — it provides early warning while people are sleeping. Test batteries monthly and replace every 10 years." },
  { id:57, cat:"Fire", em:"🔥", q:"Kitchen grease fire — you should NEVER:",
    opts:["Slide a lid over the pan to smother it","Turn off the heat","Pour water on it","Use a Class K/F extinguisher"],
    ans:2, exp:"Water on a grease fire causes a violent steam explosion that spreads burning oil in all directions. Smother it with a lid, turn off the heat, or use a Class K fire extinguisher." },
  { id:58, cat:"Fire", em:"🔥", q:"A fire needs three elements — the 'fire triangle' — to burn. These are:",
    opts:["Heat, Fuel, Oxygen","Spark, Fuel, Air","Heat, Carbon, Oxygen","Flame, Smoke, Fuel"],
    ans:0, exp:"Every fire requires Heat, Fuel (combustible material), and Oxygen. Remove any one element and the fire goes out. This is why smothering (removes oxygen), cooling with water (removes heat), and removing fuel all work." },
  { id:59, cat:"Fire", em:"🔥", q:"In a high-rise building fire, you should NEVER use:",
    opts:["The fire stairs","The fire exits on lower floors","The elevator","A rope to exit windows"],
    ans:2, exp:"Elevators may take you directly to the fire floor, or fail and trap you. They also pump smoke between floors. Use the fire stairs — they are pressurised and designed to be smoke-free during fires." },
  { id:60, cat:"Fire", em:"🔥", q:"'Flashover' in a building fire refers to:",
    opts:["When the fire alarm triggers","The moment all combustible materials in a room simultaneously ignite","Smoke from a nearby building","When fire breaks windows"],
    ans:1, exp:"Flashover is the near-simultaneous ignition of all combustible material in a room due to extreme radiant heat. Survival after flashover is nearly impossible. It occurs in as little as 3–5 minutes from fire start." },
  { id:61, cat:"Fire", em:"🔥", q:"What is the primary cause of death in building fires?",
    opts:["Burns from direct flame contact","Carbon monoxide and toxic smoke inhalation","Structural collapse","Explosion from gas lines"],
    ans:1, exp:"Over 50% of fire deaths are caused by smoke and toxic gas inhalation, not flames. Carbon monoxide is colourless, odourless, and incapacitates victims before they realise danger." },
  { id:62, cat:"Fire", em:"🔥", q:"Carbon monoxide detectors should be placed:",
    opts:["Near the floor in every room","On the ceiling near sleeping areas","Outside buildings only","Only in rooms with gas appliances"],
    ans:1, exp:"CO is slightly lighter than air and disperses evenly, but placing detectors near sleeping areas (where you are most vulnerable) is critical. NDMA recommends detectors outside each sleeping area." },
  { id:63, cat:"Fire", em:"🔥", q:"The recommended minimum distance to keep combustible materials from a cooking flame is:",
    opts:["15cm","30cm","60cm","1 metre"],
    ans:1, exp:"Keep at least 30cm clear of any open flame. Loose fabric, paper, and wooden utensils near burners are the most common causes of kitchen fires in Indian homes." },
  { id:64, cat:"Fire", em:"🔥", q:"A 'fire escape plan' for your home should include:",
    opts:["One exit route and a meeting point outside","Two exit routes from every room and an outdoor meeting point at least 15m from the building","Fire extinguisher locations only","Which valuables to take when evacuating"],
    ans:1, exp:"Plan two ways out of every room (in case one is blocked by fire), practice the routes, and designate a meeting point far enough from the building that emergency vehicles can pass." },
  { id:65, cat:"Fire", em:"🔥", q:"LPG (cooking gas) cylinder fires: the correct first response is:",
    opts:["Pour water on the cylinder","Close the regulator valve to stop gas flow if safe to do so, then call 101","Wrap the cylinder in wet cloth","Pick up the cylinder and move it outside"],
    ans:1, exp:"If safe, close the regulator valve to cut the fuel supply. Call 101 (fire). Never use water on gas fires and never try to move a heated cylinder — they can explode (BLEVE)." },
  { id:66, cat:"Fire", em:"🔥", q:"When calling the fire brigade emergency number in India, you should dial:",
    opts:["100","108","101","112"],
    ans:2, exp:"101 is India's dedicated fire emergency number. 112 also connects to all emergency services including fire. Save both numbers — 101 may connect faster to the local fire station." },
  { id:67, cat:"Fire", em:"🔥", q:"The 'Rule of Thumb' for deciding whether to fight a fire yourself is:",
    opts:["If the fire is smaller than your body","If the fire is no larger than a small waste bin, you have clear escape, and a charged extinguisher","If others are watching to help","If you have fought fires before"],
    ans:1, exp:"Only attempt to fight a fire if it is no larger than a small waste basket, you have a fully charged appropriate extinguisher, your back is to a clear exit, and the room is not smoke-filled." },
  { id:68, cat:"Fire", em:"🔥", q:"To prevent fires, electrical outlets should:",
    opts:["Be covered with metal plates for insulation","Not be overloaded with multiple high-wattage appliances on one socket","Always have a plug inserted to prevent dust entry","Be behind furniture to reduce fire risk"],
    ans:1, exp:"Overloaded outlets are a leading cause of electrical fires. Each socket should carry only the rated load. Use individual switched extension boards — never daisy-chain extension leads." },
  { id:69, cat:"Fire", em:"🔥", q:"At what temperature does paper ignite (the 'Fahrenheit 451' temperature)?",
    opts:["100°C (212°F)","233°C (451°F)","300°C (572°F)","500°C (932°F)"],
    ans:1, exp:"Paper autoignites at approximately 233°C (451°F) — made famous by Ray Bradbury's novel. Knowing ignition temperatures helps in understanding why keeping papers away from heat sources matters." },
  { id:70, cat:"Fire", em:"🔥", q:"Smoke detectors should be tested:",
    opts:["Every 5 years when the battery dies","Every month using the test button","Only when you suspect a problem","Once after installation"],
    ans:1, exp:"Test smoke detectors monthly by pressing the test button. Replace batteries at least annually (or use 10-year sealed batteries). Replace the entire unit every 10 years." },
  { id:71, cat:"Fire", em:"🔥", q:"'Wildfire defensible space' around a home means:",
    opts:["A fireproof wall around the property","Clearing vegetation within 30m of the home to reduce fuel for an approaching wildfire","A legal exclusion zone","A water storage area for firefighting"],
    ans:1, exp:"Defensible space is the cleared buffer zone around structures where vegetation is managed to reduce fuel for wildfires. NDMA and forest departments recommend at least 30m clearance around vulnerable structures in forest zones." },
  { id:72, cat:"Fire", em:"🔥", q:"A BLEVE (Boiling Liquid Expanding Vapour Explosion) associated with fire occurs when:",
    opts:["Petrol ignites","A pressurised container (like an LPG cylinder) fails catastrophically due to fire heating its contents","Water pipes burst in a fire","A transformer explodes"],
    ans:1, exp:"A BLEVE happens when a gas cylinder or pressurised vessel is heated by fire, causing catastrophic structural failure. Flying fragments travel hundreds of metres and the fireball is enormous. Never fight a fire involving cylinders — evacuate immediately." },
  { id:73, cat:"Fire", em:"🔥", q:"Fire doors should be:",
    opts:["Propped open for quick exit","Kept closed at all times — they prevent fire and smoke spread for 30–120 minutes","Locked when not in use","Opened fully during fire alarm drills"],
    ans:1, exp:"Fire doors contain fire and smoke and can provide critical escape time. Propping them open destroys this protection entirely. A wedged-open fire door can turn a survivable incident into a mass casualty event." },
  { id:74, cat:"Fire", em:"🔥", q:"Arson — deliberately setting fire — is punishable under which Indian law?",
    opts:["Consumer Protection Act","Indian Penal Code Section 435 and 436 (mischief by fire)","Motor Vehicles Act","Disaster Management Act 2005"],
    ans:1, exp:"IPC Section 435 (mischief causing damage by fire) and Section 436 (destroying a house or vessel by fire) carry imprisonment of up to life. Arson during communal events can attract additional UAPA charges." },
  { id:75, cat:"Fire", em:"🔥", q:"During a building fire evacuation, assembly points should be:",
    opts:["As close to the building as possible for accounting","At least 15–25 metres away from the building — far enough for emergency vehicles to operate","In the car park to shelter from heat","At the main road junction"],
    ans:1, exp:"Assembly points must be far enough from the building (typically 15–25m minimum) that they don't obstruct emergency vehicle access and are not in the fire's path. Mark them clearly and practice evacuating to them." },

  // ─── CYCLONE (25 questions) ───────────────────────────────────────────────
  { id:76, cat:"Cyclone", em:"🌀", q:"During a cyclone, the wind suddenly stops and it becomes calm. This means:",
    opts:["The cyclone is over — go outside","You are in the eye — stay inside, storm continues","It's safe to evacuate now","The storm has changed direction"],
    ans:1, exp:"Calm during the eye of a cyclone is temporary and deceptive. The back wall carries winds just as violent. NEVER go outside during the eye. Stay sheltered until official all-clear." },
  { id:77, cat:"Cyclone", em:"🌀", q:"Which part of a building is SAFEST to shelter in during a cyclone?",
    opts:["Top floor for visibility","Near large windows","Lowest floor, interior room away from windows","Balcony or veranda"],
    ans:2, exp:"The lowest floor interior room has the most structural layers between you and the wind. Flying glass and debris are the main killers in cyclones — stay far from all windows." },
  { id:78, cat:"Cyclone", em:"🌀", q:"A Cyclone Category 5 has wind speeds of approximately:",
    opts:["90–100 km/h","120–150 km/h","Above 200 km/h","70–90 km/h"],
    ans:2, exp:"Category 5 cyclones have wind speeds exceeding 200 km/h — capable of destroying permanent structures. These require immediate evacuation of all coastal areas." },
  { id:79, cat:"Cyclone", em:"🌀", q:"Cyclone warnings in India are issued by:",
    opts:["NDMA directly","India Meteorological Department (IMD)","ISRO satellite division","Coast Guard headquarters"],
    ans:1, exp:"The India Meteorological Department (IMD) is solely responsible for cyclone tracking and warning in India. It issues warnings 72 hours in advance and updates every 6 hours as the storm approaches." },
  { id:80, cat:"Cyclone", em:"🌀", q:"'Storm surge' associated with cyclones refers to:",
    opts:["Heavy rainfall during the cyclone","A sudden rise in sea level along the coast caused by the cyclone's winds pushing water inland","Flooding from overflowing rivers","Strong gusts within the eye wall"],
    ans:1, exp:"Storm surge is the most deadly component of a cyclone. The cyclone's low pressure and strong winds push the sea inland, sometimes raising sea levels by 5–10 metres, devastating coastal areas far from the storm's eye." },
  { id:81, cat:"Cyclone", em:"🌀", q:"The Bay of Bengal has more cyclones than the Arabian Sea because:",
    opts:["It is warmer and shallower, with more moisture and less wind shear","It is larger and deeper","The Arabian Sea is fully enclosed","Bay of Bengal storms are not counted by IMD"],
    ans:0, exp:"The Bay of Bengal is warmer, retains more moisture, and has lower wind shear — all conditions that intensify cyclones. It accounts for over 70% of India's cyclone activity." },
  { id:82, cat:"Cyclone", em:"🌀", q:"Cyclone season in the Bay of Bengal peaks during:",
    opts:["January–February","April–May only","October–November (post-monsoon)","July–August"],
    ans:2, exp:"The most active cyclone season in the Bay of Bengal is October–November (post-monsoon). April–May (pre-monsoon) is a secondary peak. Most of India's worst cyclones have struck during this period." },
  { id:83, cat:"Cyclone", em:"🌀", q:"Before a cyclone, you should secure loose objects outside your home because:",
    opts:["To prevent theft","Flying debris becomes lethal projectiles at cyclone wind speeds","To prevent water damage","They block emergency vehicle access"],
    ans:1, exp:"Objects like flower pots, chairs, and corrugated sheets become deadly missiles at 150+ km/h winds. A metal sheet can penetrate a brick wall. Secure or bring indoors everything that can move." },
  { id:84, cat:"Cyclone", em:"🌀", q:"The safest construction type to shelter in during an extreme cyclone is:",
    opts:["Traditional thatched roof hut","Tin-roofed factory building","Government-certified RCC cyclone shelter","Wooden beachfront cottage"],
    ans:2, exp:"Purpose-built RCC (Reinforced Cement Concrete) cyclone shelters are engineered to withstand Category 4–5 winds and storm surge. They are the only reliable safe option during extreme cyclones near the coast." },
  { id:85, cat:"Cyclone", em:"🌀", q:"Odisha's dramatic reduction in cyclone deaths (from 10,000+ in 1999 to <100 in 2013) was achieved through:",
    opts:["Fewer cyclones hitting the coast","Early warning systems + community cyclone shelters + mass evacuation drills","Better hospital infrastructure","Coastal tree plantations only"],
    ans:1, exp:"The 1999 Odisha cyclone killed 10,000+. By 2013 (Phailin, same strength), deaths were <50 due to the world-class ODISHA DISASTER RAPID ACTION FORCE system combining early warnings, shelters, and mass drills. A global model." },
  { id:86, cat:"Cyclone", em:"🌀", q:"Which direction does a cyclone rotate in the Northern Hemisphere (India)?",
    opts:["Clockwise","Anti-clockwise","Randomly","Depends on the season"],
    ans:1, exp:"Due to the Coriolis effect, cyclones rotate anti-clockwise in the Northern Hemisphere. Southern Hemisphere cyclones (called typhoons or hurricanes) rotate clockwise. This affects which side carries the strongest winds." },
  { id:87, cat:"Cyclone", em:"🌀", q:"Emergency supplies to prepare before a cyclone should NOT include:",
    opts:["Waterproof torch and batteries","Sealed drinking water","Glass bottles of preserved food","Important documents in waterproof bags"],
    ans:2, exp:"Glass bottles can shatter during violent cyclone shaking or when the building is hit by debris, creating dangerous shards and destroying food supplies. Use plastic or metal sealed containers." },
  { id:88, cat:"Cyclone", em:"🌀", q:"The 'eye wall' of a cyclone contains:",
    opts:["The calmest winds of the storm","The most intense winds and heaviest rainfall","Where emergency services operate","The inner safe zone"],
    ans:1, exp:"The eye wall surrounding the calm eye contains the most violent, concentrated winds and heaviest rainfall. It is the most dangerous part of the storm and the area with the most structural damage." },
  { id:89, cat:"Cyclone", em:"🌀", q:"After a cyclone passes, the greatest ongoing risk to health is:",
    opts:["Dehydration from heat","Contaminated water leading to waterborne diseases","Starvation from food shortage","Sunburn from UV exposure"],
    ans:1, exp:"Post-cyclone flooding contaminates water supplies with sewage and debris. Cholera, typhoid, and leptospirosis outbreaks follow cyclones regularly. Boil water and maintain strict hygiene until supplies are restored." },
  { id:90, cat:"Cyclone", em:"🌀", q:"Which body issues the 'Red Alert' cyclone warning in India?",
    opts:["NDRF","State Disaster Management Authority","India Meteorological Department (IMD)","Ministry of Home Affairs"],
    ans:2, exp:"IMD issues all meteorological alerts including cyclone Red Alerts. State Disaster Management Authorities (SDMAs) then activate evacuation and shelter plans based on IMD's warnings." },
  { id:91, cat:"Cyclone", em:"🌀", q:"Fishing boats should return to port when IMD issues what level of cyclone signal?",
    opts:["Signal 1 — at first distant warning","Signal 3","Signal 5","Only during landfall"],
    ans:0, exp:"Fishing vessels should return to port immediately at Signal 1 or Port Warning 1 when a storm is still 500+ km away. Sea conditions deteriorate rapidly and escape routes can close within hours." },
  { id:92, cat:"Cyclone", em:"🌀", q:"The Saffir-Simpson scale rates cyclones/hurricanes from:",
    opts:["0–5","1–5","1–10","A to F"],
    ans:1, exp:"The Saffir-Simpson scale rates from Category 1 (minimal, 120–153 km/h) to Category 5 (catastrophic, 252+ km/h). India's own cyclone classification uses slightly different wind speed thresholds under IMD guidelines." },
  { id:93, cat:"Cyclone", em:"🌀", q:"Mangrove forests along India's coasts reduce cyclone damage by:",
    opts:["Providing firewood during emergencies","Acting as a natural buffer that absorbs wave energy and reduces storm surge","Blocking cyclone warning signals","Increasing coastal rainfall"],
    ans:1, exp:"Mangroves dissipate cyclone wave energy, reduce storm surge penetration, and stabilise coastlines. Studies show communities behind intact mangroves suffer significantly less cyclone damage. Their destruction increases vulnerability." },
  { id:94, cat:"Cyclone", em:"🌀", q:"During a cyclone, you should keep updated via:",
    opts:["Social media posts from friends","Official IMD bulletins, All India Radio, and government SMS alerts","Television entertainment channels","Neighbours' advice"],
    ans:1, exp:"Only trust official sources: IMD bulletins (imd.gov.in), All India Radio (AIR), Doordarshan, and NDMA/state SMS alerts. Social media spreads rumours during disasters that cause panic and dangerous decisions." },
  { id:95, cat:"Cyclone", em:"🌀", q:"After a cyclone, fallen trees and power lines are dangerous because:",
    opts:["They smell of ozone","Fallen power lines may still carry live electricity capable of electrocution even in puddles around them","They attract snakes seeking shelter","They block satellite signals"],
    ans:1, exp:"Assume all fallen power lines are live and deadly. Water around a live wire can conduct electricity several metres. Report to electricity authorities and stay well away — never drive over them." },
  { id:96, cat:"Cyclone", em:"🌀", q:"The India Meteorological Department's 24-hour cyclone forecast accuracy is approximately:",
    opts:["30–40%","50–60%","80–90%","Nearly 100%"],
    ans:2, exp:"IMD's 24-hour tropical cyclone track forecast accuracy has improved to 80–90% in recent years. 72-hour forecasts have accuracy of around 70%, giving adequate time for evacuation of millions of people." },
  { id:97, cat:"Cyclone", em:"🌀", q:"NDMA's National Cyclone Risk Mitigation Project (NCRMP) focuses on:",
    opts:["Building offshore barriers","Early Warning Systems + Cyclone Shelters + Last Mile Connectivity to vulnerable coastal communities","Training the Indian Navy","Reforestation of coastal zones"],
    ans:1, exp:"NCRMP strengthens Early Warning Systems (EWS), builds coastal cyclone shelters, and ensures last-mile communication reaches remote fishing villages before cyclones strike. It operates across Odisha, Andhra Pradesh, and other coastal states." },
  { id:98, cat:"Cyclone", em:"🌀", q:"A cyclone's 'radius of maximum winds' refers to:",
    opts:["The total diameter of the storm","The ring where the strongest winds occur — usually just outside the eye wall","The area under a Red Alert","The zone of storm surge impact"],
    ans:1, exp:"The radius of maximum winds (RMW) is the ring just outside the eye wall where the most intense winds are concentrated. Knowing a cyclone's RMW helps determine which areas will experience the worst conditions." },
  { id:99, cat:"Cyclone", em:"🌀", q:"During cyclone evacuations in India, priority is given to:",
    opts:["Wealthier families who have vehicles","Pregnant women, elderly, disabled persons, and children","People who live closest to the shelter","Those who request evacuation first"],
    ans:1, exp:"NDMA evacuation protocols prioritise the most vulnerable: pregnant women, newborns, elderly persons, people with disabilities, and children. These groups cannot self-evacuate and face the highest fatality risk." },
  { id:100, cat:"Cyclone", em:"🌀", q:"Cyclone Amphan (2020) was notable because:",
    opts:["It was India's first recorded cyclone","It caused the largest peacetime evacuation in Indian history — 5+ million people","It had the highest wind speed ever recorded in the Bay of Bengal","It bypassed all coastal areas completely"],
    ans:1, exp:"Cyclone Amphan (May 2020) triggered the evacuation of over 5 million people from West Bengal and Odisha during the COVID-19 pandemic — the largest evacuation in Indian history and a global model for disaster management." },

  // ─── TSUNAMI (25 questions) ───────────────────────────────────────────────
  { id:101, cat:"Tsunami", em:"🏄", q:"The ocean suddenly pulls back dramatically from shore. What does this mean?",
    opts:["It is safe to swim — it's low tide","A tsunami is imminent — run inland immediately","A rare weather phenomenon — observe it","Good time to collect stranded fish"],
    ans:1, exp:"Ocean drawback is the most unmistakable tsunami warning sign. You have MINUTES. Run inland to 30m elevation or 3km from shore immediately — never wait for an official siren." },
  { id:102, cat:"Tsunami", em:"🏄", q:"How high above sea level should you reach to be safe from most tsunamis?",
    opts:["5 metres","10 metres","30 metres","100 metres"],
    ans:2, exp:"NDMA recommends reaching at least 30 metres above sea level or moving at least 3km inland. The 2004 Indian Ocean tsunami reached over 30m in some areas of Sri Lanka and Aceh." },
  { id:103, cat:"Tsunami", em:"🏄", q:"After a tsunami warning is issued, coastal residents in India typically have how long to evacuate?",
    opts:["5–10 minutes","15–30 minutes","2–4 hours","12 hours"],
    ans:1, exp:"India's tsunami early warning system (INCOIS) provides 15–30 minutes of warning for near-source events. Know your evacuation route IN ADVANCE and act immediately — this is barely enough time." },
  { id:104, cat:"Tsunami", em:"🏄", q:"The 2004 Indian Ocean Tsunami was triggered by:",
    opts:["An underwater volcanic eruption","A magnitude 9.1 earthquake off the coast of Sumatra, Indonesia","A massive submarine landslide","A meteorite impact in the ocean"],
    ans:1, exp:"The 2004 Boxing Day tsunami was triggered by a magnitude 9.1 earthquake — the third largest ever recorded — off Sumatra's coast. It killed over 230,000 people across 14 countries including 10,000+ in India's Tamil Nadu and Andaman Islands." },
  { id:105, cat:"Tsunami", em:"🏄", q:"Tsunamis travel across open ocean at speeds of approximately:",
    opts:["20–50 km/h","100–200 km/h","800–950 km/h","5,000 km/h"],
    ans:2, exp:"Tsunamis travel at jet-aircraft speeds (800–950 km/h) across deep ocean but are barely noticeable (only 30–60cm wave height). They only slow down and rise dramatically as they approach shallow coastal waters." },
  { id:106, cat:"Tsunami", em:"🏄", q:"India's tsunami early warning centre (INCOIS) is located in:",
    opts:["Mumbai","Delhi","Hyderabad","Chennai"],
    ans:2, exp:"The Indian National Centre for Ocean Information Services (INCOIS) in Hyderabad operates India's Tsunami Early Warning System 24x7, monitoring seismic activity across the Indian Ocean and issuing warnings within minutes of a triggering earthquake." },
  { id:107, cat:"Tsunami", em:"🏄", q:"Multiple tsunami waves arrive. The FIRST wave is usually:",
    opts:["Always the largest and most dangerous","Not always the largest — later waves can be much bigger","Always a small 'test wave'","The one containing the most debris"],
    ans:1, exp:"The first wave is NOT always the largest. In many historical tsunamis, the second, third, or even fifth wave was the most destructive. NEVER return to the coast after the first wave passes." },
  { id:108, cat:"Tsunami", em:"🏄", q:"The interval between tsunami waves is typically:",
    opts:["1–5 minutes","5–30 minutes","1–3 hours","6–12 hours"],
    ans:1, exp:"Tsunami waves arrive in 'trains' spaced approximately 5–30 minutes apart. This dangerous gap makes people think the event is over and return to the coast, only to be killed by subsequent waves." },
  { id:109, cat:"Tsunami", em:"🏄", q:"A 'tsunami ready' community must have which minimum system in place?",
    opts:["A tall concrete seawall","Natural warning signs education + evacuation routes + drill practice + official warning connection","A deep-sea monitoring buoy only","Elevated beach huts"],
    ans:1, exp:"UNESCO's TsunamiReady programme requires communities to have natural warning sign education, mapped and marked evacuation routes, regular drills, and connection to the official warning system. Physical barriers alone are insufficient." },
  { id:110, cat:"Tsunami", em:"🏄", q:"Which Indian regions are at HIGHEST risk from tsunamis?",
    opts:["West coast only (Arabian Sea)","Only the Andaman & Nicobar Islands","Andaman & Nicobar Islands + Tamil Nadu/Andhra East coast + parts of Kerala & Odisha","North India river plains"],
    ans:2, exp:"The Andaman & Nicobar Islands face the most direct risk from Sumatran subduction zone earthquakes. The Tamil Nadu, Andhra Pradesh, and Odisha east coasts face tsunami risk from Bay of Bengal seismic events." },
  { id:111, cat:"Tsunami", em:"🏄", q:"Vertical evacuation buildings must withstand tsunami forces AND:",
    opts:["Extreme heat from following fires","Wave loading, debris impact, and scour (erosion of foundations) from rushing water","Air pressure changes","Lightning strikes from associated storms"],
    ans:1, exp:"Vertical evacuation structures must withstand extreme hydrostatic and hydrodynamic wave loads, high-velocity debris impact (trees, cars, boats), and foundation scour as the wave undermines soil. These are far higher forces than normal structural standards." },
  { id:112, cat:"Tsunami", em:"🏄", q:"If you are on a boat in deep water when a tsunami occurs, the safest action is:",
    opts:["Race to port to secure the boat","Stay far out at sea in deep water — the wave is barely noticeable there","Anchor the boat and wait","Signal for helicopter rescue immediately"],
    ans:1, exp:"In deep water (1000m+), a tsunami is only 30–60cm high and harmless to boats. The danger is in shallow coastal water where the wave amplifies to enormous height. Boats in port during a tsunami are destroyed." },
  { id:113, cat:"Tsunami", em:"🏄", q:"'Inundation zone' in tsunami maps refers to:",
    opts:["The beach area only","The maximum land area likely to be flooded by a credible tsunami","The deep-sea earthquake zone","The warning exclusion buffer around the coastline"],
    ans:1, exp:"Inundation zone maps show the maximum land area that could be flooded by a realistic worst-case tsunami. NDMA and IMD publish these for Indian coastal districts — check if your home or business is within one." },
  { id:114, cat:"Tsunami", em:"🏄", q:"The Indian Ocean Tsunami Warning System established after 2004 includes how many countries?",
    opts:["5","28","50+","All UN member states"],
    ans:1, exp:"The Indian Ocean Tsunami Warning and Mitigation System (IOTWS) established in 2005–2006 after the 2004 disaster involves 28 countries around the Indian Ocean, coordinated through UNESCO-IOC." },
  { id:115, cat:"Tsunami", em:"🏄", q:"A tsunami is sometimes incorrectly called a 'tidal wave.' Why is this term wrong?",
    opts:["Tsunamis are smaller than tidal waves","Tsunamis have nothing to do with tides — they are seismic sea waves","The term was never used in Japan","It is only wrong in India"],
    ans:1, exp:"'Tidal wave' is a complete misnomer. Tsunamis are caused by seismic events (earthquakes, volcanic eruptions, landslides), not tidal forces. The Japanese term 'tsunami' (harbour wave) is the correct scientific term." },
  { id:116, cat:"Tsunami", em:"🏄", q:"Natural warning signs that do NOT require modern technology to detect include:",
    opts:["Ocean drawback, unusually loud ocean roar, and ground shaking","Cloud formations","Weather radar signals","Satellite phone alerts"],
    ans:0, exp:"Natural warning signs observable without technology: strong ground shaking, unusual ocean roar, ocean drawback exposing seafloor, and unusual animal behaviour. Indigenous and fishing communities with this knowledge have saved thousands of lives." },
  { id:117, cat:"Tsunami", em:"🏄", q:"Tsunami evacuation routes should be memorised because:",
    opts:["GPS may not be available","There will be no time to look at maps during the actual event","Authorities may not be present","Paper maps get wet"],
    ans:1, exp:"In the 15–30 minute warning window, there is no time to look up routes. Muscle memory from practiced drills saves lives. Walk your evacuation route regularly and ensure every family member knows it." },
  { id:118, cat:"Tsunami", em:"🏄", q:"The safest material for a 'tsunami bag' (emergency carry bag) to resist water damage is:",
    opts:["Leather bag","Canvas backpack","Dry bag or waterproof backpack","Plastic shopping bags"],
    ans:2, exp:"A waterproof dry bag (used by kayakers and divers) keeps documents, medicines, and electronics dry even when partially submerged. Vital when evacuating through floodwater or storm surge conditions." },
  { id:119, cat:"Tsunami", em:"🏄", q:"In schools and hotels near the coast, the annual national tsunami drill day in India is:",
    opts:["26 December (anniversary of 2004 tsunami)","23 January","15 August","First Monday of monsoon season"],
    ans:0, exp:"India observes 26 December each year as a day of tsunami awareness and drills, marking the 2004 Indian Ocean Tsunami anniversary. Coastal schools and establishments conduct evacuation drills on this date." },
  { id:120, cat:"Tsunami", em:"🏄", q:"A mega-thrust earthquake capable of causing a tsunami requires a magnitude of at least:",
    opts:["5.0","6.5","7.5","9.0 or higher"],
    ans:2, exp:"Tsunamigenic earthquakes typically require magnitude 7.5 or higher AND occur in the ocean floor with vertical movement. The 2004 tsunami was M9.1. Shallow, near-coastal earthquakes of M7.5+ pose significant tsunami risk." },
  { id:121, cat:"Tsunami", em:"🏄", q:"After tsunami inundation, returning home is safe only when:",
    opts:["The water has fully receded from the streets","Official 'all clear' is issued by authorities after confirming all wave trains have passed","One hour after the last wave","Emergency services are no longer visible on shore"],
    ans:1, exp:"Only trust the official all-clear from IMD/NDMA/State authorities. Well-meaning locals calling 'it's over' have led to preventable deaths in many events. Tsunami wave trains can last 8–12 hours." },
  { id:122, cat:"Tsunami", em:"🏄", q:"Smoke, fire, and chemical contamination after a tsunami are caused by:",
    opts:["The ocean water itself","Earthquake damage to gas lines and industrial tanks combined with the tsunami's energy","Only industrial areas","Post-tsunami rain"],
    ans:1, exp:"Tsunamis that follow major earthquakes hit already-damaged infrastructure — ruptured gas lines ignite, industrial chemical tanks burst, fuel storage floats and ignites. The 2011 Fukushima nuclear disaster followed tsunami impact on the plant." },
  { id:123, cat:"Tsunami", em:"🏄", q:"The term 'runup' in tsunami science refers to:",
    opts:["The speed a person needs to evacuate","The maximum inland height the tsunami water reaches above sea level","The warning time before impact","The wave's height in deep ocean"],
    ans:1, exp:"'Runup' is the maximum vertical height above sea level that tsunami waters reach onshore. The 2004 tsunami had a runup of 30m+ in parts of Indonesia. Evacuation targets must be ABOVE the maximum expected runup." },
  { id:124, cat:"Tsunami", em:"🏄", q:"The Andaman & Nicobar Islands are at extreme tsunami risk because they sit:",
    opts:["Near a major volcanic chain","Directly above the Sunda Megathrust subduction zone — site of the 2004 earthquake","In the centre of the Indian Ocean","In a seismically inactive zone"],
    ans:1, exp:"The Andaman & Nicobar Islands sit directly above the Sunda Megathrust — the same fault that caused the catastrophic 2004 earthquake. The islands can have as little as 5 minutes warning for locally generated tsunamis." },
  { id:125, cat:"Tsunami", em:"🏄", q:"Which sign on a beach or coastal road indicates a designated tsunami evacuation route?",
    opts:["A red circle with waves inside","A blue and white sign showing a person running toward a hill, with a wave symbol","A yellow triangle warning sign","A green arrow pointing to the sea"],
    ans:1, exp:"International tsunami evacuation route signs are blue and white, showing a stylised person running uphill away from a wave. These are standardised by UNESCO-IOC and are mandatory on marked evacuation routes." },

  // ─── WILDFIRE (25 questions) ──────────────────────────────────────────────
  { id:126, cat:"Wildfire", em:"🌲", q:"If trapped by a wildfire, which direction should you run?",
    opts:["Straight uphill (fire moves slowly uphill)","Into the wind","Downhill and perpendicular (sideways) to the fire","Into any building"],
    ans:2, exp:"Fire travels FASTEST uphill because heat rises and preheats vegetation above. Run downhill and sideways (perpendicular) to the fire's path. Drop heavy gear — speed saves your life." },
  { id:127, cat:"Wildfire", em:"🌲", q:"Why does wildfire travel faster uphill than on flat ground?",
    opts:["Wind always blows uphill","Heat rises, preheating fuel directly above the fire","Trees are drier on hillsides","Soil is thinner on slopes"],
    ans:1, exp:"Rising heat preheats vegetation above the fire, making it ignite faster and easier. A fire moving at 1km/h on flat ground can travel 10× faster uphill — making escape nearly impossible." },
  { id:128, cat:"Wildfire", em:"🌲", q:"The three conditions that create a high wildfire risk are known as the 'fire weather triangle'. These are:",
    opts:["Heat, wind, low humidity","Heat, fuel, and oxygen (the fire triangle)","Temperature, rainfall, and wind speed","Drought, soil type, and elevation"],
    ans:1, exp:"The fire triangle — heat, fuel, oxygen — determines whether fire starts and spreads. 'Fire weather' conditions (high temperature + low humidity + strong wind) accelerate all three, creating extreme danger." },
  { id:129, cat:"Wildfire", em:"🌲", q:"'Defensible space' around homes in wildfire-prone areas means:",
    opts:["A fireproof wall surrounding the property","Vegetation management creating a 30m buffer with low fuel loads","A legal minimum setback from the forest","A water reservoir for firefighting"],
    ans:1, exp:"Defensible space is managed vegetation within 30m of a structure to reduce fuel available to an approaching wildfire. Zone 1 (0–10m): non-combustible materials. Zone 2 (10–30m): well-spaced, low-growing plants." },
  { id:130, cat:"Wildfire", em:"🌲", q:"If you must shelter in place during a wildfire approaching your home, you should:",
    opts:["Open all windows to prevent pressure buildup","Close all windows and doors, fill bathtubs with water, lie on the floor","Go to the attic — it's far from ground flames","Leave the front door open for quick escape"],
    ans:1, exp:"Close all windows, vents, and doors to block embers. Fill bathtubs with water for firefighting. Keep house lights on so it's visible in smoke. Stay inside away from exterior walls until fire front passes." },
  { id:131, cat:"Wildfire", em:"🌲", q:"The most dangerous time for wildfires is during:",
    opts:["Early morning with dew","The afternoon heat when humidity is lowest and winds are strongest","Night time when temperatures drop","After rainfall"],
    ans:1, exp:"Wildfire danger peaks during afternoon hours when temperatures peak, humidity drops to its lowest, and wind speeds increase. This is when fires spread fastest and firefighting is most difficult." },
  { id:132, cat:"Wildfire", em:"🌲", q:"'Spotting' in wildfire terminology refers to:",
    opts:["Identifying fire from aircraft","Embers carried by wind that start new fires far ahead of the main fire front","The fire lookout tower system","Satellite detection of heat signatures"],
    ans:1, exp:"Spotting occurs when firebrands (burning embers) are carried by wind — sometimes kilometres ahead of the main fire — and ignite new fires. This can completely surround evacuees who thought they were safe." },
  { id:133, cat:"Wildfire", em:"🌲", q:"Which Indian states have the highest risk of forest/wildfire?",
    opts:["Kerala and Tamil Nadu only","Rajasthan and Gujarat (desert fires)","Uttarakhand, Himachal Pradesh, and northeastern states with dense forests","Uttar Pradesh and Bihar"],
    ans:2, exp:"Uttarakhand experiences severe annual wildfires in its Chir pine and oak forests. The northeastern states and Himachal Pradesh also face high risk. The 2021 Uttarakhand fires destroyed thousands of hectares in weeks." },
  { id:134, cat:"Wildfire", em:"🌲", q:"Smoke from wildfires is particularly harmful because it contains:",
    opts:["Only water vapour and carbon dioxide","Fine particulate matter (PM2.5), carbon monoxide, and toxic compounds from burning vegetation","Mostly nitrogen","Primarily sulfur dioxide"],
    ans:1, exp:"Wildfire smoke contains PM2.5 particles (penetrate deep into lungs), carbon monoxide, formaldehyde, and polycyclic aromatic hydrocarbons (carcinogens). Even brief exposure at high concentrations causes serious health effects." },
  { id:135, cat:"Wildfire", em:"🌲", q:"N95 masks protect against wildfire smoke because they filter:",
    opts:["Carbon monoxide gas","Particulate matter (PM2.5 and larger) — but NOT gases","All smoke components","Only bacteria and viruses"],
    ans:1, exp:"N95 respirators filter 95% of particulate matter including PM2.5. However, they do NOT filter gases (CO, VOCs). For full protection from wildfire smoke, a full-face respirator with both particulate and gas filters is needed." },
  { id:136, cat:"Wildfire", em:"🌲", q:"'Back burning' (or prescribed burning) is used in wildfire management to:",
    opts:["Fight a fire by burning in reverse","Deliberately burn vegetation in controlled conditions to remove fuel before a wildfire arrives","Mark boundaries of a protected zone","Create firebreaks using chemical agents"],
    ans:1, exp:"Prescribed burning removes accumulated fuel (dead wood, dry grass) in controlled conditions before wildfire season. When a wildfire arrives, it finds areas already burned with no fuel to sustain it — stopping its advance." },
  { id:137, cat:"Wildfire", em:"🌲", q:"The CORRECT action when you see a wildfire starting in a forest is:",
    opts:["Try to stamp it out yourself","Note the location and immediately call the Forest Fire Emergency (1926) or 112","Gather others to help fight it manually","Wait to confirm it's serious before reporting"],
    ans:1, exp:"Call Forest Fire Emergency at 1926 (Forest Department helpline) or 112 immediately. Report the exact location. Small fires can explode in minutes under dry conditions — never delay reporting." },
  { id:138, cat:"Wildfire", em:"🌲", q:"If caught in a wildfire in your vehicle, you should:",
    opts:["Drive as fast as possible","Pull off the road, turn engine off, close all vents, lie on the floor below window level, call 112","Stay on the road with windows open","Drive toward the fire to pass through quickly"],
    ans:1, exp:"If you cannot outrun the fire: Pull over, close all vents and windows, kill the engine, leave hazard lights on, get below window level on the floor (safest position), cover yourself with a blanket. The metal body provides some protection." },
  { id:139, cat:"Wildfire", em:"🌲", q:"Pine forests are more fire-prone than most deciduous forests because:",
    opts:["Pine trees are taller","Chir pine produces highly flammable resin and dry needles that accumulate as thick litter","Pine trees have thinner bark","Pines grow at higher elevations"],
    ans:1, exp:"Chir pine (Pinus roxburghii), dominant in Himalayan forests up to 2000m, produces resin-impregnated needles that form thick, highly flammable litter layers. This combined with resin in the trunk makes pine forests highly fire-prone." },
  { id:140, cat:"Wildfire", em:"🌲", q:"For people with asthma, wildfire smoke is especially dangerous because:",
    opts:["Smoke is hotter than normal air","Fine particles trigger bronchospasm and airway inflammation, causing potentially life-threatening attacks","Smoke contains more oxygen","Wildfire smoke only affects the elderly"],
    ans:1, exp:"Fine particles in wildfire smoke trigger severe bronchospasm and airway inflammation. Those with asthma or COPD can experience life-threatening attacks from levels of smoke that cause only mild discomfort in healthy people." },
  { id:141, cat:"Wildfire", em:"🌲", q:"The Indian Forest Act and state forest laws prohibit lighting fires near forests within what minimum distance?",
    opts:["100 metres","500 metres","1 kilometre","There is no fixed distance in Indian law"],
    ans:1, exp:"The Indian Forest Act 1927 and many state forest laws prohibit lighting fires within 500 metres of any forest area during fire season (typically February–June). Violations carry fines and imprisonment." },
  { id:142, cat:"Wildfire", em:"🌲", q:"In a wildfire 'burnover' survival situation (fire overtakes you in the open), you should:",
    opts:["Run in a zigzag pattern","Lie face down in a depression or ditch with feet pointing toward the fire, cover all exposed skin","Climb the nearest tall tree","Stand on the highest available ground"],
    ans:1, exp:"In a last-resort burnover: Find a depression (ditch, gully), lie FACE DOWN with feet toward the fire, cover all exposed skin, protect your airway with cloth, and hold still while the fire front passes." },
  { id:143, cat:"Wildfire", em:"🌲", q:"The 'red flag warning' for wildfire conditions means:",
    opts:["The area is actively burning","Conditions of low humidity, high winds, and dry fuel make fire extremely likely to start and spread rapidly","The area has been evacuated","A fire containment line has been established"],
    ans:1, exp:"Red flag warnings are issued when weather forecasts show conditions dangerous for rapid wildfire ignition and spread — typically relative humidity below 25%, wind speeds above 25 km/h, and vegetation moisture below critical levels." },
  { id:144, cat:"Wildfire", em:"🌲", q:"After a wildfire, mudslides become more likely because:",
    opts:["The ground is still hot","Fire destroys the vegetation root systems that hold soil in place, making it highly vulnerable to erosion when rain falls","Ash makes soil waterproof","Thermal expansion loosens rock"],
    ans:1, exp:"Vegetation roots bind soil and absorb rainfall. After fire destroys them, bare slopes become extremely vulnerable to mudslides even in moderate rainfall. Post-wildfire debris flows are a major secondary disaster." },
  { id:145, cat:"Wildfire", em:"🌲", q:"Wildfire smoke visibility reduction creates what road safety hazard?",
    opts:["Makes roads slippery","Severely reduces visibility, causing multi-vehicle pile-ups — particularly in mountainous areas","Creates mirages","Makes road markings invisible only"],
    ans:1, exp:"Dense wildfire smoke can reduce visibility to less than 100 metres on mountain roads, creating conditions for fatal pile-ups. Drive with headlights on, reduce speed dramatically, and avoid travel in smoke-affected areas." },
  { id:146, cat:"Wildfire", em:"🌲", q:"The most effective long-term strategy to reduce wildfire frequency in India's forests is:",
    opts:["Planting more trees","Community-based fire management combining controlled burns + early detection towers + local fire prevention education","Banning all forest entry","Increasing the number of professional firefighters"],
    ans:1, exp:"Research consistently shows community-based fire management (combining traditional controlled burning knowledge with modern detection and professional support) is the most cost-effective and sustainable wildfire management approach." },
  { id:147, cat:"Wildfire", em:"🌲", q:"What percentage of India's forest fires are caused by humans?",
    opts:["10–20%","About 50%","Over 90%","Lightning accounts for the majority"],
    ans:2, exp:"Studies by FSI (Forest Survey of India) show over 90% of forest fires in India are human-caused — through agricultural burning, poaching, negligent campfires, and deliberate arson. Lightning ignition is rare in tropical India." },
  { id:148, cat:"Wildfire", em:"🌲", q:"Forest Survey of India (FSI) monitors wildfire using:",
    opts:["Ground-based ranger patrols only","MODIS and VIIRS satellite sensors that detect active heat sources","Community phone reports only","Aerial surveillance aircraft"],
    ans:1, exp:"FSI uses NASA's MODIS (Moderate Resolution Imaging Spectroradiometer) and VIIRS (Visible Infrared Imaging Radiometer Suite) satellite sensors to detect active fire hotspots across India in near-real-time." },
  { id:149, cat:"Wildfire", em:"🌲", q:"Emergency responders fighting wildfires always carry a 'fire shelter'. This device:",
    opts:["Provides shade from sun","Is a last-resort aluminised tent that reflects radiant heat when deployed in a burnover","Contains oxygen supplies","Is a personal radio with heat protection"],
    ans:1, exp:"Fire shelters (aluminised tents deployed on the ground) are last-resort survival devices that reflect up to 95% of radiant heat during a burnover. They are not fireproof but can buy critical survival time." },
  { id:150, cat:"Wildfire", em:"🌲", q:"Which action should you take if you see someone illegally burning crop stubble near a forest?",
    opts:["Help them manage the fire","Photograph and report to the local Forest Department or call 1926","Ignore it — crop burning is legal","Attempt to extinguish it yourself"],
    ans:1, exp:"Stubble burning near forests is a major cause of wildfires and is regulated (or banned in many states). Report through the Forest Department helpline (1926), local panchayat, or 112. Document with photos if safe to do so." },

  // ─── LANDSLIDE (25 questions) ─────────────────────────────────────────────
  { id:151, cat:"Landslide", em:"⛰️", q:"Early warning signs of an approaching landslide include:",
    opts:["Clear sunny weather after rain","Cracks in the ground and tilting trees","Strong gusty winds","Hot dry weather"],
    ans:1, exp:"Warning signs: cracks in soil or roads, trees/utility poles leaning unusually, rumbling sounds from uphill, sudden changes in stream water colour or flow, and unusual seeping water." },
  { id:152, cat:"Landslide", em:"⛰️", q:"A landslide is approaching your car on a mountain road. You should:",
    opts:["Drive faster to outrun it","Pull over and shelter in the car","Abandon the car and run perpendicular (sideways) to the slide","Stop and warn oncoming vehicles"],
    ans:2, exp:"Landslides move at 80–200 km/h — no car can outrun one on mountain roads. Abandon the vehicle immediately and run SIDEWAYS off the flow path to stable high ground." },
  { id:153, cat:"Landslide", em:"⛰️", q:"What type of rainfall pattern is MOST likely to trigger a landslide?",
    opts:["Light drizzle over several weeks","Short intense downpours lasting under an hour","Prolonged heavy rainfall over days saturating soil, OR an intense sudden cloudburst","Morning dew and fog"],
    ans:2, exp:"Both prolonged rainfall (saturating soil) and sudden intense cloudburst events (flash-saturating slopes) are primary landslide triggers. The Kedarnath 2013 disaster was triggered by extreme cloudburst rainfall — over 200mm in 24 hours." },
  { id:154, cat:"Landslide", em:"⛰️", q:"The Kedarnath disaster of 2013 that killed 6,000+ people was caused by:",
    opts:["A major earthquake","Cloudbursts and glacial lake outburst causing massive landslides and floods","A dam failure","A typhoon"],
    ans:1, exp:"The 2013 Uttarakhand disaster was triggered by extremely heavy monsoon rainfall causing cloudbursts, glacial lake outburst (GLOF), and massive landslides, killing over 6,000 people in what became India's worst post-independence natural disaster." },
  { id:155, cat:"Landslide", em:"⛰️", q:"Areas most vulnerable to landslides include:",
    opts:["Flat river plains","Steep slopes with loose soil, deforested hillsides, areas disturbed by road construction","Dense forests on gentle slopes","Rocky deserts"],
    ans:1, exp:"Risk factors: steep slopes >30°, unconsolidated or weathered rock, deforestation (removes root binding), road and construction cuts that destabilise slopes, and proximity to earthquake zones or river undercutting." },
  { id:156, cat:"Landslide", em:"⛰️", q:"'Debris flow' is different from a regular landslide because:",
    opts:["It is slower and more predictable","It is a fast-moving mixture of water, rock, and soil that flows like liquid — moving far faster than dry landslides","It only occurs in volcanic areas","It creates no warning sounds"],
    ans:1, exp:"Debris flows are water-saturated landslides that behave like liquid, moving at 50–200+ km/h. They can travel far down valleys, filling them metres deep within minutes. They are extremely dangerous due to speed and reach." },
  { id:157, cat:"Landslide", em:"⛰️", q:"Before building a home on a hillside in India, which organisation should be consulted for landslide risk?",
    opts:["Indian Railways","Geological Survey of India (GSI)","National Highway Authority","BSNL tower division"],
    ans:1, exp:"The Geological Survey of India (GSI) conducts landslide hazard zonation mapping across hilly states. Local state geology departments and district authorities have hazard maps that should be consulted before any hillside construction." },
  { id:158, cat:"Landslide", em:"⛰️", q:"The best immediate action when you hear the characteristic 'rumbling' of a landslide above you is:",
    opts:["Run uphill toward the sound to investigate","Run downhill as fast as possible","Run horizontally (sideways) off the likely flow path immediately","Take shelter in a sturdy building"],
    ans:2, exp:"A rumbling sound indicates the slide is already moving. Run SIDEWAYS perpendicular to the slope to get out of the flow path. Running downhill keeps you directly in the landslide's path. You have only seconds to act." },
  { id:159, cat:"Landslide", em:"⛰️", q:"Road cuts in the Himalayas (for national highways) contribute to landslides by:",
    opts:["Increasing rainfall runoff","Removing the toe support of slopes that previously balanced the hillside, destabilising them and increasing erosion","Causing earthquakes through vibration","Increasing moisture in soil"],
    ans:1, exp:"Road cuts remove the lower support ('toe') of natural slopes, shifting the balance of forces and triggering failure of slopes that were stable for centuries. Combined with blasting, they are a primary driver of Himalayan landslide disasters." },
  { id:160, cat:"Landslide", em:"⛰️", q:"'Glacial Lake Outburst Flood' (GLOF) disasters in the Himalayas are related to landslides because:",
    opts:["Glacial lakes freeze solid in winter","The enormous water release from a GLOF can trigger catastrophic debris flows and landslides downstream","GLOFs only affect glaciers, not lower valleys","They cause earthquakes"],
    ans:1, exp:"When a glacial lake dam (moraine or ice) fails, it releases enormous volumes of water that can trigger massive downstream debris flows and landslides. Climate change is increasing GLOF risk across the Himalayas." },
  { id:161, cat:"Landslide", em:"⛰️", q:"After a landslide has passed, which hazard persists for days?",
    opts:["Fire from electrical lines only","Secondary slides, debris flow, and continued slope instability if rainfall continues","Nuclear contamination","Air pollution from dust only"],
    ans:1, exp:"Secondary landslides are extremely common — rainfall continues to saturate destabilised slopes, and the material that already moved has reduced stability for adjacent areas. Evacuated zones must remain closed until slopes are reassessed." },
  { id:162, cat:"Landslide", em:"⛰️", q:"Retaining walls on slopes can prevent landslides, but they fail most commonly due to:",
    opts:["Age alone","Water saturation overwhelming drainage holes — regular maintenance of drainage is critical","Earthquake vibration only","Impact from vehicles"],
    ans:1, exp:"Retaining walls fail most commonly when drainage is inadequate — water pressure builds behind the wall beyond its design capacity. Regular clearing of drainage holes (weep holes) and inspection are essential maintenance." },
  { id:163, cat:"Landslide", em:"⛰️", q:"Planting deep-rooted trees and vegetation on slopes helps prevent landslides by:",
    opts:["Increasing rainfall","Root systems binding soil particles together and absorbing water, reducing saturation","Creating habitat for landslide warning animals","Reducing wind speeds on slopes"],
    ans:1, exp:"Deep roots physically anchor soil particles, reducing mass movement. Roots also absorb water that would otherwise saturate soil and reduce shear strength. Deforestation is a primary cause of increased landslide frequency globally." },
  { id:164, cat:"Landslide", em:"⛰️", q:"Which Indian government programme specifically addresses landslide risk in hilly states?",
    opts:["MNREGA (rural employment)","National Landslide Risk Management Strategy (NLRMS) under NDMA","PM Awas Yojana","National Highway Development Programme"],
    ans:1, exp:"NDMA's National Landslide Risk Management Strategy provides a framework for hazard mapping, early warning, land-use planning, and capacity building in the 13 states identified as having high landslide risk." },
  { id:165, cat:"Landslide", em:"⛰️", q:"A 'rockfall' differs from a landslide because:",
    opts:["It occurs underwater","Individual rocks or blocks fall from steep cliffs, often with minimal warning — typically faster than landslides","It is triggered by earthquakes only","It involves less material"],
    ans:1, exp:"Rockfalls involve individual boulders or rock masses falling freely from steep cliffs at high speed with little or no warning. They are impossible to outrun and frequently kill motorists on mountain roads." },
  { id:166, cat:"Landslide", em:"⛰️", q:"If you are hiking and notice fresh tension cracks forming in the trail ahead, you should:",
    opts:["Step over them carefully and continue","Immediately turn back — these indicate imminent slope failure — and alert local authorities","Mark them for other hikers","Take photographs and post on social media"],
    ans:1, exp:"Tension cracks are one of the most critical pre-failure indicators — the slope is actively deforming and failure could occur within minutes to hours. Turn around immediately and alert forest departments and local authorities." },
  { id:167, cat:"Landslide", em:"⛰️", q:"'Creep' in geology (as related to landslides) refers to:",
    opts:["Very slow, nearly imperceptible downslope movement of soil and rock over years","Small insects that indicate soil instability","Water seeping slowly through rock","Gradual erosion of river banks"],
    ans:0, exp:"Soil creep is extremely slow (millimetres per year) downslope movement that may go unnoticed for years but eventually can lead to slope failure. Signs include tilting fence posts, curved tree trunks, and slowly offset roads." },
  { id:168, cat:"Landslide", em:"⛰️", q:"NDMA recommends what action for people living on steep slopes after 100mm of rainfall in 24 hours?",
    opts:["No action — rainfall alone does not trigger landslides","Monitor the situation and be ready to evacuate if warnings are issued","Immediately self-evacuate without waiting for official warnings","Reinforce the foundation of your home"],
    ans:1, exp:"100mm/24h is a general threshold at which landslide risk significantly increases in most Himalayan and Western Ghats zones. NDMA recommends close monitoring and readiness to evacuate at this level — do not wait for the slide to start." },
  { id:169, cat:"Landslide", em:"⛰️", q:"Deforestation in India's hills by which activities is most strongly linked to increased landslide frequency?",
    opts:["Water-harvesting construction","Logging, illegal construction on slopes, and encroachment of natural water channels","Agricultural terracing following traditional practices","Wildlife corridors"],
    ans:1, exp:"Commercial logging (removing root systems), illegal construction that cuts slopes, and encroachment on natural drainage channels are the three human activities most strongly linked to increased landslide frequency in India's hilly regions." },
  { id:170, cat:"Landslide", em:"⛰️", q:"Which instrument is used for automated landslide early warning on monitored slopes?",
    opts:["Barometer","Inclinometer / tiltmeter combined with rainfall sensors","Wind vane","Seismograph only"],
    ans:1, exp:"Modern landslide early warning systems combine inclinometers/tiltmeters (measuring slope deformation), piezometers (measuring groundwater pressure), and rainfall sensors. When thresholds are exceeded, automated SMS alerts are sent to residents." },
  { id:171, cat:"Landslide", em:"⛰️", q:"In 2021, the Chamoli Disaster (Uttarakhand) was primarily caused by:",
    opts:["A major earthquake","A rock-ice avalanche that triggered a glacial lake outburst, causing a devastating debris flow","Excessive rainfall","A dam failure"],
    ans:1, exp:"The February 2021 Chamoli disaster was caused by a massive rock-ice avalanche from Ronti Peak that generated a catastrophic debris flow destroying two hydroelectric projects. It highlighted the compound disaster risks in high-mountain environments." },
  { id:172, cat:"Landslide", em:"⛰️", q:"The CORRECT way to drive on a mountain road with rockfall warning signs is:",
    opts:["Drive as fast as possible to minimize time in the danger zone","Drive slowly with windows open, radio off, and maximum alertness — prepared to brake or reverse","Stay in the centre of the road","Maintain normal speed and stay on schedule"],
    ans:1, exp:"Drive slowly with full attention — debris can fall suddenly with no warning. Windows open allows you to hear falling rocks. Radio off allows you to hear rumbling. Slow speed gives reaction time. Be prepared to reverse if you hear rockfall." },
  { id:173, cat:"Landslide", em:"⛰️", q:"Which season carries the HIGHEST landslide risk in the Indian Himalayas and Western Ghats?",
    opts:["Winter (December–February)","Pre-monsoon (April–May)","Monsoon (June–September)","Post-monsoon (October–November)"],
    ans:2, exp:"The monsoon season (June–September) carries the highest landslide risk due to prolonged heavy rainfall saturating slopes. India experiences over 80% of its annual landslides during this period." },
  { id:174, cat:"Landslide", em:"⛰️", q:"A landslide dam forms when:",
    opts:["A dam is intentionally built to manage landslide debris","Landslide material blocks a river, creating a temporary lake upstream","Rock fall creates a waterfall","Floodwater deposits sediment across a road"],
    ans:1, exp:"Landslide dams form when slide material blocks a river. They are extremely dangerous — the trapped water lake can grow rapidly, and when the dam eventually fails (often within hours to months), it releases a catastrophic outburst flood." },
  { id:175, cat:"Landslide", em:"⛰️", q:"After a major landslide blocks a mountain road, you should NOT:",
    opts:["Call 112 to report the blockage","Wait in your vehicle well away from the slope","Attempt to drive over or around the debris immediately","Alert local authorities to the road closure"],
    ans:2, exp:"Never attempt to drive over or around fresh landslide debris — secondary slides are common, the ground is unstable, and hidden subsurface voids and water channels make the material extremely dangerous. Wait for official clearance." },

  // ─── HEATWAVE (25 questions) ──────────────────────────────────────────────
  { id:176, cat:"Heatwave", em:"🌡️", q:"A fan can actually WORSEN heat stroke when temperatures exceed:",
    opts:["30°C","35°C","40°C","45°C"],
    ans:2, exp:"Above 40°C, a fan only circulates dangerously hot air over the body, increasing heat stress rather than cooling it. Use water-based cooling methods or air conditioning instead." },
  { id:177, cat:"Heatwave", em:"🌡️", q:"The most vulnerable people during a heatwave are:",
    opts:["Athletes and sportspeople","Elderly, infants, and those with chronic illness","Adults aged 25–40","People who work nights"],
    ans:1, exp:"Elderly people lose temperature regulation ability. Infants cannot communicate distress. Chronic illness increases physiological vulnerability. Check on these groups first and move them to cooling centres." },
  { id:178, cat:"Heatwave", em:"🌡️", q:"Heat stroke differs from heat exhaustion because:",
    opts:["Heat stroke only affects the elderly","In heat stroke the body's cooling mechanism FAILS — body temperature rises above 40°C and it is a medical emergency","Heat exhaustion is more serious","They are the same condition"],
    ans:1, exp:"Heat exhaustion involves heavy sweating and weakness but the body is still cooling itself. Heat stroke is a medical emergency where the body's cooling mechanism fails, temperature exceeds 40°C, skin becomes hot and DRY, and organ damage begins." },
  { id:179, cat:"Heatwave", em:"🌡️", q:"How much water should adults drink per hour during intense outdoor work in extreme heat?",
    opts:["One large glass (250ml) per hour","One cup per 15–20 minutes (about 1 litre per hour)","Water only when thirsty","2 litres all at once in the morning"],
    ans:1, exp:"In extreme heat during physical activity, the body loses 1–2 litres of water per hour through sweat. Drink approximately one cup (200–250ml) every 15–20 minutes. Do NOT drink large amounts all at once." },
  { id:180, cat:"Heatwave", em:"🌡️", q:"Oral Rehydration Solution (ORS) is preferred over plain water during heatwave dehydration because:",
    opts:["It tastes better in heat","It replaces both water AND electrolytes (salts) lost through sweating — plain water alone can cause dangerous electrolyte imbalance","It contains vitamins that prevent heat stroke","It cools faster than water"],
    ans:1, exp:"ORS replaces water and essential electrolytes (sodium, potassium, chloride) lost through heavy sweating. Drinking only water during heavy sweat loss can cause hyponatremia (dangerous salt depletion) — a condition called 'water intoxication'." },
  { id:181, cat:"Heatwave", em:"🌡️", q:"NDMA recommends avoiding outdoor work between which hours during extreme heat?",
    opts:["6–9 AM","12 noon – 3 PM","5–7 PM","Outdoor work is always permitted"],
    ans:1, exp:"NDMA's heatwave guidelines recommend avoiding outdoor work during 12 noon–3 PM when solar radiation and temperatures peak. Outdoor workers (construction, agriculture) should shift to early morning and late evening hours." },
  { id:182, cat:"Heatwave", em:"🌡️", q:"What is the definition of a 'heatwave' according to India Meteorological Department?",
    opts:["Temperature above 30°C for any day","Maximum temperature of at least 40°C (plains) / 30°C (hills) AND at least 4.5°C above normal","Two consecutive days of sunshine","Temperature above 35°C with no rainfall for 5 days"],
    ans:1, exp:"IMD defines a heatwave as: maximum temperature reaching 40°C+ in plains (30°C in hills) AND a departure of 4.5°C or more above the normal for that date. Severe heatwave requires 6.5°C+ departure." },
  { id:183, cat:"Heatwave", em:"🌡️", q:"Cooling centres during heatwaves are typically established in:",
    opts:["High-rise buildings at the top floor","Government schools, community halls, hospitals — shaded, ventilated, or air-conditioned public buildings","Beach areas near the sea","Industrial zones"],
    ans:1, exp:"Cooling centres are established in accessible, centrally located public buildings — schools, community halls, temples, hospitals — that are shaded and ideally air-conditioned. NDMA state-specific action plans identify these in advance." },
  { id:184, cat:"Heatwave", em:"🌡️", q:"Which clothing choice is BEST for reducing heat stress?",
    opts:["Tight black synthetic clothing","Loose, light-coloured cotton or linen clothing that covers the skin","Dark clothing to absorb heat","Thick clothing to prevent water loss"],
    ans:1, exp:"Loose cotton or linen allows air circulation and wicks sweat. Light colours reflect solar radiation. Dark tight synthetic fabrics trap heat and block evaporative cooling. In strong sun, covering skin is better than exposing it — covered skin stays cooler." },
  { id:185, cat:"Heatwave", em:"🌡️", q:"Heat cramps during a heatwave should be treated with:",
    opts:["Complete rest with no fluids for 2 hours","Light stretching and ORS / sports drinks to replace electrolytes","Aspirin to reduce muscle inflammation","Immersion in ice water"],
    ans:1, exp:"Heat cramps are muscle spasms caused by salt and fluid depletion. Move to cool shade, rest, and drink electrolyte-replacement fluids (ORS, buttermilk, sports drinks). Do NOT use plain water alone or return to activity until cramps completely resolve." },
  { id:186, cat:"Heatwave", em:"🌡️", q:"Urban 'heat islands' make city temperatures hotter than surrounding rural areas because:",
    opts:["Cities are built at lower elevations","Concrete and asphalt absorb and re-radiate heat, while less vegetation means less cooling through evapotranspiration","Air pollution traps cold air","Wind speeds are lower in cities"],
    ans:1, exp:"Urban heat islands form because dark impervious surfaces (roads, buildings) absorb far more solar radiation than vegetation, and lack of plants removes natural cooling (evapotranspiration). Cities can be 2–5°C hotter than nearby rural areas." },
  { id:187, cat:"Heatwave", em:"🌡️", q:"Heat-related illness in children during heatwaves is particularly linked to:",
    opts:["Physical activity levels","Being left in parked cars — temperatures inside cars can exceed 50°C within minutes","Drinking too much water","Getting sunburned"],
    ans:1, exp:"A parked car on a 35°C day can reach 65°C inside within minutes. Children have died from heat stroke after being left in cars briefly. NEVER leave a child in a parked car even with windows cracked." },
  { id:188, cat:"Heatwave", em:"🌡️", q:"Traditional Indian summer practices that effectively combat heatwaves include:",
    opts:["Only air conditioning","Earthen pot (matka) water cooling, cotton clothing, eating water-rich foods like cucumber and buttermilk, staying indoors at midday","Spicy food to induce sweating","Cold carbonated drinks"],
    ans:1, exp:"Traditional practices are scientifically sound: matka water is cooler through evaporation, cotton breathes, cucumbers/lassi/buttermilk hydrate with electrolytes. These practices evolved in Indian climates precisely to manage heat." },
  { id:189, cat:"Heatwave", em:"🌡️", q:"Wet Bulb Globe Temperature (WBGT) is a better measure of heat danger than air temperature alone because:",
    opts:["It measures underground soil temperature","It combines temperature, humidity, and solar radiation — showing how much the body can actually cool itself","It is used only for industrial workers","It is more accurate than thermometers"],
    ans:1, exp:"WBGT accounts for temperature, humidity, wind, and solar radiation — the factors that determine how effectively the body can cool through sweating. At high humidity, even moderate temperatures become dangerous because sweat doesn't evaporate." },
  { id:190, cat:"Heatwave", em:"🌡️", q:"The Indian state with the MOST heatwave-related deaths historically is:",
    opts:["Rajasthan","Andhra Pradesh / Telangana","Maharashtra","Punjab"],
    ans:1, exp:"Andhra Pradesh and Telangana have historically recorded the highest heatwave death tolls in India. The 2015 heatwave killed over 2,500 people across both states. Factors include extreme temperatures (48°C+), outdoor agricultural labour, and limited access to cooling." },
  { id:191, cat:"Heatwave", em:"🌡️", q:"What should you do if you find someone unconscious in a heatwave?",
    opts:["Give them water to drink","Move to cool shade immediately, cool the body with wet cloth and ice packs, call 112 — do NOT give fluids to unconscious persons","Leave them and call 112 without moving them","Fan them vigorously"],
    ans:1, exp:"Move to shade, cool the body immediately (wet cloth, ice packs on neck/armpits/groin), and call 112. NEVER give fluids to an unconscious person — risk of aspiration. The body core temperature must be reduced urgently." },
  { id:192, cat:"Heatwave", em:"🌡️", q:"Solar radiation is most intense (peak UV) between:",
    opts:["6–9 AM","10 AM – 2 PM","4–6 PM","Depends on cloud cover only"],
    ans:1, exp:"UV radiation peaks between 10 AM and 2 PM regardless of temperature. Even on overcast days, 80% of UV penetrates clouds. Both heat AND UV exposure risk are highest in this window — avoid and protect if you must be out." },
  { id:193, cat:"Heatwave", em:"🌡️", q:"Extreme heat increases the toxicity of which common air pollutant?",
    opts:["Sulfur dioxide","Ground-level ozone (O₃) — formed faster at higher temperatures","Carbon monoxide","Nitrogen oxide"],
    ans:1, exp:"Ground-level ozone forms when sunlight reacts with NOx and VOCs — both reactions accelerate at higher temperatures. Heatwaves dramatically increase ozone formation, adding respiratory health risk on top of direct heat stress." },
  { id:194, cat:"Heatwave", em:"🌡️", q:"India's National Action Plan on Heat-Related Illnesses (NAPHI) was developed by:",
    opts:["NDMA alone","NDMA in coordination with the Ministry of Health and Family Welfare and IMD","WHO only","State governments independently"],
    ans:1, exp:"NAPHI was developed through coordination between NDMA, MoHFW, and IMD to establish national protocols for heatwave preparedness, heat action plans at state and district levels, and standardised treatment for heat illness." },
  { id:195, cat:"Heatwave", em:"🌡️", q:"The best way to cool a car before entering it in extreme heat is:",
    opts:["Run the AC for 10 minutes with the car doors closed","Open all doors and windows for 1–2 minutes to ventilate, then run AC","Pour cold water on the exterior","Park in direct sun to pre-heat the AC"],
    ans:1, exp:"Opening all doors for 1–2 minutes releases the trapped hot air (which can be 30°C hotter than outside). Then run AC with windows cracked initially to flush remaining hot air before closing windows. Never get into a car that has been sitting in direct sun without ventilating first." },
  { id:196, cat:"Heatwave", em:"🌡️", q:"Physical activity during a heatwave should be:",
    opts:["Maintained to build heat tolerance","Reduced or eliminated during peak heat hours — schedule essential activity for early morning or evening","Increased to promote sweating and cooling","Unchanged if you are physically fit"],
    ans:1, exp:"Even physically fit individuals are at risk of heat illness during extreme heatwaves. Exercise raises core temperature — combined with extreme ambient heat, the body cannot cool effectively. Reschedule to early morning or after sunset." },
  { id:197, cat:"Heatwave", em:"🌡️", q:"Alcohol and caffeinated beverages should be avoided during a heatwave because:",
    opts:["They taste bad in heat","They are diuretics that INCREASE fluid loss through urination, worsening dehydration","They lower blood pressure dangerously","They are only restricted for medical patients"],
    ans:1, exp:"Both alcohol and caffeine are diuretics — they increase urine output and fluid loss. During a heatwave when you are already fluid-stressed, they significantly worsen dehydration and heat illness risk." },
  { id:198, cat:"Heatwave", em:"🌡️", q:"A 'Heat Action Plan' at district level in India should include:",
    opts:["Only hospital protocols","Early warning systems + cooling centres + awareness campaigns + health sector preparedness + inter-agency coordination","Only public health messaging","Temperature forecasting only"],
    ans:1, exp:"Comprehensive Heat Action Plans integrate: IMD early warnings, designated cooling centres, public awareness campaigns in local languages, hospital protocols (IV fluids, ice packs), ambulance readiness, and coordination between health, municipal, and disaster management authorities." },
  { id:199, cat:"Heatwave", em:"🌡️", q:"Heat-safe home design principles for India include:",
    opts:["Maximising glass windows for natural light and heat","Roof gardens or white-painted roofs (cool roofs), cross-ventilation, overhangs, and thermal mass walls","Open plan designs with minimal walls","Basements for all homes"],
    ans:1, exp:"Cool roofs (white/reflective) reduce roof surface temperature by 30°C+. Green roofs provide insulation. Cross-ventilation uses natural breeze. Deep overhangs shade walls. Thermal mass walls (thick stone/brick) absorb daytime heat and release it at night." },
  { id:200, cat:"Heatwave", em:"🌡️", q:"What is the emergency cooling technique called 'ice sheet method' recommended for severe heat stroke?",
    opts:["Wrapping the patient in a dry ice pack","Covering the patient with a wet sheet and fanning to maximise evaporative cooling while awaiting ambulance","Immersing the patient in ice water","Applying dry ice directly to skin"],
    ans:1, exp:"The ice sheet method (evaporative cooling): drench a sheet in cold water, wrap the patient, and fan vigorously. Evaporation removes heat rapidly. This is the most practical pre-hospital cooling technique. Do NOT use ice directly on skin — it constricts blood vessels and reduces cooling." },

  // ─── TORNADO (25 questions) ───────────────────────────────────────────────
  { id:201, cat:"Tornado", em:"🌪️", q:"Caught in a tornado warning while driving — the safest action is:",
    opts:["Shelter under a bridge or overpass","Drive perpendicular and find a sturdy building with a basement","Stay in the car with seatbelt on","Accelerate faster than the tornado"],
    ans:1, exp:"Bridge underpasses create lethal wind tunnels. Drive perpendicular to the tornado's track and find the nearest sturdy building with a basement or interior ground-floor room." },
  { id:202, cat:"Tornado", em:"🌪️", q:"If no building is available during a tornado, you should:",
    opts:["Climb the nearest tall tree","Lie FLAT in the lowest ditch or depression","Stand on high ground for visibility","Shelter under your car"],
    ans:1, exp:"As a last resort, lie FLAT in a low ditch and cover your head with your hands. Never shelter under a car. Avoid trees and power lines. The goal is to be as low as possible." },
  { id:203, cat:"Tornado", em:"🌪️", q:"Tornadoes in India most commonly occur in:",
    opts:["Summer (April–June) mainly in eastern India (West Bengal, Bihar, Odisha)","Only during monsoon season","Winter (December–February) in northern India","They do not occur in India"],
    ans:0, exp:"India experiences tornadoes called 'Nor'westers' or 'Kalboishakhi' in West Bengal, Bihar, and Odisha during pre-monsoon season (April–June). These are often associated with violent thunderstorms and can cause significant local damage." },
  { id:204, cat:"Tornado", em:"🌪️", q:"The Fujita (EF) scale rates tornado intensity from EF0 to EF5. An EF5 tornado has winds of:",
    opts:["Over 100 km/h","Over 200 km/h","Over 320 km/h (200 mph)","Over 500 km/h"],
    ans:2, exp:"EF5 tornadoes have winds exceeding 322 km/h (200 mph) and can destroy well-constructed homes completely, deform steel-reinforced concrete, and hurl cars hundreds of metres. Survival above ground in an EF5 path is rare." },
  { id:205, cat:"Tornado", em:"🌪️", q:"Tornado warning vs. tornado watch: which is more urgent?",
    opts:["Watch — it covers a larger area","Warning — conditions are right for a tornado to form","They are equal in urgency","Neither requires immediate action"],
    ans:1, exp:"A Tornado WARNING means a tornado has been spotted or detected on radar — take shelter IMMEDIATELY. A Tornado WATCH means conditions are right for tornado formation — be alert and ready to shelter." },
  { id:206, cat:"Tornado", em:"🌪️", q:"Inside a building during a tornado, you should go to:",
    opts:["The highest floor for maximum visibility","Near windows to monitor the tornado","The lowest floor or basement, in an interior room away from windows","The main entrance hall"],
    ans:2, exp:"Go to the lowest floor (basement preferred), interior room (away from windows), and get under something sturdy. Upper floors and exterior walls have the most structural exposure and window danger from flying debris." },
  { id:207, cat:"Tornado", em:"🌪️", q:"A tornado's 'debris cloud' at ground level indicates:",
    opts:["The tornado is weakening","The tornado is at its most intense and making ground contact — carrying lethal projectiles","Rainfall is starting","The tornado is changing direction"],
    ans:1, exp:"A large dark debris cloud at ground level indicates the tornado is in intense contact with the surface, shredding and lofting everything in its path. The debris cloud can extend far beyond the visible condensation funnel." },
  { id:208, cat:"Tornado", em:"🌪️", q:"Opening windows before a tornado to equalise pressure is:",
    opts:["Recommended — it prevents the building from exploding","A dangerous myth — it wastes precious seconds and does not prevent structural damage","Required by building codes","Only for wooden buildings"],
    ans:1, exp:"Opening windows is a completely debunked myth — buildings are NOT pressurised and do not 'explode' from internal pressure. Opening windows wastes the critical seconds you should use to get to shelter and may allow dangerous debris into your shelter area." },
  { id:209, cat:"Tornado", em:"🌪️", q:"Mobile homes and temporary structures during a tornado are dangerous because:",
    opts:["They are made of lighter materials that conduct electricity","They provide no protection at all — a tornado easily destroys or rolls them, even if tied down","Only older mobile homes are dangerous","They lack lightning rods"],
    ans:1, exp:"Mobile homes are extremely vulnerable to tornado winds — they can be destroyed even by EF0 tornadoes. NEVER shelter in a mobile home during a tornado warning. Go to the nearest sturdy building or designated shelter immediately." },
  { id:210, cat:"Tornado", em:"🌪️", q:"A 'rope tornado' is:",
    opts:["The most dangerous type","A thin, twisting tornado typically in its dissipating stage — but still capable of causing damage","A tornado that picks up power lines","A water tornado (waterspout)"],
    ans:1, exp:"A rope tornado is the thin, sinuous appearance a tornado takes on during its dissipating stage. Though weakening, rope tornadoes can still be EF2+ and cause significant damage. Do not emerge from shelter until tornado watches/warnings are lifted." },
  { id:211, cat:"Tornado", em:"🌪️", q:"The most dangerous object during a tornado is:",
    opts:["Water from flooding","Airborne debris — glass, timber, metal, and vehicles travelling at tornado wind speeds","Electrical discharges","Ground movement"],
    ans:1, exp:"90%+ of tornado injuries and deaths are caused by flying debris. At 200+ km/h, a piece of wood becomes a lethal projectile, glass becomes razor shards, and vehicles become crushing weights. Protecting yourself from debris is the primary goal." },
  { id:212, cat:"Tornado", em:"🌪️", q:"How much warning time does an average tornado typically provide?",
    opts:["None — they are entirely unpredictable","Under 5 minutes from first visible formation to ground impact","About 13 minutes average with modern radar","30+ minutes from weather watch issue"],
    ans:2, exp:"Modern Doppler radar technology provides an average of 13 minutes of warning before a tornado strikes. This is barely enough time for nearby residents to shelter. Having a pre-planned shelter location is critical." },
  { id:213, cat:"Tornado", em:"🌪️", q:"Nor'westers (Kalbaisakhi) in West Bengal are associated with which type of cloud?",
    opts:["Stratus (flat layer) clouds","Cumulonimbus (thunderstorm) clouds with anvil tops","Cirrus (high, wispy) clouds","Fog banks"],
    ans:1, exp:"Nor'westers form within violent Cumulonimbus thunderstorm cells with towering anvil-shaped tops. They bring sudden violent winds, hail, and intense rainfall. Their approach is visible — a dark wall of cloud advancing from the northwest." },
  { id:214, cat:"Tornado", em:"🌪️", q:"After a tornado passes, which is the most common secondary cause of death?",
    opts:["Cold exposure","Electrocution from downed power lines and structural collapse from entering damaged buildings","Starvation","Toxic fumes"],
    ans:1, exp:"Post-tornado deaths commonly result from: downed power lines (electrocution), re-entering structurally compromised buildings that then collapse, gas leaks, and flood water in basements. The first priority is reporting your safety and waiting for professional clearance." },
  { id:215, cat:"Tornado", em:"🌪️", q:"Supercell thunderstorms are significant for tornado preparedness because:",
    opts:["They always produce tornadoes","They are the type of storm MOST likely to produce strong, long-track tornadoes","They produce only rain, not wind","They are predictable 24 hours in advance"],
    ans:1, exp:"Supercell thunderstorms are the most organised and powerful thunderstorm type, featuring rotating updrafts (mesocyclones). They are responsible for virtually all significant tornadoes. When supercells are forecast, tornado watches are typically issued." },
  { id:216, cat:"Tornado", em:"🌪️", q:"In the absence of a basement, the best tornado shelter inside a building is:",
    opts:["Near large windows for visibility","A closet or bathroom on the lowest floor in the centre of the building — surrounded by the most walls","The largest room with the most space","A room at the corner of the building for structural support"],
    ans:1, exp:"Interior rooms (bathroom, closet) on the lowest floor are surrounded by the maximum number of walls to deflect debris. Avoid corners, which accumulate debris. Bathrooms have the added benefit of plumbing walls that add structural integrity." },
  { id:217, cat:"Tornado", em:"🌪️", q:"Which precaution helps protect you from tornado debris inside a shelter?",
    opts:["Sitting upright facing the tornado direction","Covering yourself with a mattress, heavy blankets, or overturned couch cushions to protect from flying debris","Opening windows to see the tornado","Standing against the interior wall"],
    ans:1, exp:"Covering yourself with a mattress, thick blankets, or furniture cushions provides critical protection from flying debris and glass even within an interior shelter. Helmets are also recommended in tornado-prone areas." },
  { id:218, cat:"Tornado", em:"🌪️", q:"Waterspouts (tornadoes over water) are:",
    opts:["Always weaker than land tornadoes","Sometimes as strong as EF3 tornadoes — coastal communities in India should treat waterspout warnings seriously","Only found in tropical oceans","Not capable of moving onto land"],
    ans:1, exp:"Waterspouts can be as strong as EF3 tornadoes and CAN move onto shore. Coastal areas of India experience waterspouts, and coastal/port communities should evacuate to sturdy shelter when waterspout warnings are issued." },
  { id:219, cat:"Tornado", em:"🌪️", q:"India's disaster alert for tornadic activity is typically issued by:",
    opts:["NDMA directly to public phones","IMD thunderstorm/squall line alerts — listen for 'severe thunderstorm warning with risk of localised tornadoes'","Forest Department","Coast Guard only for waterspouts"],
    ans:1, exp:"IMD issues severe thunderstorm and squall line warnings that include risk of tornado-like activity for Nor'wester-affected regions. These are disseminated through NDMA's Common Alert Protocol, All India Radio, and state disaster management authorities." },
  { id:220, cat:"Tornado", em:"🌪️", q:"The sound often described just before a tornado strikes is:",
    opts:["Silence — no warning sound","A freight train or jet engine roar — a loud sustained continuous roar","Heavy rainfall sound","Thunder clap"],
    ans:1, exp:"People who have survived tornadoes consistently describe hearing a persistent loud roar like a freight train, jet engine, or waterfall that does NOT stop. This distinctive sound, heard even without visibility, is a critical last-moment warning to take immediate shelter." },
  { id:221, cat:"Tornado", em:"🌪️", q:"After a tornado, food safety in the home requires:",
    opts:["Eating all refrigerated food immediately","Discarding any food that has been touched by floodwater or contaminated debris; boil water until municipal water safety is confirmed","Only checking canned goods","Refrigerated food is always safe"],
    ans:1, exp:"Tornado-caused flooding contaminates all food it touches. Floodwater carries sewage and chemicals. Discard any food that has been in contact with flood or storm water. Treat municipal water as unsafe until official confirmation." },
  { id:222, cat:"Tornado", em:"🌪️", q:"For farmers and agricultural workers during a tornado warning, the safest action is:",
    opts:["Shelter in the nearest farm building","Abandon all equipment immediately and shelter in a sturdy building — farm buildings are NOT safe","Use a tractor as shelter","Lie flat in the open field only as a last resort"],
    ans:1, exp:"Farm buildings (barns, sheds) are among the most dangerous places during a tornado — they are large, often poorly constructed, and can collapse catastrophically. Abandon all equipment and reach the nearest sturdy permanent building." },
  { id:223, cat:"Tornado", em:"🌪️", q:"A 'multiple vortex tornado' is:",
    opts:["Two separate tornados that merge","A single tornado containing several smaller rotating sub-vortices that dramatically increase localised wind speeds","A tornado that changes direction repeatedly","A waterspout that moves to land"],
    ans:1, exp:"Multiple vortex tornadoes contain two or more sub-vortices rotating around a common centre. The interaction of these sub-vortices creates dramatically elevated wind speeds in narrow damage paths within the main tornado." },
  { id:224, cat:"Tornado", em:"🌪️", q:"Hail is significant in tornado preparedness because:",
    opts:["It indicates the tornado is weakening","Large hail is often a precursor to tornado development — if large hail is observed, take shelter immediately even before a tornado warning is issued","Hail and tornadoes never occur together","It only affects vehicles"],
    ans:1, exp:"Large hail (golf ball size or larger) often precedes tornado development within the same storm cell. Observing large hail without a warning is a valid reason to take immediate shelter without waiting for official confirmation." },
  { id:225, cat:"Tornado", em:"🌪️", q:"Emergency plans for schools in tornado-prone areas (like West Bengal) should include:",
    opts:["Evacuation to open ground during tornado warnings","Practised shelter-in-place drills to interior corridors/rooms — schools should NOT evacuate students during a tornado warning","Only plans for senior classes","Reliance on teacher judgement during the event"],
    ans:1, exp:"Schools should NOT evacuate students during a tornado warning — moving students outdoors or in vehicles increases danger. Shelter-in-place in interior corridors or rooms, practised through regular drills, is the correct protocol." },
];

/* ══════════════════════════════════════════════════
   AWARENESS MODE — 10 Situations per Disaster (100 total)
══════════════════════════════════════════════════ */
const SCENARIOS = [
  // ─── EARTHQUAKE (10 scenarios) ───────────────────────────────────────────
  { id:"eq1", disaster:"Earthquake", em:"🌍", col:"#dc2626", sfx:"quake",
    title:"Office Building — Magnitude 7.2 Strike",
    alert:"🚨 EARTHQUAKE ALERT — MAGNITUDE 7.2 HIT",
    alertSub:"Shaking expected 45–90 seconds",
    desc:"You're working on the 3rd floor of an office building. The ground starts violently shaking. Ceiling tiles are falling. Glass is shattering. A heavy bookshelf is toppling toward you.",
    bg:"linear-gradient(170deg,#1a0600,#2a0e00,#0a0200)",
    shake:true,
    choices:[
      { text:"🛗 Use the elevator to get to ground floor fast", correct:false, explain:"❌ DEATH TRAP — Elevators during earthquakes are lethal. Power fails, shafts collapse, doors jam. You can be crushed or trapped for hours." },
      { text:"🦆 Drop under the desk, cover head, hold on", correct:true, explain:"✅ TEXTBOOK PERFECT — Drop-Cover-Hold On is scientifically proven to save lives. The desk protects your head from falling debris." },
      { text:"🚪 Stand in the doorframe", correct:false, explain:"❌ OUTDATED MYTH — Doorframe protection was 1950s advice for mud-brick buildings. In modern structures, it provides zero special protection." },
      { text:"🏃 Sprint outside through the stairwell immediately", correct:false, explain:"❌ FATAL MISTAKE — Never run during active shaking. Falling debris and broken glass kill more people than the ground movement itself." },
    ]},
  { id:"eq2", disaster:"Earthquake", em:"🌍", col:"#dc2626", sfx:"quake",
    title:"Post-Earthquake Gas Leak & Aftershock",
    alert:"⚠️ AFTERSHOCK EXPECTED — GAS LEAK DETECTED",
    alertSub:"Building structurally compromised — evacuate",
    desc:"Shaking has stopped. You sheltered under a desk. The building has visible cracks, there's a strong gas smell from the kitchen area, and an aftershock is expected within minutes.",
    bg:"linear-gradient(170deg,#1a0600,#2a0e00)",
    shake:false,
    choices:[
      { text:"🛗 Use the elevator — it's faster", correct:false, explain:"❌ NEVER — Even after shaking stops, elevator shafts may be damaged. They can fail between floors. Always use stairs after an earthquake." },
      { text:"🚶 Walk calmly down the stairs with head covered", correct:true, explain:"✅ CORRECT! Calm staircase evacuation is right. Move to open ground away from all buildings before calling for help." },
      { text:"📱 Go back to desk to grab your phone and wallet", correct:false, explain:"❌ NO — Never linger in a structurally compromised building for belongings. Aftershocks can trigger collapse within minutes." },
      { text:"🪟 Jump from the 3rd floor window to escape faster", correct:false, explain:"❌ FATAL — A 3rd floor fall causes severe injury or death. Use the stairs regardless of how slow it feels." },
    ]},
  { id:"eq3", disaster:"Earthquake", em:"🌍", col:"#dc2626", sfx:"quake",
    title:"Night Earthquake — Trapped in Bedroom",
    alert:"🚨 EARTHQUAKE — MAGNITUDE 6.8",
    alertSub:"Aftershocks likely — building damage reported",
    desc:"A powerful earthquake wakes you at 3 AM. Your bedroom door is jammed. You smell smoke. Debris has fallen across the room and you cannot see clearly in the dark.",
    bg:"linear-gradient(170deg,#050000,#1a0500)",
    shake:true,
    choices:[
      { text:"🔦 Turn on the light switch to see clearly", correct:false, explain:"❌ DANGEROUS — Electrical sparks near a gas leak can cause an explosion. Do not use any electrical switches after an earthquake with potential gas damage." },
      { text:"🔔 Stay calm, use a whistle or tap on metal to signal rescuers, conserve energy", correct:true, explain:"✅ CORRECT! Tapping on pipes signals rescue teams effectively while conserving your energy. Avoid breathing dust — cover mouth." },
      { text:"🚪 Force the door and run out immediately through the smoke", correct:false, explain:"❌ RISKY — The source and extent of the fire are unknown. Moving through smoke without knowing escape route can be fatal." },
      { text:"📱 Post your location on social media and wait", correct:false, explain:"❌ POOR CHOICE — Post only if no call is possible. Calling 112 directly connects you to emergency services faster than social media." },
    ]},
  { id:"eq4", disaster:"Earthquake", em:"🌍", col:"#dc2626", sfx:"quake",
    title:"Crowded Market — Earthquake Strikes",
    alert:"🚨 EARTHQUAKE — MAGNITUDE 5.9 HIT URBAN AREA",
    alertSub:"Crowd crush risk — multiple structures at risk",
    desc:"You are in a crowded indoor market. Shelves are toppling. Panicking crowds are rushing toward the exits. Glass is falling from the ceiling. You are near the centre of the hall.",
    bg:"linear-gradient(170deg,#180400,#300a00)",
    shake:true,
    choices:[
      { text:"🏃 Rush toward the exit with the crowd", correct:false, explain:"❌ CRUSH RISK — Stampedes in panicking crowds kill people through compression asphyxia. Narrow exits become death traps. Do not join a stampede." },
      { text:"🦆 Drop immediately, cover head, hold against a stable pillar", correct:true, explain:"✅ RIGHT — Pillar/column bases are structural support points. Drop low, cover head. Let shaking stop before moving. Avoid stampede." },
      { text:"🪑 Stack chairs to create an elevated safe zone", correct:false, explain:"❌ WASTE OF TIME — Secondary hazards from falling items will hit you during active shaking. Drop and cover immediately." },
      { text:"📢 Shout for everyone to run to the exits loudly", correct:false, explain:"❌ AMPLIFIES DANGER — Loud shouting triggers panic stampede. If you can help, calmly direct people to cover, not movement." },
    ]},
  { id:"eq5", disaster:"Earthquake", em:"🌍", col:"#dc2626", sfx:"quake",
    title:"Driving on Highway — Earthquake Strikes",
    alert:"⚠️ EARTHQUAKE — ROAD DAMAGE POSSIBLE",
    alertSub:"Bridges and overpasses at risk",
    desc:"You're driving on a highway when the car starts moving strangely and the ground beneath the road appears to be rippling. Other cars have stopped. A bridge overpass is 200m ahead.",
    bg:"linear-gradient(170deg,#0a0300,#1e0700)",
    shake:false,
    choices:[
      { text:"🚗 Accelerate to cross the bridge before it collapses", correct:false, explain:"❌ SUICIDAL — Accelerating toward a bridge during an earthquake is extremely dangerous. The bridge may be in the process of failing." },
      { text:"🅿️ Pull over away from bridges and overpasses, stay inside car", correct:true, explain:"✅ CORRECT! Stop away from bridges, overpasses, and buildings. Stay inside the car as it provides partial protection from debris. Put on hazard lights." },
      { text:"🚶 Get out and run away from the road", correct:false, explain:"❌ RISKY — Getting out near moving vehicles and road surface instability is dangerous. The car is generally safer than the open road." },
      { text:"🔄 Turn back and drive home the way you came", correct:false, explain:"❌ WRONG — Roads behind you may also be damaged. Stop and assess. Do not drive until you know road conditions are safe." },
    ]},
  { id:"eq6", disaster:"Earthquake", em:"🌍", col:"#dc2626", sfx:"quake",
    title:"School — Earthquake During Class",
    alert:"🚨 EARTHQUAKE — SCHOOL EVACUATION PROTOCOL",
    alertSub:"Duck and cover — teacher leading protocol",
    desc:"You are a student in a ground-floor classroom. The earthquake starts. Your teacher has not given instructions yet. There are large windows on both sides. The door is open.",
    bg:"linear-gradient(170deg,#140200,#250600)",
    shake:true,
    choices:[
      { text:"🪟 Run to the window to see what's happening outside", correct:false, explain:"❌ GLASS DANGER — Windows shatter during earthquakes and glass shards are lethal. Move AWAY from windows at all times." },
      { text:"🦆 Get under your desk immediately and cover your neck", correct:true, explain:"✅ EXACTLY RIGHT — School desks provide cover from falling debris and ceiling tiles. This is NDMA-recommended protocol for students." },
      { text:"🏃 Run out the open door immediately", correct:false, explain:"❌ DO NOT RUN DURING SHAKING — Running during active shaking increases injury risk from falling objects and unstable floors." },
      { text:"📱 Text your parents to tell them about the earthquake", correct:false, explain:"❌ PHONE CAN WAIT — Protect yourself first. The phone is not a priority during active shaking. Cover and hold on." },
    ]},
  { id:"eq7", disaster:"Earthquake", em:"🌍", col:"#dc2626", sfx:"quake",
    title:"Apartment — High-Rise Tremor",
    alert:"⚠️ TREMOR DETECTED — BUILDING SWAY ALERT",
    alertSub:"High-rise occupants feel amplified shaking",
    desc:"You are on the 18th floor of an apartment building. The building is swaying significantly. Your flatmate says 'let's run down the stairs now before it gets worse!'",
    bg:"linear-gradient(170deg,#080100,#150300)",
    shake:true,
    choices:[
      { text:"🏃 Run down 18 flights of stairs immediately with your flatmate", correct:false, explain:"❌ DANGEROUS — Running down stairs during shaking is extremely hazardous. High floors also SWAY MORE — this is normal and does not mean collapse." },
      { text:"🦆 Drop under sturdy furniture, cover head, hold on until shaking stops", correct:true, explain:"✅ CORRECT — Stay put and cover up. High-rise swaying is normal seismic behaviour in flexible buildings. Do NOT use stairs during active shaking." },
      { text:"🪟 Open a window and signal for help from outside", correct:false, explain:"❌ NOT HELPFUL — Opening a window exposes you to glass shattering risk and exterior debris. Stay interior and covered." },
      { text:"🛗 Call the elevator and wait for it", correct:false, explain:"❌ NEVER — Elevators in seismic events are death traps. Never use elevators during or after an earthquake." },
    ]},
  { id:"eq8", disaster:"Earthquake", em:"🌍", col:"#dc2626", sfx:"quake",
    title:"Beach — Earthquake Triggers Tsunami Warning",
    alert:"🚨 EARTHQUAKE M7.8 — TSUNAMI ADVISORY ISSUED",
    alertSub:"Coastal evacuation — move inland NOW",
    desc:"You feel a very strong earthquake while on the beach. It lasts 90 seconds. As it stops, you notice the sea starting to pull back. The tsunami siren has not yet sounded.",
    bg:"linear-gradient(170deg,#000c14,#0d1c30)",
    shake:false,
    choices:[
      { text:"🐟 Walk toward the retreating water — fascinating to see the seafloor", correct:false, explain:"❌ FATAL CURIOSITY — Ocean drawback is the most unmistakable tsunami signal. You have minutes at most. Running away from shore is the ONLY option." },
      { text:"📸 Take photos of the unusual sight then run", correct:false, explain:"❌ NO TIME — Every second counts. A tsunami triggered by a nearby M7.8 can arrive in under 10 minutes. Run NOW." },
      { text:"🏃 Run to the highest ground or furthest inland point immediately without waiting for sirens", correct:true, explain:"✅ LIFE-SAVING — The shaking + ocean drawback ARE your warning. Never wait for sirens. Run to 30m elevation or 3km inland immediately." },
      { text:"🏨 Shelter in the ground-floor beach hotel nearby", correct:false, explain:"❌ WRONG — Ground floor coastal buildings are inundated first. You need HEIGHT — upper floors of an RCC building or inland high ground." },
    ]},
  { id:"eq9", disaster:"Earthquake", em:"🌍", col:"#dc2626", sfx:"quake",
    title:"Post-Earthquake — Helping Trapped Survivor",
    alert:"⚠️ AFTERSHOCKS CONTINUING — SEARCH & RESCUE",
    alertSub:"Civilian rescue protocol in effect",
    desc:"30 minutes after the earthquake, you find a conscious person trapped under a collapsed wall section. They can speak. Aftershocks are still occurring. You are alone.",
    bg:"linear-gradient(170deg,#1c0500,#0a0200)",
    shake:false,
    choices:[
      { text:"💪 Try to lift the wall section yourself immediately", correct:false, explain:"❌ SECONDARY COLLAPSE RISK — Moving unstable debris without support equipment can trigger further collapse and injure both of you." },
      { text:"📞 Call 112, keep them calm, mark your location visibly, wait for NDRF/rescue teams", correct:true, explain:"✅ CORRECT — Call emergency services immediately. Keep the victim calm and awake. Mark location with cloth/signal. Do not move heavy debris alone." },
      { text:"🏃 Leave to get help from nearby buildings", correct:false, explain:"❌ DO NOT LEAVE — Keep the victim conscious and calm. Call 112 from your position. Leaving may mean losing the location or the victim losing consciousness." },
      { text:"💧 Pour water on them and wait", correct:false, explain:"❌ INCOMPLETE — Calling 112 and marking location are the critical actions. Water may help comfort but professional rescue is the priority." },
    ]},
  { id:"eq10", disaster:"Earthquake", em:"🌍", col:"#dc2626", sfx:"quake",
    title:"Earthquake — Returning Home After 24 Hours",
    alert:"⚠️ RE-ENTRY ADVISORY — STRUCTURAL ASSESSMENT ONGOING",
    alertSub:"Wait for official clearance before re-entering",
    desc:"24 hours after a major earthquake, you want to return to your apartment to retrieve medicines and documents. Authorities have not yet issued a re-entry clearance.",
    bg:"linear-gradient(170deg,#100200,#200500)",
    shake:false,
    choices:[
      { text:"🏠 Enter quickly while no one is watching — just 5 minutes", correct:false, explain:"❌ DANGEROUS — Structurally compromised buildings can collapse without warning. Even seconds inside a damaged building can be fatal after a major earthquake." },
      { text:"⏳ Wait for the official structural clearance — ask authorities about urgent medicine needs", correct:true, explain:"✅ CORRECT — Wait for clearance. Emergency services can often arrange supervised brief entry for critical items like medicines. Patient compliance saves lives." },
      { text:"👷 Ask a neighbour to check if it looks safe from outside", correct:false, explain:"❌ INSUFFICIENT — External appearance does not indicate internal structural integrity. Only a qualified structural engineer assessment is reliable." },
      { text:"📞 Call the building manager who will know if it's safe", correct:false, explain:"❌ NOT ADEQUATE — Building managers are not structural engineers. Official post-earthquake safety assessment by qualified engineers is the only reliable method." },
    ]},

  // ─── FLOOD (10 scenarios) ─────────────────────────────────────────────────
  { id:"fl1", disaster:"Flash Flood", em:"🌊", col:"#2563eb", sfx:"flood",
    title:"Flash Flood — Car Submerging in Street",
    alert:"🚨 FLASH FLOOD — WATER RISING 30cm/MINUTE",
    alertSub:"Abandon vehicles — move to high ground",
    desc:"You are driving when a flash flood hits. Floodwater is rising rapidly — already at your car door level. The current is strong. Your phone shows water rising 30cm per minute.",
    bg:"linear-gradient(170deg,#020c1e,#0d2840)",
    shake:false,
    choices:[
      { text:"🚗 Stay in the car — it's safer inside", correct:false, explain:"❌ TRAP — A car can be swept away in 2 feet of water. At 30cm/minute, your cabin will fill within 3 minutes. Staying inside means drowning." },
      { text:"🏃 Abandon car immediately, move to highest visible ground", correct:true, explain:"✅ CORRECT! Abandon the vehicle without hesitation. Move perpendicular to the flow toward high ground." },
      { text:"🚀 Drive faster to escape the flooded zone", correct:false, explain:"❌ IMPOSSIBLE — At door-level depth, your engine will stall. Flooded roads may be completely washed away beneath the surface." },
      { text:"🪟 Open the window and wait for emergency rescue", correct:false, explain:"❌ TOO DANGEROUS — At 30cm/minute, the cabin fills in 3–4 minutes. Emergency services cannot reach you in time. Act now." },
    ]},
  { id:"fl2", disaster:"Flood", em:"🌊", col:"#2563eb", sfx:"flood",
    title:"Flood Entering Home — Elderly Person Inside",
    alert:"⚠️ FLOODWATER ENTERING YOUR HOME",
    alertSub:"Knee-deep and rising — 2 minutes to act",
    desc:"Floodwater is entering your ground-floor home at knee depth and rising fast. You have roughly 2 minutes. Your 78-year-old grandmother is in the bedroom. There is a 2-storey building next door.",
    bg:"linear-gradient(170deg,#020c1e,#0d2840)",
    shake:false,
    choices:[
      { text:"🏠 Move grandmother to the upper floor or 2-storey building", correct:true, explain:"✅ RIGHT! Vertical evacuation — move vulnerable people to the highest available floor immediately." },
      { text:"🧱 Sandbag the front door to stop the water", correct:false, explain:"❌ TOO LATE — When water is already inside at knee depth, sandbags are completely ineffective. People first, property second." },
      { text:"⏳ Wait and see if the water level stabilises", correct:false, explain:"❌ FATAL DELAY — Flash floods can rise 1 metre in under 5 minutes. By the time it's obvious it won't stop, moving may be impossible." },
      { text:"🏊 Swim grandmother to the nearest emergency centre", correct:false, explain:"❌ VERY DANGEROUS — Floodwater hides debris, live electrical cables, and open manholes. Do not enter floodwater." },
    ]},
  { id:"fl3", disaster:"Flood", em:"🌊", col:"#2563eb", sfx:"flood",
    title:"Flood Trapped on Rooftop — Rescue Signal",
    alert:"🚨 URBAN FLOOD — ROOFTOP RESCUE OPERATIONS",
    alertSub:"Do not attempt to swim — wait for boats",
    desc:"You and three family members are stranded on your rooftop. Floodwater has engulfed the entire street. You can see a rescue boat about 400m away but it hasn't spotted you yet.",
    bg:"linear-gradient(170deg,#010a18,#0a2038)",
    shake:false,
    choices:[
      { text:"🏊 Your adult son swims to the rescue boat to guide them to you", correct:false, explain:"❌ EXTREMELY DANGEROUS — Urban floodwater contains submerged debris, open manholes, electrical cables, and strong currents. Even strong swimmers die in floodwater." },
      { text:"🚩 Signal with bright cloth, torch, or mirror to attract the boat's attention", correct:true, explain:"✅ CORRECT! Signal from safety — bright fabric, torch flash, or mirror reflection attracts rescuers without anyone entering dangerous floodwater." },
      { text:"📢 All four shout as loudly as possible", correct:false, explain:"⚠️ PARTIAL — Shouting can help if the boat is close, but signal visually first. 400m is too far for shouting to be reliably heard over flood noise." },
      { text:"🚗 Try to use your car to drive out — the water may be shallow enough", correct:false, explain:"❌ NO — If you are stranded on a rooftop, the street water is NOT shallow enough to drive through. Stay on the rooftop until rescue." },
    ]},
  { id:"fl4", disaster:"Flood", em:"🌊", col:"#2563eb", sfx:"flood",
    title:"Flood Warning — To Evacuate or Stay?",
    alert:"⚠️ FLOOD WARNING — VOLUNTARY EVACUATION ADVISED",
    alertSub:"River breach possible within 3–6 hours",
    desc:"A flood warning has been issued — a voluntary evacuation order. You have an elderly parent, a car, and adequate fuel. Your neighbour says 'I've seen worse — I'm staying.'",
    bg:"linear-gradient(170deg,#020c1e,#051830)",
    shake:false,
    choices:[
      { text:"🧘 Stay — it's voluntary, not mandatory, and neighbour knows better", correct:false, explain:"❌ WRONG — 'Voluntary' means 'we strongly recommend you leave before it becomes mandatory.' With an elderly parent and a car, leaving is the safe and responsible choice." },
      { text:"🚗 Evacuate immediately with elderly parent to designated shelter", correct:true, explain:"✅ CORRECT — Evacuating early with transportation available is always the right choice. Shelters are prepared. Leave before the 'voluntary' becomes impossible." },
      { text:"⏳ Wait for a mandatory order before acting — to avoid unnecessary disruption", correct:false, explain:"❌ RISKY — By the time a mandatory order is issued, roads may be flooded. Early voluntary evacuation is always safer for vulnerable individuals." },
      { text:"🧱 Stay and sandbag the entire house perimeter", correct:false, explain:"❌ INADEQUATE — With a river breach possible and an elderly parent, no sandbag system is worth the risk when you have the means to leave." },
    ]},
  { id:"fl5", disaster:"Flood", em:"🌊", col:"#2563eb", sfx:"flood",
    title:"Wading Through Flooded Street",
    alert:"⚠️ STREET FLOODING — CHEST-DEEP IN PLACES",
    alertSub:"Electrocution risk from submerged lines",
    desc:"You must walk 300m through a flooded street to reach your vehicle on higher ground. The water is knee-deep but you can see areas ahead where it looks deeper. Power lines are down.",
    bg:"linear-gradient(170deg,#010810,#08203a)",
    shake:false,
    choices:[
      { text:"🔌 Wade near the downed power lines — they're probably de-energised", correct:false, explain:"❌ LETHAL ASSUMPTION — NEVER assume downed power lines are de-energised. Electrocution in floodwater can incapacitate you several metres from the source." },
      { text:"🦯 Wade using a long stick to probe depth ahead, staying far from power lines", correct:true, explain:"✅ CORRECT — Probing ahead detects open manholes and sudden depth drops. Maintain maximum distance from downed lines. Shuffle feet; don't lift them." },
      { text:"🏃 Move quickly to get through the flood zone faster", correct:false, explain:"❌ DANGEROUS — Moving quickly in floodwater makes it impossible to probe ahead and increases the chance of stepping into an open manhole or losing balance in current." },
      { text:"🤽 Swim — it's faster than wading", correct:false, explain:"❌ NO — Swimming in urban floodwater dramatically increases exposure to debris, chemicals, and sewage. Wade slowly if you must move at all." },
    ]},
  { id:"fl6", disaster:"Flood", em:"🌊", col:"#2563eb", sfx:"flood",
    title:"Child Swept by Floodwater — Rescue Attempt",
    alert:"🚨 SWIFT WATER RESCUE — CHILD IN CURRENT",
    alertSub:"Reach-Throw-Don't-Go protocol",
    desc:"You are on a footbridge. A child has fallen into fast-flowing floodwater below and is being swept toward a culvert 50m downstream. You have no life ring but have a 10m rope.",
    bg:"linear-gradient(170deg,#010c20,#041c3e)",
    shake:false,
    choices:[
      { text:"🤽 Jump in and swim to the child — you are a good swimmer", correct:false, explain:"❌ TWO LIVES AT RISK — Even strong swimmers are quickly overcome by swift floodwater. 'Reach-Throw-Don't-Go' is the rescue protocol. Entering the water risks both lives." },
      { text:"🪢 Throw one end of the rope to the child, brace yourself on the bridge", correct:true, explain:"✅ CORRECT — Throw a rope from safety. Brace against the bridge rail. Call 112 simultaneously. This is the Reach-Throw-Don't-Go protocol." },
      { text:"🔔 Only shout for help and wait for professional rescuers", correct:false, explain:"⚠️ PARTIALLY RIGHT but INCOMPLETE — Calling for help is necessary, but you have a rope — use it. Every second the child approaches the culvert." },
      { text:"🌉 Run to the end of the bridge and try to grab the child physically as they pass", correct:false, explain:"❌ RISKY — Leaning over to grab a person in fast current can pull you in. Use the rope as an extension from a braced position." },
    ]},
  { id:"fl7", disaster:"Flood", em:"🌊", col:"#2563eb", sfx:"flood",
    title:"Contaminated Post-Flood Water Supply",
    alert:"⚠️ WATER SAFETY ADVISORY — SUPPLY CONTAMINATED",
    alertSub:"Boil-water notice in effect for your area",
    desc:"The flood has receded. A boil-water notice is in effect. Your family of 4 needs water urgently. You have a functioning gas stove, empty bottles, and the tap is running again.",
    bg:"linear-gradient(170deg,#020b18,#061a30)",
    shake:false,
    choices:[
      { text:"🚰 Drink the tap water carefully — it looks clear", correct:false, explain:"❌ DANGEROUS — Flood-contaminated water can be clear in appearance but contain lethal pathogens (cholera, typhoid). A boil-water notice means exactly what it says." },
      { text:"🫗 Boil tap water vigorously for 1 minute (3 minutes above 2000m) before drinking", correct:true, explain:"✅ CORRECT — Boiling is the most reliable purification method available in a home. Store cooled boiled water in clean sealed containers." },
      { text:"❄️ Put water in the freezer — freezing kills all bacteria", correct:false, explain:"❌ MYTH — Freezing does NOT kill waterborne pathogens. Only boiling, chemical treatment, or UV purification makes flood-contaminated water safe." },
      { text:"🧴 Add a drop of soap to the water — it will neutralise bacteria", correct:false, explain:"❌ COMPLETELY WRONG — Soap does not purify water. It is toxic in drinking water. Use only boiling, approved chemical tablets, or official bottled supplies." },
    ]},
  { id:"fl8", disaster:"Flood", em:"🌊", col:"#2563eb", sfx:"flood",
    title:"Night Flash Flood — Camping in River Valley",
    alert:"🚨 FLASH FLOOD WARNING — RIVER RISING RAPIDLY",
    alertSub:"Upstream dam release — vacate river banks immediately",
    desc:"Your camping group is sleeping in tents in a scenic river valley. Your phone suddenly blares a government emergency alert about an upstream dam release. It is 2 AM. The river is 50m away.",
    bg:"linear-gradient(170deg,#000811,#050f22)",
    shake:false,
    choices:[
      { text:"⛺ Stay in tents — they provide wind and water protection", correct:false, explain:"❌ FATAL — A dam release flood can arrive as a 3–5 metre wall of water with no further warning. A tent provides ZERO protection. Evacuate to high ground immediately." },
      { text:"🏃 Wake everyone, grab only phones and car keys, move to highest available ground immediately", correct:true, explain:"✅ LIFE-SAVING — Government emergency alerts are real and urgent. Every second counts with a dam release. High ground — possessions are irrelevant." },
      { text:"🔦 Go to the river bank to assess how fast it's rising before deciding", correct:false, explain:"❌ DEADLY — A dam release flood can travel faster than you can run. By the time you see it, there is no time to reach safety. The alert IS your warning." },
      { text:"🚗 Quickly pack the campsite then drive out", correct:false, explain:"❌ TOO SLOW — Packing wastes critical minutes. A dam release flood can cover river valley camping areas in under 10 minutes. Grab keys, leave everything else." },
    ]},
  { id:"fl9", disaster:"Flood", em:"🌊", col:"#2563eb", sfx:"flood",
    title:"Urban Flood — Electric Substation Flooded",
    alert:"🚨 ELECTRICAL HAZARD — SUBSTATION INUNDATED",
    alertSub:"Electrocution risk — entire block evacuate",
    desc:"You are attempting to evacuate your block during urban flooding. You see that the neighbourhood electrical substation is submerged. Street lights are flickering. The water around the substation is glowing faintly blue.",
    bg:"linear-gradient(170deg,#010810,#040f28)",
    shake:false,
    choices:[
      { text:"⚡ Wade past the substation quickly on one side", correct:false, explain:"❌ POTENTIALLY LETHAL — Water conducts electricity. A substation discharging into floodwater can electrocute you many metres away. The glowing water IS the warning." },
      { text:"🔄 Take a completely different route entirely avoiding the substation area", correct:true, explain:"✅ CORRECT — Any route that bypasses the substation is safer. Report the electrified water to 112 and to the electricity board immediately so the block can be isolated." },
      { text:"🦵 Test the water with your foot first before wading", correct:false, explain:"❌ NO — Electrical current in water at the right voltage can be lethal before you feel it. Your foot cannot reliably detect safe vs. lethal conditions." },
      { text:"📢 Warn others verbally and then wade through quickly", correct:false, explain:"❌ WARNS OTHERS but still risks your life — You need to go around the area, not through it, regardless of how urgent evacuation feels." },
    ]},
  { id:"fl10", disaster:"Flood", em:"🌊", col:"#2563eb", sfx:"flood",
    title:"Landslide-Dam Failure — Downstream Flood",
    alert:"🚨 LANDSLIDE DAM FAILURE UPSTREAM",
    alertSub:"Catastrophic outburst flood expected — evacuate valley immediately",
    desc:"You are in a valley town. Emergency broadcast announces a landslide dam upstream has failed, releasing a massive volume of water. Estimated arrival: 25 minutes. The town is in a narrow valley.",
    bg:"linear-gradient(170deg,#050800,#0d1600)",
    shake:false,
    choices:[
      { text:"🏠 Move to the second floor of your house", correct:false, explain:"❌ INSUFFICIENT — A landslide dam outburst can produce a 10–20 metre wall of debris-laden water. Two floors is not enough in a narrow valley. You need HILLSIDE elevation." },
      { text:"🏃 Run immediately to the hillside — highest point accessible in 25 minutes", correct:true, explain:"✅ CORRECT — With 25 minutes, you have time to reach hillside high ground. This is a rare opportunity — most outburst flood warnings give less than 10 minutes. Move NOW." },
      { text:"🚗 Drive along the valley road to exit downstream", correct:false, explain:"❌ WRONG DIRECTION — The flood will travel down the valley. Driving downstream puts you in the path of the flood. Drive or run perpendicular — toward the valley walls/hillside." },
      { text:"⏳ Wait for official evacuation vehicle to pick you up", correct:false, explain:"❌ TOO RISKY — Official vehicles may not reach everyone in 25 minutes in a narrow valley. Self-evacuation to high ground is faster and more reliable with the time available." },
    ]},

  // ─── CYCLONE (10 scenarios) ───────────────────────────────────────────────
  { id:"cy1", disaster:"Cyclone", em:"🌀", col:"#7c3aed", sfx:"wind",
    title:"Cyclone Category 4 — Mandatory Evacuation",
    alert:"🚨 CYCLONE ALERT — MANDATORY EVACUATION ISSUED",
    alertSub:"Category 4 landfall in 2 hours — 180+ km/h winds",
    desc:"A Category 4 cyclone is making landfall in 2 hours. You live 3km from the coast. A mandatory evacuation order has been issued. Your home is a traditional brick structure.",
    bg:"linear-gradient(170deg,#060012,#0a1808)",
    shake:false,
    choices:[
      { text:"🏠 Stay home — brick walls will protect you", correct:false, explain:"❌ WRONG — Category 4 winds (180+ km/h) can destroy brick structures entirely. Mandatory evacuation orders are not suggestions." },
      { text:"🏛️ Go to the government cyclone shelter immediately", correct:true, explain:"✅ CORRECT! Government cyclone shelters are engineered to withstand extreme cyclone conditions. Always follow mandatory evacuation orders." },
      { text:"🚗 Drive to a relative's house 50km inland", correct:false, explain:"❌ RISKY — Roads may be closed or dangerous as the cyclone approaches. The official shelter is purpose-built and far safer." },
      { text:"🛖 Shelter on the roof for visibility and airflow", correct:false, explain:"❌ SUICIDAL — The roof is the most exposed surface during a cyclone. Flying debris at 180 km/h penetrates concrete." },
    ]},
  { id:"cy2", disaster:"Cyclone", em:"🌀", col:"#7c3aed", sfx:"wind",
    title:"Eye of the Cyclone — False Calm",
    alert:"⚠️ EYE OF CYCLONE PASSING OVER — DO NOT EXIT",
    alertSub:"Dangerous back wall arriving in 20–45 minutes",
    desc:"You are in the government shelter. The howling wind suddenly stops. It is eerily calm outside. People around you are saying 'it's finally over!' and preparing to leave.",
    bg:"linear-gradient(170deg,#060012,#0a1808)",
    shake:false,
    choices:[
      { text:"🚶 Go outside — the storm is definitely over", correct:false, explain:"❌ DEADLY — This is the eye. The back wall carries winds as violent as the front wall. Do NOT go outside." },
      { text:"🛡️ Stay inside — this is the dangerous eye of the storm", correct:true, explain:"✅ CORRECT! The eye is temporary and deceptive. Stay sheltered and keep others calm until official all-clear." },
      { text:"🏠 Quickly go home and come back before the second wave", correct:false, explain:"❌ IMPOSSIBLE — The eye passes in 20–45 minutes. You will be caught in the open when the back wall hits." },
      { text:"🪟 Open all shelter windows for fresh air", correct:false, explain:"❌ BAD IDEA — Keep the shelter fully sealed. When the second wall hits, open windows allow catastrophic water ingress." },
    ]},
  { id:"cy3", disaster:"Cyclone", em:"🌀", col:"#7c3aed", sfx:"wind",
    title:"Pre-Cyclone — Securing Home Quickly",
    alert:"⚠️ CYCLONE WARNING — 12 HOURS TO LANDFALL",
    alertSub:"Category 3 — Secure property and prepare to evacuate",
    desc:"A cyclone warning is issued with 12 hours to landfall. You have decided to stay due to an elderly bedridden relative. You have one hour to secure your home.",
    bg:"linear-gradient(170deg,#04000e,#080018)",
    shake:false,
    choices:[
      { text:"🪟 Tape large X marks on all glass windows — this prevents them shattering", correct:false, explain:"❌ MYTH — Window taping does NOT prevent windows from breaking. It only means larger glass shards. Board up windows or apply shutters instead." },
      { text:"🏠 Bring all loose outdoor items inside, board or shutter windows, fill water containers", correct:true, explain:"✅ CORRECT! Remove flying missile hazards, protect windows from debris impact, and store water (supply may fail post-cyclone). The correct priority order." },
      { text:"🚗 Load everything valuable into the car and drive inland", correct:false, explain:"❌ IF YOU STAY, STAY — The decision is made. Use the hour to secure the home properly rather than partially evacuate belongings." },
      { text:"📱 Spend the hour calling relatives to inform them of the situation", correct:false, explain:"❌ WRONG PRIORITY — Securing the home takes precedence over communication. Make one quick call, then focus on physical preparation." },
    ]},
  { id:"cy4", disaster:"Cyclone", em:"🌀", col:"#7c3aed", sfx:"wind",
    title:"Cyclone Storm Surge — Coastal Inundation",
    alert:"🚨 STORM SURGE — COASTAL AREAS FLOODED",
    alertSub:"3–5 metre storm surge hitting coastline",
    desc:"You are in a cyclone shelter 2km inland. The cyclone has made landfall. Reports are coming in that storm surge is 4 metres high — higher than expected. Water is visible 500m away.",
    bg:"linear-gradient(170deg,#040010,#0a0020)",
    shake:false,
    choices:[
      { text:"🚶 Leave the shelter and walk to higher ground 3km away", correct:false, explain:"❌ FATAL DURING PEAK CYCLONE — Moving outside during peak storm surge in an active cyclone is suicidal. Category 4 winds will be lethal." },
      { text:"🏛️ Stay in the certified cyclone shelter — it is designed for storm surge", correct:true, explain:"✅ CORRECT — Certified cyclone shelters are built above maximum surge levels and are structurally rated for surge pressure. Trust the engineering. Stay put." },
      { text:"🏠 Run back to your concrete house which is on a slight rise", correct:false, explain:"❌ DON'T LEAVE — Even a slightly elevated house is not rated for storm surge and cyclone winds. The shelter is far safer." },
      { text:"📞 Call NDRF to be rescued", correct:false, explain:"❌ NOT POSSIBLE DURING ACTIVE CYCLONE — Emergency operations cannot send rescuers during active peak cyclone conditions. Stay in your certified shelter." },
    ]},
  { id:"cy5", disaster:"Cyclone", em:"🌀", col:"#7c3aed", sfx:"wind",
    title:"Cyclone — Fisher Folk at Sea",
    alert:"🚨 CYCLONE SIGNAL 4 — ALL BOATS RETURN PORT",
    alertSub:"24 hours to landfall — seas becoming dangerous",
    desc:"You are a fisherman 80km offshore. The radio announces Cyclone Signal 4. Some crew members want to continue fishing for one more hour to fill the catch.",
    bg:"linear-gradient(170deg,#000c18,#020e20)",
    shake:false,
    choices:[
      { text:"⚓ Anchor and wait out the storm at sea — anchored boats are stable", correct:false, explain:"❌ SUICIDAL — Cyclone seas become 8–15 metre waves within hours. No anchored boat survives open-ocean cyclone conditions. All crew will die." },
      { text:"🛥️ Return to port immediately at maximum speed — every hour of delay increases danger", correct:true, explain:"✅ CORRECT — With a Category 4 cyclone 24 hours away, sea conditions are already deteriorating. Returning now is the only safe option. No catch is worth a life." },
      { text:"🎣 One more hour then return — Signal 4 means 24 hours away, plenty of time", correct:false, explain:"❌ WRONG — Sea conditions deteriorate BEFORE the cyclone arrives. 24-hour landfall means dangerous seas in 6–8 hours. Every delay reduces survival chance." },
      { text:"📡 Wait for Signal 5 — that's the highest level and true emergency", correct:false, explain:"❌ DANGEROUS DELAY — By Signal 5, attempting to reach port may be impossible. Fishermen must respond to Signal 2 or 3. Signal 4 is a maximum emergency for vessels at sea." },
    ]},
  { id:"cy6", disaster:"Cyclone", em:"🌀", col:"#7c3aed", sfx:"wind",
    title:"Cyclone Aftermath — Structural Assessment",
    alert:"⚠️ POST-CYCLONE — BUILDING INSPECTION ONGOING",
    alertSub:"Multiple structures at risk — do not re-enter without clearance",
    desc:"The cyclone has passed. Your ground-floor home has visible damage — part of the roof is missing and one wall shows cracks. You want to check for valuables inside.",
    bg:"linear-gradient(170deg,#040010,#050015)",
    shake:false,
    choices:[
      { text:"🏠 Enter carefully for just 10 minutes to check essential items", correct:false, explain:"❌ DANGEROUS — A partially collapsed roof and cracked walls indicate structural compromise. The building can fail without further warning — even from aftershocks or remaining wind gusts." },
      { text:"⏳ Wait for structural inspection clearance before re-entering", correct:true, explain:"✅ CORRECT — Post-cyclone building inspection before re-entry is mandatory. Report your address to local authorities for priority inspection if needed for medicines." },
      { text:"🔍 Walk around the outside to assess if it looks safe, then enter if OK", correct:false, explain:"❌ INSUFFICIENT — External observation cannot detect internal damage. A structurally sound-looking exterior can collapse when you step inside." },
      { text:"🧱 Reinforce the cracked wall with sandbags and then enter", correct:false, explain:"❌ WRONG — Sandbags cannot stabilise a structurally compromised wall. Only engineer-supervised repair can make the building safe." },
    ]},
  { id:"cy7", disaster:"Cyclone", em:"🌀", col:"#7c3aed", sfx:"wind",
    title:"Cyclone — Downed Power Lines on Road",
    alert:"⚠️ ELECTRICAL HAZARD — DOWNED LINES REPORTED",
    alertSub:"Do not touch or approach fallen cables",
    desc:"After the cyclone, you are driving to check on your parents. You encounter a power line lying across the road. It is touching the wet asphalt. You need to pass this road.",
    bg:"linear-gradient(170deg,#040010,#06001a)",
    shake:false,
    choices:[
      { text:"🚗 Drive over it quickly — rubber tyres insulate from electricity", correct:false, explain:"❌ LETHAL MYTH — Rubber tyres do NOT reliably insulate against high-voltage lines. If the line is energised, driving over it can complete the circuit through the vehicle's frame." },
      { text:"🔄 Turn around, take another route, report the line to electricity board and 112", correct:true, explain:"✅ CORRECT — Never approach or drive over downed power lines. Report to the state electricity board and 112 for de-energisation. Take an alternate route." },
      { text:"🦺 Get out and move the power line off the road with a wooden stick", correct:false, explain:"❌ EXTREMELY DANGEROUS — Wood is not a reliable insulator at power line voltages. This approach has killed people who thought they were being safe." },
      { text:"📢 Alert other drivers by standing near the line and waving them down", correct:false, explain:"❌ WRONG — Standing near a live downed power line risks electrocution if water creates a conductive path. Alert others from a safe distance of at least 10 metres." },
    ]},
  { id:"cy8", disaster:"Cyclone", em:"🌀", col:"#7c3aed", sfx:"wind",
    title:"Cyclone Warning — Island Community No Shelter",
    alert:"🚨 CYCLONE — NO FORMAL SHELTER ON ISLAND",
    alertSub:"Fishermen's island — improvised shelter needed",
    desc:"You are on a small coastal island with no government cyclone shelter. A Category 3 cyclone is 8 hours away. The island has: a concrete community hall (old, partial roof), a reinforced concrete school building (new), dense coconut trees.",
    bg:"linear-gradient(170deg,#040012,#060019)",
    shake:false,
    choices:[
      { text:"🌴 Shelter within the dense coconut trees — natural wind protection", correct:false, explain:"❌ LETHAL — Coconut palms in cyclonic winds become lethal projectile launchers. Coconuts travel at lethal speeds. Never shelter in or near palm trees during a cyclone." },
      { text:"🏫 Use the new reinforced concrete school building — strongest structure available", correct:true, explain:"✅ CORRECT — The newest, most strongly built structure is always the best choice. New RCC construction meeting modern building codes is the most reliable shelter." },
      { text:"🏛️ Use the old community hall — larger, fits everyone", correct:false, explain:"❌ RISKY — Partial roof means structural compromise. An old building with roof damage is far more vulnerable in cyclone-force winds than a newer intact structure." },
      { text:"🚤 Try to boat to mainland before the cyclone arrives", correct:false, explain:"❌ DEPENDS ON TIME — With 8 hours to arrival, seas are already dangerous. Unless it's a very short, protected route in a reliable vessel, remaining in the strongest building is safer." },
    ]},
  { id:"cy9", disaster:"Cyclone", em:"🌀", col:"#7c3aed", sfx:"wind",
    title:"Cyclone Season Preparation — Coastal Household",
    alert:"⚠️ CYCLONE SEASON PREP — CHECKLIST REVIEW",
    alertSub:"Start of cyclone season — is your household ready?",
    desc:"It is the start of cyclone season. You live in coastal Odisha. Your neighbour asks what single preparation is MOST important to do first before the season begins.",
    bg:"linear-gradient(170deg,#030010,#050018)",
    shake:false,
    choices:[
      { text:"🔋 Buy extra batteries and torches", correct:false, explain:"⚠️ USEFUL but not the MOST important — Equipment helps, but if you don't know your evacuation route and shelter, equipment doesn't save you in a Category 5 event." },
      { text:"🗺️ Know your nearest government cyclone shelter and walk the evacuation route before the season starts", correct:true, explain:"✅ MOST CRITICAL — Knowing your shelter location and practising the route BEFORE a cyclone is the single most life-saving preparation. In the panic of an approaching storm, this knowledge saves minutes that save lives." },
      { text:"🧱 Build a higher compound wall around your home", correct:false, explain:"❌ WRONG — Compound walls are among the FIRST structures to collapse in cyclone-force winds, creating additional debris hazards. Not a useful preparation." },
      { text:"📡 Install a satellite dish to monitor cyclone tracks", correct:false, explain:"❌ WRONG PRIORITY — IMD SMS alerts and All India Radio reach virtually all coastal residents for free. Knowing your shelter route is far more valuable than satellite tracking." },
    ]},
  { id:"cy10", disaster:"Cyclone", em:"🌀", col:"#7c3aed", sfx:"wind",
    title:"Cyclone — School Evacuation Decision",
    alert:"🚨 CYCLONE WARNING — SCHOOL EVACUATION ORDER",
    alertSub:"Mandatory school evacuation — contact parents",
    desc:"You are a teacher in a coastal school. A cyclone is 6 hours away. The principal says 'Let the children go home — parents will pick them up.' But many children travel 8km by bus.",
    bg:"linear-gradient(170deg,#040012,#07001e)",
    shake:false,
    choices:[
      { text:"🚌 Send all children home by bus immediately — parents know best", correct:false, explain:"❌ DANGEROUS — In 6 hours, roads may become impassable mid-journey. Children in a bus during a cyclone are in extreme danger. Keep them in the strongest available building." },
      { text:"🏫 Keep all children at school (stronger building), contact parents to come, notify authorities of children in your care", correct:true, explain:"✅ CORRECT — The school building (if cyclone-rated) is safer than exposing children to an 8km journey as conditions deteriorate. Contact parents and coordinate with local officials." },
      { text:"🎒 Let children who live close walk home, bus the others", correct:false, explain:"❌ INCONSISTENT — Same logic applies to all children. Keeping them together in the safest available building and contacting parents is the correct decision." },
      { text:"📞 Call NDMA for advice before deciding", correct:false, explain:"❌ TOO SLOW — NDMA is not a real-time decision support line for individual schools. The teacher/principal must act on established protocol: keep students safe in the building and notify parents." },
    ]},

  // ─── TSUNAMI (10 scenarios) ───────────────────────────────────────────────
  { id:"ts1", disaster:"Tsunami", em:"🏄", col:"#0891b2", sfx:"wave",
    title:"Beach — Sea Suddenly Retreating",
    alert:"🚨 TSUNAMI WARNING — OCEAN DRAWBACK DETECTED",
    alertSub:"Estimated wave arrival: 3–5 minutes",
    desc:"You are on a beach holiday with your family. Suddenly the sea pulls back dramatically, exposing 200m of seafloor. Fish are flopping on the exposed sand. Other tourists are walking out to see it.",
    bg:"linear-gradient(170deg,#000c14,#0d2840)",
    shake:false,
    choices:[
      { text:"🐟 Walk out to see the exposed seafloor — fascinating!", correct:false, explain:"❌ FATAL CURIOSITY — Ocean drawback is the most unmistakable tsunami warning. In the 2004 tsunami, people who walked out were killed within minutes." },
      { text:"🏃 Grab family and run inland to high ground immediately", correct:true, explain:"✅ LIFE-SAVING — You recognised the warning and acted immediately. Run inland. Reach 30m elevation or 3km from shore." },
      { text:"🏨 Go back to the hotel and go up to the 3rd floor", correct:false, explain:"⚠️ PARTIALLY BETTER — A tall reinforced concrete hotel may survive, but reaching genuine high ground is far safer and the NDMA recommendation." },
      { text:"📷 Take photos then calmly walk away", correct:false, explain:"❌ NO TIME — Tsunami waves travel at 800 km/h in open water. 'Calmly walking' means death. RUN with maximum urgency." },
    ]},
  { id:"ts2", disaster:"Tsunami", em:"🏄", col:"#0891b2", sfx:"wave",
    title:"Strong Earthquake While at Shore — No Siren",
    alert:"🚨 STRONG EARTHQUAKE FELT NEAR COAST",
    alertSub:"No official tsunami warning issued yet",
    desc:"You feel a very strong 90-second earthquake while at a fishing harbour. No tsunami siren has activated. A local fisherman says 'the siren would have gone off — we're safe.'",
    bg:"linear-gradient(170deg,#000810,#081e35)",
    shake:false,
    choices:[
      { text:"🧘 Stay near the harbour — no siren means no tsunami", correct:false, explain:"❌ WRONG — Sirens can fail. Warning systems have a lag of several minutes. The earthquake ITSELF is your warning for a locally generated tsunami. Never wait for a siren." },
      { text:"🏃 Immediately move to high ground — the earthquake IS the warning", correct:true, explain:"✅ CORRECT — For locally-generated tsunamis, you have the shortest window (sometimes 5–10 minutes). The earthquake is your warning. Do not wait for sirens." },
      { text:"📱 Check the INCOIS website to confirm a tsunami warning first", correct:false, explain:"❌ TOO SLOW — Website checks take minutes you don't have for a local tsunami. The ground shaking IS sufficient warning. Move immediately." },
      { text:"🔴 Wait for the Red alert on TV to confirm", correct:false, explain:"❌ FATAL DELAY — TV confirmation takes 10–15 minutes minimum. A locally triggered tsunami can arrive in 5 minutes. Act immediately on the earthquake warning." },
    ]},
  { id:"ts3", disaster:"Tsunami", em:"🏄", col:"#0891b2", sfx:"wave",
    title:"Tsunami — On Board a Boat in Harbour",
    alert:"🚨 TSUNAMI WARNING — HARBOUR EVACUATION",
    alertSub:"All boats and vessels — leave harbour or go to deep water",
    desc:"You are on your fishing boat in harbour when a tsunami warning is issued. The harbour is busy. The tsunami is estimated 35 minutes away. Deep water is 15 minutes away.",
    bg:"linear-gradient(170deg,#000c18,#041e35)",
    shake:false,
    choices:[
      { text:"🚢 Moor the boat securely and evacuate to land", correct:false, explain:"❌ BOAT DESTROYED — A tsunami in a harbour destroys and overturns all vessels. Even well-secured boats become dangerous projectiles. If you cannot reach deep water, abandon the boat and reach high ground." },
      { text:"🌊 Head immediately to deep water (1000m+ depth) at maximum speed", correct:true, explain:"✅ CORRECT — In open deep water, a tsunami is only 30–60cm and harmless. You have 35 minutes to reach deep water 15 minutes away — this is viable. Head out immediately." },
      { text:"⚓ Anchor in the centre of the harbour — deepest point there", correct:false, explain:"❌ WRONG — Harbour anchorage is shallow enough that a tsunami will pile up and destroy everything. Deep ocean only — not harbour depths." },
      { text:"🏃 Abandon the boat and run to high ground instead", correct:false, explain:"⚠️ VALID ALTERNATIVE if deep water is not reachable in time — but you have 35 minutes and deep water is 15 minutes away. Taking the boat to deep water is the better option here." },
    ]},
  { id:"ts4", disaster:"Tsunami", em:"🏄", col:"#0891b2", sfx:"wave",
    title:"Tsunami — Stranded in Inundation Zone",
    alert:"🚨 TSUNAMI INUNDATION ONGOING — DO NOT RETURN",
    alertSub:"Multiple wave trains — stay on high ground",
    desc:"The first tsunami wave has passed. You are safely on a hill watching from above. Many people are starting to go back toward the coast to check their homes. It has been 15 minutes since the first wave.",
    bg:"linear-gradient(170deg,#00080f,#030f1e)",
    shake:false,
    choices:[
      { text:"🏘️ The first wave is usually the worst — go check your house now", correct:false, explain:"❌ MYTH — The first wave is NOT always the largest. Multiple waves follow. People who returned after the first wave were killed by subsequent waves in 2004, 2011, and other events." },
      { text:"🏔️ Stay on high ground until official all-clear — warn others not to return", correct:true, explain:"✅ CORRECT — Tsunami wave trains continue for 8–12 hours. Only an official INCOIS/government all-clear means it is safe to descend. Warn others who are moving back." },
      { text:"🔭 Only go back if you can see the ocean is calm from your vantage point", correct:false, explain:"❌ INSUFFICIENT — Ocean appearance between waves can look completely calm. The wave train has not stopped. Only official confirmation is reliable." },
      { text:"🌊 Watch the coast for 30 more minutes and return if no second wave", correct:false, explain:"❌ NOT LONG ENOUGH — Tsunamis can have intervals of 30–60 minutes between waves. 30 minutes is not sufficient to confirm it is over." },
    ]},
  { id:"ts5", disaster:"Tsunami", em:"🏄", col:"#0891b2", sfx:"wave",
    title:"Tsunami — School Near the Coast",
    alert:"🚨 TSUNAMI WATCH — COASTAL SCHOOLS EVACUATE",
    alertSub:"Move students to designated high ground",
    desc:"A tsunami watch is issued at 10 AM. You are a teacher at a coastal school 600m from the beach. The school has a designated evacuation route to a hill 1.2km away. Some parents are arriving by car to take children.",
    bg:"linear-gradient(170deg,#000b15,#041c33)",
    shake:false,
    choices:[
      { text:"🚌 Wait for all parents to arrive before evacuating the rest of the class together", correct:false, explain:"❌ DANGEROUS DELAY — A tsunami watch can escalate to warning with a short timeframe. Begin the organised evacuation immediately. Parents can meet students at the hill." },
      { text:"🏃 Begin immediate organised evacuation of all students on foot to the hill — parents can meet at the assembly point", correct:true, explain:"✅ CORRECT — Begin evacuation immediately with all students. Parents should be directed to the hilltop assembly point. Do not wait for parents at school. Every minute counts." },
      { text:"🏫 Shelter students in the school's upper floor", correct:false, explain:"❌ INSUFFICIENT — For a school only 600m from shore, being in the building is not safe enough. High ground is significantly safer for a coastal school this close to the sea." },
      { text:"📞 Wait for the watch to upgrade to a warning before moving", correct:false, explain:"❌ WRONG — A watch means conditions exist for a tsunami. The upgrade to warning may come with only minutes before impact. Evacuate on watch, not on warning." },
    ]},
  { id:"ts6", disaster:"Tsunami", em:"🏄", col:"#0891b2", sfx:"wave",
    title:"Tsunami — Passenger on Coastal Train",
    alert:"🚨 TSUNAMI WARNING — COASTAL RAIL EVACUATION",
    alertSub:"Train stopped — evacuate to high ground",
    desc:"You are a passenger on a coastal train that has stopped due to a tsunami warning. The train is 800m from the shore on flat land. The conductor is unsure what to do. A low hill is visible 600m away.",
    bg:"linear-gradient(170deg,#000810,#040f20)",
    shake:false,
    choices:[
      { text:"🪑 Stay on the train — it is heavy and will be stable", correct:false, explain:"❌ WRONG — The 2004 tsunami derailed a 14-carriage train in Sri Lanka, killing all 1,700 passengers. Trains provide NO protection against tsunami inundation." },
      { text:"🏃 Exit the train immediately and run to the visible hill 600m away", correct:true, explain:"✅ CORRECT — Immediately evacuate and run to the hill. 600m on foot at a run takes 3–4 minutes. This is achievable if the wave hasn't arrived yet." },
      { text:"📱 Look up INCOIS website to confirm tsunami before deciding to move", correct:false, explain:"❌ TOO SLOW — A confirmed warning is already issued. Your time is better spent running to the hill than confirming what authorities have already told you." },
      { text:"🏘️ Run to the nearest buildings and shelter in the upper floor", correct:false, explain:"⚠️ BETTER THAN STAYING ON TRAIN but not as safe as the hill — Concrete upper floors of buildings can survive some tsunami inundation. But if the hill is accessible, use it." },
    ]},
  { id:"ts7", disaster:"Tsunami", em:"🏄", col:"#0891b2", sfx:"wave",
    title:"Tsunami — Hospital Patient Near Coast",
    alert:"🚨 TSUNAMI WARNING — HOSPITAL VERTICAL EVACUATION",
    alertSub:"Move all mobile patients to upper floors",
    desc:"You are a ward nurse in a 5-storey coastal hospital when a tsunami warning is issued. ICU patients cannot be moved easily. The hospital is 400m from the shore. Your protocol says 'vertical evacuation — move all mobile patients to 4th floor or above.'",
    bg:"linear-gradient(170deg,#000811,#04101e)",
    shake:false,
    choices:[
      { text:"🚑 Begin ambulance evacuation of all patients to inland hospital", correct:false, explain:"❌ NOT POSSIBLE IN TIME — 400m from shore means the tsunami could arrive in under 5 minutes. Ambulance transfer takes far longer. Vertical evacuation within the building is the correct protocol." },
      { text:"🏥 Follow vertical evacuation protocol — move mobile patients to 4th floor+, secure immobile ICU patients in place with staff present", correct:true, explain:"✅ CORRECT — The hospital's vertical evacuation protocol exists for exactly this scenario. Upper floors of a 5-storey building at 400m can survive most tsunamis. Follow protocol." },
      { text:"🏃 Evacuate all medical staff to high ground — patient safety is secondary in emergencies", correct:false, explain:"❌ ETHICALLY AND PRACTICALLY WRONG — Abandoning patients violates medical ethics and NDMA hospital disaster protocols. Staff should execute vertical evacuation with patients." },
      { text:"🌊 Wait to see the first wave before acting — to avoid false alarm disruption", correct:false, explain:"❌ FATAL DELAY — By the time you see the first wave 400m from shore, there are seconds remaining. Execute the protocol immediately upon warning." },
    ]},
  { id:"ts8", disaster:"Tsunami", em:"🏄", col:"#0891b2", sfx:"wave",
    title:"Tsunami — Tourists at Underwater Cave",
    alert:"🚨 TSUNAMI WARNING — ALL COASTAL AREAS",
    alertSub:"Move immediately inland — do not return to shore",
    desc:"You are a tourist guide leading a group of 8 people at a scenic underwater cave feature 200m from shore. The cave entrance is accessible only at low tide. Your phone flashes a tsunami warning.",
    bg:"linear-gradient(170deg,#000610,#021020)",
    shake:false,
    choices:[
      { text:"🌊 Enter the cave — the rock walls will protect you from the wave", correct:false, explain:"❌ CERTAIN DEATH — The cave will fill completely and violently with water as the tsunami arrives. The pressure and surge make escape from a submerged cave impossible." },
      { text:"🏃 Immediately lead the group away from the shore to the highest available ground", correct:true, explain:"✅ CORRECT — Leave everything and run. 8 people, 200m from shore: you have potentially 5–15 minutes. Head to the highest accessible point as fast as possible." },
      { text:"🤿 Dive into the water — you are snorkelers and can survive below the waves", correct:false, explain:"❌ COMPLETELY WRONG — A tsunami is not a surface wave you can dive under. It is a column of water extending from the seafloor to the surface — the entire water mass moves." },
      { text:"🏖️ Run along the beach to the nearest pier — piers are elevated", correct:false, explain:"❌ NO — Piers are directly in the tsunami's path and provide no meaningful elevation. Run AWAY from the shore, not along it." },
    ]},
  { id:"ts9", disaster:"Tsunami", em:"🏄", col:"#0891b2", sfx:"wave",
    title:"Tsunami Aftermath — Returning Home",
    alert:"⚠️ TSUNAMI AFTERMATH — ALL-CLEAR ISSUED",
    alertSub:"Official all-clear issued — safe to return",
    desc:"24 hours after the tsunami, official all-clear has been issued. You want to return to your coastal home to assess damage. The road has scattered debris and some standing water.",
    bg:"linear-gradient(170deg,#000811,#031525)",
    shake:false,
    choices:[
      { text:"🌊 Wade through the standing water quickly — it's just residual water", correct:false, explain:"❌ HAZARDOUS — Post-tsunami residual water carries the same hazards as flood water: sewage, debris, chemicals, and potentially live electricity from submerged cables." },
      { text:"🦯 Navigate debris cautiously, avoid standing water, check for structural damage before entering home", correct:true, explain:"✅ CORRECT — Move carefully through debris areas. Avoid water. Inspect for structural damage, gas smells, and electrical hazards before entering. Official all-clear means water threat is over, not that all hazards are gone." },
      { text:"🏃 Rush straight to your home to save valuables before others get there", correct:false, explain:"❌ RECKLESS — Rushing through debris areas and into structurally compromised buildings has caused many post-tsunami deaths. Security concerns don't justify the risk." },
      { text:"🚿 Shower in the standing sea water — you are visibly dirty from evacuation", correct:false, explain:"❌ VERY DANGEROUS — Post-tsunami residual water is heavily contaminated with sewage, chemicals, and pathogens. Do NOT use it for any personal hygiene." },
    ]},
  { id:"ts10", disaster:"Tsunami", em:"🏄", col:"#0891b2", sfx:"wave",
    title:"Tsunami Drill — Why Practice Matters",
    alert:"ℹ️ ANNUAL TSUNAMI DRILL — 26 DECEMBER",
    alertSub:"Practising your evacuation route today",
    desc:"Your coastal community is conducting its annual tsunami evacuation drill on 26 December. Your neighbour says 'I know where to go — I don't need to practice walking the route again.'",
    bg:"linear-gradient(170deg,#001015,#031d28)",
    shake:false,
    choices:[
      { text:"🧘 Agree — knowing the route mentally is enough", correct:false, explain:"❌ WRONG — Mental knowledge is insufficient. Studies of disasters show people freeze or take wrong turns under panic. Physical muscle-memory practice is what saves lives." },
      { text:"🏃 Participate in the drill — practising builds muscle memory that works even under extreme panic", correct:true, explain:"✅ CORRECT — Evacuation drills build the automatic responses needed during extreme stress. Communities with regular drills consistently have lower death tolls in real events." },
      { text:"📱 Check the INCOIS app instead — technology replaces the need for physical drills", correct:false, explain:"❌ WRONG — Technology supplements but never replaces physical practice. In a real event you may have no time for phones. Your body must know the route automatically." },
      { text:"🌊 Drills are only needed for people who live closest to the shore", correct:false, explain:"❌ WRONG — Tsunamis can travel much further inland than expected. And helping others who panic during evacuation requires everyone knowing routes and procedures." },
    ]},

  // ─── WILDFIRE (10 scenarios) ──────────────────────────────────────────────
  { id:"wf1", disaster:"Wildfire", em:"🌲", col:"#c2410c", sfx:"fire",
    title:"Forest Hike — Wildfire Advancing Uphill",
    alert:"🔥 WILDFIRE ALERT — FAST-MOVING FIRE NEARBY",
    alertSub:"Wind direction: westerly — fire moving east",
    desc:"You are on a hiking trail. You smell smoke and see a wildfire advancing through the forest uphill to your right. The wind is blowing from the west. You are on a slope.",
    bg:"linear-gradient(170deg,#0a0100,#2a0a00)",
    shake:false,
    choices:[
      { text:"⬆️ Run uphill — you'll be above the fire and safe", correct:false, explain:"❌ FATAL — Fire travels fastest UPHILL. Running uphill puts you directly in the fire's fastest path." },
      { text:"↔️ Run downhill and sideways (perpendicular) away from the fire", correct:true, explain:"✅ CORRECT! Run downhill and sideways — across the slope and out of the fire's path. Drop heavy gear to move faster." },
      { text:"🌲 Climb the tallest tree to avoid the ground fire", correct:false, explain:"❌ WRONG — Trees burn, and canopy fires are even more intense than ground fires. You would be trapped above the flames." },
      { text:"🏠 Find any building and shelter inside", correct:false, explain:"❌ RISKY — Wooden buildings burn. Running downhill and out is the primary correct action." },
    ]},
  { id:"wf2", disaster:"Wildfire", em:"🌲", col:"#c2410c", sfx:"fire",
    title:"Home Threatened by Wildfire — Defend or Evacuate?",
    alert:"🔥 WILDFIRE — MANDATORY EVACUATION ORDER ISSUED",
    alertSub:"Fire front 3km away — 45 minutes to arrival",
    desc:"A wildfire has prompted a mandatory evacuation order. You have a concrete and tile home with a cleared 30m defensible space. You spent hours preparing it for fire. You want to stay and defend it.",
    bg:"linear-gradient(170deg,#100200,#280600)",
    shake:false,
    choices:[
      { text:"🏠 Stay and defend — your prepared home is fire-resistant", correct:false, explain:"❌ WHEN MANDATORY ORDER ISSUED — Mandatory evacuation means conditions are too dangerous for safe civilian fire defence. Professional firefighters may not be able to reach you to help if you are trapped." },
      { text:"🚗 Evacuate immediately following the evacuation route", correct:true, explain:"✅ CORRECT — A mandatory evacuation order means authorities have assessed that the fire is beyond civilian defensive capacity. Leave with important documents and irreplaceable items only." },
      { text:"🚒 Call the fire brigade to defend your house from outside while you stay inside", correct:false, explain:"❌ NOT POSSIBLE — Fire services cannot guarantee resource allocation to defend individual homes during large fires. Evacuation is the only reliable protection." },
      { text:"🏠 Stay but move to the strongest room and seal all gaps", correct:false, explain:"❌ STILL WRONG — Under a mandatory evacuation order, staying in any part of the house means you may need rescue at the worst possible time for emergency services." },
    ]},
  { id:"wf3", disaster:"Wildfire", em:"🌲", col:"#c2410c", sfx:"fire",
    title:"Wildfire Smoke — Health Emergency",
    alert:"⚠️ AIR QUALITY — HAZARDOUS LEVEL (AQI 500+)",
    alertSub:"Wildfire smoke — remain indoors",
    desc:"Wildfire smoke from a distant forest fire has blanketed your city. AQI is 500+ (hazardous). Your asthmatic teenage child wants to go to school. You have N95 masks and a HEPA air purifier at home.",
    bg:"linear-gradient(170deg,#100400,#200800)",
    shake:false,
    choices:[
      { text:"🏫 Send them to school — a surgical mask will provide adequate protection", correct:false, explain:"❌ WRONG — Surgical masks do NOT filter PM2.5 from wildfire smoke. AQI 500+ is a medical emergency for asthmatic individuals. School attendance is not worth a severe asthma attack." },
      { text:"🏠 Keep them at home with HEPA purifier running, take asthma medication as directed by doctor", correct:true, explain:"✅ CORRECT — AQI 500+ with asthma is a genuine health emergency. Keep them indoors with purified air, on prescribed medication. Monitor for respiratory distress." },
      { text:"😷 Send them with an N95 mask — N95 filters all smoke particles", correct:false, explain:"⚠️ PARTLY RIGHT but N95 filters particles NOT gases — and walking to school while exercising and breathing heavily through a mask in AQI 500+ increases smoke inhalation for an asthmatic person. Staying home is safer." },
      { text:"🏙️ Drive them to school quickly — car interior filters smoke adequately", correct:false, explain:"❌ PARTIALLY WRONG — Car AC recirculation does reduce smoke somewhat, but school still involves outdoor exposure at recess/travel. Home with HEPA purifier is the safest option." },
    ]},
  { id:"wf4", disaster:"Wildfire", em:"🌲", col:"#c2410c", sfx:"fire",
    title:"Wildfire — Surrounded While Camping",
    alert:"🔥 WILDFIRE ENCIRCLEMENT — ALL EXITS BLOCKED",
    alertSub:"Last resort survival protocol",
    desc:"A rapidly spreading wildfire has encircled your camping area during a gusty day. You cannot escape in any direction. Fire is 300m away on three sides. You have: a clearing of 20m diameter, sleeping bags, water bottles.",
    bg:"linear-gradient(170deg,#1a0100,#400300)",
    shake:false,
    choices:[
      { text:"🏃 Sprint through the thinnest part of the fire line", correct:false, explain:"❌ LIKELY FATAL — A wildfire's heat alone (radiant heat from 300m) can cause fatal burns before flames touch you. Running through fire at close range has almost no chance of survival." },
      { text:"🦺 Deploy in the centre of the clearing: wet items over you, lie face down with head covered, wait for fire front to pass", correct:true, explain:"✅ LAST RESORT SURVIVAL — The clearing reduces radiant heat exposure. Wet sleeping bags reduce ignition risk. Face down protects airways. Waiting for the fire FRONT to pass (not the whole fire) is the survival strategy." },
      { text:"🌊 Dig a hole and fully bury yourself in soil", correct:false, explain:"❌ NOT POSSIBLE IN TIME and soil is not a reliable thermal barrier — the heat from a wildfire penetrates the ground too. The clearing strategy is better." },
      { text:"🏕️ Build a firebreak around the campsite with shovels", correct:false, explain:"❌ INSUFFICIENT TIME — A 20m clearing reduces but does not eliminate threat. You cannot dig an effective firebreak manually in the minutes available. Use the clearing you have." },
    ]},
  { id:"wf5", disaster:"Wildfire", em:"🌲", col:"#c2410c", sfx:"fire",
    title:"Wildfire — Spotting a New Fire While Driving",
    alert:"⚠️ SMOKE SPOTTED — POSSIBLE NEW WILDFIRE",
    alertSub:"Report to Forest Fire Emergency — 1926",
    desc:"While driving on a forest road, you notice smoke coming from behind a ridge 2km away. The smoke is growing rapidly. It is a dry, windy day during summer. There are no other people visible.",
    bg:"linear-gradient(170deg,#0f0100,#250500)",
    shake:false,
    choices:[
      { text:"🔍 Drive toward the smoke to confirm if it's actually a fire", correct:false, explain:"❌ RISKY — Driving toward a possible wildfire on a windy day can cut off your escape. On dry windy days, fires can spread several km in minutes." },
      { text:"📞 Stop safely, note exact location, call 1926 and 112, continue driving away from the fire", correct:true, explain:"✅ CORRECT — Report immediately with location details. A growing smoke on a dry windy day is almost certainly a wildfire. Leave the area while calling — don't linger." },
      { text:"🛑 Park and try to extinguish it with water bottles from your car", correct:false, explain:"❌ INADEQUATE AND DANGEROUS — Water bottles cannot fight a growing forest fire. You risk being trapped when the fire spreads to surround the road." },
      { text:"📱 Post photos on social media to alert local people", correct:false, explain:"❌ WRONG PRIORITY — Call 1926 and 112 directly. Social media is slower and unreliable for emergency response. Report to authorities first, post later if you wish." },
    ]},
  { id:"wf6", disaster:"Wildfire", em:"🌲", col:"#c2410c", sfx:"fire",
    title:"Wildfire Evacuation — Power Outage at Night",
    alert:"🔥 WILDFIRE EVACUATION — POWER FAILURE",
    alertSub:"Evacuate via marked routes — reduced visibility",
    desc:"A wildfire evacuation order is issued at 11 PM. There is a power outage from the fire. Smoke reduces visibility to 50m. You have a torch, a car, and family including a 4-year-old.",
    bg:"linear-gradient(170deg,#150300,#2a0600)",
    shake:false,
    choices:[
      { text:"⏰ Wait until dawn — driving in smoke at night is too dangerous", correct:false, explain:"❌ WRONG — Fires travel faster at night when humidity drops further. Staying increases risk. Drive slowly with headlights and hazards on. Following marked evacuation route with a torch is manageable." },
      { text:"🚗 Evacuate now following the marked route at slow speed with hazards on, headlights low-beam, windows closed", correct:true, explain:"✅ CORRECT — Low-beam headlights in smoke, slow speed, hazard lights on, windows closed (recirculate air). Follow the pre-designated evacuation route. Go now." },
      { text:"🌲 Walk through the forest — shorter route to the highway", correct:false, explain:"❌ EXTREMELY DANGEROUS — Walking through a forest adjacent to or near a wildfire at night is suicidal. Roads are slow but predictable and clear of fire." },
      { text:"🏠 Lock the house, seal door gaps, shelter in the bathroom", correct:false, explain:"❌ WRONG — You have a car and a marked evacuation route. Sheltering in place is only for when evacuation is impossible. Leave while you can." },
    ]},
  { id:"wf7", disaster:"Wildfire", em:"🌲", col:"#c2410c", sfx:"fire",
    title:"Wildfire — Agricultural Burning Gone Wrong",
    alert:"🔥 UNCONTROLLED FIRE — AGRICULTURAL BURN SPREADING",
    alertSub:"Wind change has spread fire toward forest",
    desc:"Your neighbour lit a field fire to clear crop stubble. The wind has changed and the fire is now spreading toward the forest edge 200m away. Your neighbour is panicking.",
    bg:"linear-gradient(170deg,#0d0100,#200400)",
    shake:false,
    choices:[
      { text:"🌊 Both of you use buckets of water to fight the fire", correct:false, explain:"⚠️ ONLY if the fire is still very small — but if it's spreading toward a forest edge 200m away, two people with buckets cannot stop it. Alert authorities first." },
      { text:"📞 Call 1926 and 112 immediately, keep others away from the fire, do not attempt to fight it alone", correct:true, explain:"✅ CORRECT — Once a field fire is spreading toward forest, it is beyond individual capacity to control. Call for professional firefighters immediately — every minute of delay allows it to establish." },
      { text:"🌾 Start a counter-fire to burn the path before the fire reaches the forest", correct:false, explain:"❌ EXTREMELY DANGEROUS for untrained civilians — Back-burning without training and coordination with fire services frequently causes the fire to spread further. Do NOT attempt this." },
      { text:"🏃 Evacuate immediately and call from a safe distance", correct:false, explain:"⚠️ PARTIALLY RIGHT — If you are not in the fire's path, calling 1926 before evacuating is preferable to provide immediate response. If the fire is threatening you directly, evacuate and call simultaneously." },
    ]},
  { id:"wf8", disaster:"Wildfire", em:"🌲", col:"#c2410c", sfx:"fire",
    title:"Wildfire — Post-Fire Mudslide Risk",
    alert:"⚠️ POST-WILDFIRE — HEAVY RAIN FORECAST",
    alertSub:"Debris flow and mudslide risk on burnt slopes",
    desc:"A major wildfire has burnt the hills above your village 3 weeks ago. Heavy monsoon rains are forecast for the next 3 days — the first significant rain since the fire. Local authorities have not issued a warning.",
    bg:"linear-gradient(170deg,#0c0100,#1a0300)",
    shake:false,
    choices:[
      { text:"🧘 No official warning — everything should be fine", correct:false, explain:"❌ WRONG — Post-wildfire slopes are among the highest-risk settings for debris flows during rain. The absence of a warning does not mean the risk is absent — it may mean authorities haven't yet assessed it." },
      { text:"📞 Contact local authorities about post-fire debris flow risk and prepare voluntary precautionary evacuation", correct:true, explain:"✅ CORRECT — Post-fire debris flow risk is well-established. Proactively contacting district authorities and preparing to self-evacuate when rain begins is the responsible action." },
      { text:"🧱 Reinforce your home's foundation before the rain arrives", correct:false, explain:"❌ INSUFFICIENT — Foundation reinforcement cannot protect against a debris flow from a burnt hillside. Evacuation is the appropriate protective action." },
      { text:"⛏️ Clear the drainage channel above the village to reduce flow", correct:false, explain:"⚠️ HELPFUL but limited — Clearing drainage is constructive, but for post-fire debris flow risk, the volume and speed of flow can overwhelm any cleared channel. Evacuation remains the primary protection." },
    ]},
  { id:"wf9", disaster:"Wildfire", em:"🌲", col:"#c2410c", sfx:"fire",
    title:"Wildfire — Livestock Evacuation",
    alert:"🔥 WILDFIRE EVACUATION — LIVESTOCK AREAS INCLUDED",
    alertSub:"Evacuate people AND livestock if possible",
    desc:"A wildfire evacuation order covers your farm. You have 30 goats in a pen and a herd dog. You have a truck that can carry 15 goats per trip. The fire front is 90 minutes away.",
    bg:"linear-gradient(170deg,#110100,#220400)",
    shake:false,
    choices:[
      { text:"🐐 Make two truck trips to evacuate all goats — 60 minutes for both trips", correct:false, explain:"❌ CUTTING IT CLOSE AND RISKY — Two full trips to evacuate livestock when the fire is 90 minutes away leaves only 30 minutes margin. People must be out first with time to spare." },
      { text:"🚛 Load family and critical documents first. Then one truck load of goats. Release remaining goats to self-evacuate if there is time.", correct:true, explain:"✅ CORRECT — People first, always. One truck load of priority livestock. Release remaining animals to self-evacuate — animals often survive by instinct. Never miss your human evacuation window for livestock." },
      { text:"🏃 Send family ahead, you stay to move all livestock", correct:false, explain:"❌ WRONG — Staying to complete livestock evacuation has killed farmers who misjudged fire speed. No livestock has the same value as a human life. Do not risk it." },
      { text:"🔥 Open the pen gate and let them all go, evacuate family, forget the truck", correct:false, explain:"⚠️ ALSO ACCEPTABLE if time is shorter — releasing animals to self-evacuate is a valid last resort. But with 90 minutes available, one truckload can be saved. The key is not to delay human evacuation." },
    ]},
  { id:"wf10", disaster:"Wildfire", em:"🌲", col:"#c2410c", sfx:"fire",
    title:"Wildfire — Return to Home After Fire",
    alert:"⚠️ POST-WILDFIRE RE-ENTRY — ASSESS BEFORE ENTERING",
    alertSub:"Fire contained — re-entry advisory issued",
    desc:"Wildfire re-entry advisory issued for your area. Your home is standing but surrounded by burnt vegetation and ash. Power poles are charred. You want to go inside immediately to check damage.",
    bg:"linear-gradient(170deg,#0d0100,#1c0300)",
    shake:false,
    choices:[
      { text:"🏠 Enter immediately — if it's standing it's safe", correct:false, explain:"❌ WRONG — Post-wildfire homes can have: hot spots that can reignite, damaged structural elements, carbon monoxide from smouldering materials, and electrical hazards from heat-damaged wiring." },
      { text:"🔍 Check for hot spots around the exterior, smell for gas, check electrical wires before entering, open windows to ventilate first", correct:true, explain:"✅ CORRECT — Post-wildfire entry protocol: check exterior for hot spots and damage, smell for gas, visually inspect electrical connections, then open windows before entering to ventilate potential CO." },
      { text:"⚡ Turn the power back on first to assess what's working", correct:false, explain:"❌ DANGEROUS — Heat-damaged electrical wiring can short-circuit and start a new fire when power is restored. Have the electricity supply inspected before restoration." },
      { text:"🌊 Hose down the exterior and roof to cool everything before entering", correct:false, explain:"⚠️ PARTIAL — Hosing down hot spots is wise, but you should still follow the full entry protocol before going inside. Check for gas and electrical hazards regardless of exterior cooling." },
    ]},

  // ─── LANDSLIDE (10 scenarios) ─────────────────────────────────────────────
  { id:"ls1", disaster:"Landslide", em:"⛰️", col:"#b45309", sfx:"rumble",
    title:"Mountain Road — Landslide Incoming",
    alert:"⚠️ LANDSLIDE DETECTED — UNSTABLE SLOPES ABOVE",
    alertSub:"Mass movement detected — moving at high speed",
    desc:"You are driving on a mountain road after heavy rain. You hear a deep rumbling from above. Looking up, you see a massive wall of mud and rocks beginning to slide down directly at your vehicle.",
    bg:"linear-gradient(170deg,#060200,#3a1800)",
    shake:false,
    choices:[
      { text:"🚀 Drive faster to outrun the landslide", correct:false, explain:"❌ IMPOSSIBLE — Landslides travel at 80–200 km/h. No vehicle on a mountain road can outrun one." },
      { text:"🚗+🏃 Abandon car and run perpendicular to the slide path", correct:true, explain:"✅ CORRECT! Abandon the vehicle immediately and run SIDEWAYS — perpendicular to the landslide's direction." },
      { text:"🛡️ Stay in the car — the metal frame will protect you", correct:false, explain:"❌ WRONG — A car will be crushed and buried by a landslide within seconds." },
      { text:"⬇️ Reverse downhill as fast as possible", correct:false, explain:"❌ RISKY — Reversing on a mountain road is dangerous and may not move you out of the slide's path." },
    ]},
  { id:"ls2", disaster:"Landslide", em:"⛰️", col:"#b45309", sfx:"rumble",
    title:"Night Landslide — Village Warning",
    alert:"⚠️ HEAVY RAIN WARNING — LANDSLIDE RISK HIGH",
    alertSub:"40mm/hour rainfall recorded upstream — villages at risk",
    desc:"It is 11 PM. Heavy rain has been falling for 6 hours. Your mountain village has a community warning bell. You hear the bell ringing three times — the landslide alert. Some neighbours are unsure whether to evacuate.",
    bg:"linear-gradient(170deg,#030100,#1a0800)",
    shake:false,
    choices:[
      { text:"⏳ Wait until morning — landslides rarely happen at night", correct:false, explain:"❌ WRONG — Landslides have no preference for time of day. Overnight events are particularly dangerous because people are asleep and don't recognise warning sounds." },
      { text:"🏃 Evacuate immediately to the designated safe zone — the warning bell is the signal to act", correct:true, explain:"✅ CORRECT — Community warning systems exist precisely for this moment. The bell is the signal to act. Evacuate immediately without waiting for visual confirmation." },
      { text:"🏠 Move to the upper floor of your house and wait", correct:false, explain:"❌ INADEQUATE — A landslide can bury or destroy an entire house. The upper floor of a building in the landslide path provides no meaningful protection." },
      { text:"🔦 Go outside to observe the hillside and confirm if a slide is coming", correct:false, explain:"❌ DANGEROUS — In heavy rain and darkness on a slope, you cannot effectively observe warning signs. You may also be in the slide path when it arrives." },
    ]},
  { id:"ls3", disaster:"Landslide", em:"⛰️", col:"#b45309", sfx:"rumble",
    title:"Trekking — Ground Cracking Ahead",
    alert:"⚠️ TERRAIN INSTABILITY DETECTED",
    alertSub:"Do not cross unstable ground — return to base",
    desc:"You are trekking in the Himalayas. You reach a section of trail where fresh tension cracks run across the path. Trees nearby are tilted at odd angles. Your guide says 'We can cross carefully.'",
    bg:"linear-gradient(170deg,#080200,#1e0800)",
    shake:false,
    choices:[
      { text:"🚶 Cross carefully as the guide suggests — they know the terrain", correct:false, explain:"❌ WRONG — Even experienced guides misjudge slope stability. Tension cracks are one of the most reliable pre-failure indicators. No crossing should be attempted." },
      { text:"🔄 Turn back immediately, report to local authorities and forest department", correct:true, explain:"✅ CORRECT — Tension cracks indicate active slope deformation and imminent failure risk. No trekking objective is worth the risk. Report the location to authorities." },
      { text:"🏃 Run quickly across the cracked section — speed reduces exposure time", correct:false, explain:"❌ WRONG — Running across an unstable slope increases load and vibration on already-compromised ground. Turn around — do not cross." },
      { text:"🏕️ Camp nearby and wait for the rain to stop before crossing", correct:false, explain:"❌ WRONG — Rain is causing the slope to fail. Waiting nearby puts you at risk from the slide when it happens. The correct action is immediate retreat." },
    ]},
  { id:"ls4", disaster:"Landslide", em:"⛰️", col:"#b45309", sfx:"rumble",
    title:"River Turns Brown — Debris Flow Signal",
    alert:"⚠️ RIVER WATER COLOUR CHANGE DETECTED",
    alertSub:"Sudden turbidity indicates upstream landslide activity",
    desc:"You are at a riverside campsite in a mountain valley. The river, which was clear this morning, has suddenly turned brown and the flow volume appears to have increased significantly. You hear a distant rumbling.",
    bg:"linear-gradient(170deg,#070200,#1a0700)",
    shake:false,
    choices:[
      { text:"🏕️ Move the camp to the riverside for better water access", correct:false, explain:"❌ SUICIDAL — Sudden brown colouration and increased flow are classic signs of an upstream debris flow or landslide dam release. A surge is likely minutes away." },
      { text:"🏃 Immediately move uphill to the highest accessible ground on the valley walls", correct:true, explain:"✅ CORRECT — Brown river surge + rumbling = debris flow coming. This is a last-warning sign. Move to the valley walls immediately, as high as possible." },
      { text:"🔭 Observe for 10 more minutes to confirm before deciding", correct:false, explain:"❌ FATAL DELAY — A debris flow can travel at 50 km/h down a valley. 10 minutes of observation may leave you with no time to escape. Move NOW." },
      { text:"🛶 Cross the river to the opposite bank before any surge arrives", correct:false, explain:"❌ WRONG — Crossing an already-surging, turbid mountain river is extremely dangerous. Move vertically up the valley walls — not horizontally across the river." },
    ]},
  { id:"ls5", disaster:"Landslide", em:"⛰️", col:"#b45309", sfx:"rumble",
    title:"School on Hillside — Pre-Monsoon Risk",
    alert:"⚠️ PRE-MONSOON ALERT — SCHOOL ON UNSTABLE SLOPE",
    alertSub:"District authority recommends precautionary closure",
    desc:"Your school is on a hillside that was identified in a GSI survey as high landslide risk. The district authority sends a 'precautionary school closure recommended' advisory. The school principal wants to stay open — 'we always have been.'",
    bg:"linear-gradient(170deg,#060100,#160500)",
    shake:false,
    choices:[
      { text:"🏫 Continue school as normal — precautionary advisories are usually wrong", correct:false, explain:"❌ WRONG — GSI surveys and district advisories represent professional scientific assessment. Dismissing them because 'we always have been fine' is how tragedies happen." },
      { text:"🏠 Close school and ensure all children and staff are out of the building until the risk period passes and the slope is reassessed", correct:true, explain:"✅ CORRECT — A professional landslide risk assessment combined with a district advisory is a serious warning that overrides routine. Close the school. Educate children elsewhere temporarily." },
      { text:"🌧️ Only close on days when it is actually raining heavily", correct:false, explain:"❌ INSUFFICIENT — Landslides can occur on days after heavy rain as soil saturation reaches failure point. A precautionary closure based on risk assessment is different from day-by-day weather-watching." },
      { text:"📢 Inform parents of the risk and let them decide individually", correct:false, explain:"❌ WRONG — A school administrator cannot shift the responsibility of a safety decision to individual parents. If a professional assessment identifies unacceptable risk, the institution must act." },
    ]},
  { id:"ls6", disaster:"Landslide", em:"⛰️", col:"#b45309", sfx:"rumble",
    title:"Landslide Has Blocked River — Dam Risk",
    alert:"⚠️ LANDSLIDE DAM FORMING UPSTREAM",
    alertSub:"River blocked — outburst flood risk developing",
    desc:"Reports indicate a landslide has blocked the river 15km upstream from your valley town. Authorities say the blockage is creating a lake that could fail within 12–48 hours. No evacuation order yet.",
    bg:"linear-gradient(170deg,#070200,#1e0800)",
    shake:false,
    choices:[
      { text:"🧘 Wait for the official evacuation order before doing anything", correct:false, explain:"❌ RISKY — If the dam fails suddenly, an evacuation order may come with very little warning. The 12–48 hour window is an opportunity to prepare voluntarily." },
      { text:"🗺️ Begin voluntary preparations: pack essentials, identify high ground, inform family, monitor official updates closely", correct:true, explain:"✅ CORRECT — A potential landslide dam outburst is a serious threat. Use the 12–48 hour window to voluntarily prepare and identify safe assembly points above maximum flood levels." },
      { text:"🚣 Go upstream to see the landslide dam — better information helps decisions", correct:false, explain:"❌ EXTREMELY DANGEROUS — Being near a landslide dam when it fails means being in the direct path of the outburst flood. Never approach landslide dams." },
      { text:"🧱 Build sandbag defences along the riverbank in your town", correct:false, explain:"❌ INSUFFICIENT — A landslide dam outburst produces floods far too powerful for sandbags. Elevation is the only reliable protection from outburst flood events." },
    ]},
  { id:"ls7", disaster:"Landslide", em:"⛰️", col:"#b45309", sfx:"rumble",
    title:"Driving in Landslide Zone — Rockfall Encountered",
    alert:"⚠️ ROCKFALL ZONE — CAUTION REQUIRED",
    alertSub:"Active rockfall signs posted — proceed with caution",
    desc:"You are driving through a posted rockfall zone in the mountains. A boulder the size of a car suddenly falls 50m ahead of you and bounces across both lanes. It stops in the middle of the road.",
    bg:"linear-gradient(170deg,#050100,#160600)",
    shake:false,
    choices:[
      { text:"🚗 Carefully drive around the boulder — it's just one rock, the rest is clear", correct:false, explain:"❌ DANGEROUS — A large rockfall event rarely involves just one rock. More may be following. Stopping in a rockfall zone is also dangerous. The correct action is to leave the zone." },
      { text:"🔄 Reverse carefully out of the rockfall zone to a stable road section and wait, then report to highway authorities", correct:true, explain:"✅ CORRECT — A boulder that size indicates active slope instability. Reverse out of the immediate zone, wait at a safe distance, and report to road authorities (1800-180-3718 for NHAI)." },
      { text:"🛑 Stop immediately and wait for more rocks to stop falling", correct:false, explain:"❌ WRONG — Stopping in a rockfall zone keeps you in the target area. Move out of the zone. More rocks may follow." },
      { text:"🏃 Leave your car and move the boulder manually", correct:false, explain:"❌ DANGEROUS — A car-sized boulder cannot be moved manually. Attempting to do so keeps you in the rockfall zone. Leave the area by vehicle and report to authorities." },
    ]},
  { id:"ls8", disaster:"Landslide", em:"⛰️", col:"#b45309", sfx:"rumble",
    title:"Tourist Village — Slope Above Hotel Cracking",
    alert:"⚠️ SLOPE INSTABILITY — HOTEL AREA EVACUATION ADVISED",
    alertSub:"Visible cracks in slope above tourist zone",
    desc:"You are a tourist staying in a hillside village hotel. The district magistrate issues an advisory that cracks have appeared in the slope above the tourist zone. Your hotel says 'No official order — no need to leave.'",
    bg:"linear-gradient(170deg,#060100,#180600)",
    shake:false,
    choices:[
      { text:"🏨 Stay — official evacuation order not yet issued and hotel says it's safe", correct:false, explain:"❌ WRONG — A DM advisory about cracks in the slope above you is a serious warning regardless of whether an order has been issued. Hotels have financial incentives to minimise risk." },
      { text:"🏃 Check out voluntarily, leave the hillside hotel zone, and find accommodation on safer ground", correct:true, explain:"✅ CORRECT — A DM advisory about slope cracking is a credible, official warning. Leave the high-risk zone voluntarily. Your safety is more important than hotel convenience." },
      { text:"🛏️ Move to a room on the opposite side of the hotel, away from the slope", correct:false, explain:"❌ INSUFFICIENT — A major landslide can engulf the entire hotel building. The correct action is to leave the landslide risk zone entirely, not to move to a 'safer' room within it." },
      { text:"📷 Go to photograph the cracks for documentation before deciding", correct:false, explain:"❌ WRONG PRIORITY — If the slope is already cracking, going near it for photographs is extremely dangerous. Get the documentation from a safe distance or leave it to authorities." },
    ]},
  { id:"ls9", disaster:"Landslide", em:"⛰️", col:"#b45309", sfx:"rumble",
    title:"Post-Landslide — Survivor Under Debris",
    alert:"⚠️ SEARCH & RESCUE — SURVIVORS REPORTED UNDER DEBRIS",
    alertSub:"Unstable conditions — trained NDRF teams en route",
    desc:"A landslide has buried part of a village. You can hear voices under the debris 5m from you. NDRF teams are 30 minutes away. Debris is still shifting. A group of villagers wants to dig immediately.",
    bg:"linear-gradient(170deg,#100300,#260800)",
    shake:false,
    choices:[
      { text:"⛏️ Everyone start digging immediately — every second counts", correct:false, explain:"❌ DANGEROUS — Uncoordinated digging on unstable post-landslide debris can cause secondary collapses that kill both rescuers and trapped survivors. NDRF's structural awareness matters here." },
      { text:"📞 Call for survivors, mark location clearly, call 112, keep others back, wait for NDRF unless victim is immediately accessible safely", correct:true, explain:"✅ CORRECT — Keep the survivor calm through voice contact. Mark the location. Keep bystanders from creating secondary collapse. If safe, you can remove small accessible debris — but wait for NDRF for major work." },
      { text:"🏃 Send everyone to dig and you go to meet the NDRF team to guide them faster", correct:false, explain:"⚠️ PARTLY RIGHT to guide NDRF, but uncoordinated digging while you're away is dangerous. The voice contact, marking, and controlled access is the right protocol." },
      { text:"💧 Pour water near the debris to identify cracks and find the survivor's location", correct:false, explain:"❌ WRONG — Introducing water into fresh landslide debris can destabilise it further. Mark location by sound and visual markers." },
    ]},
  { id:"ls10", disaster:"Landslide", em:"⛰️", col:"#b45309", sfx:"rumble",
    title:"NDMA Landslide App — Preparing Your Hillside Home",
    alert:"ℹ️ LANDSLIDE PREPAREDNESS — HOME ASSESSMENT",
    alertSub:"Checking your home's risk factors",
    desc:"You want to assess your hillside home's landslide risk. A NDMA officer visits and asks you about five factors. Which combination makes your home MOST at risk?",
    bg:"linear-gradient(170deg,#040100,#130600)",
    shake:false,
    choices:[
      { text:"Single-storey concrete home, gentle slope, healthy trees, natural drainage intact, no nearby construction", correct:false, explain:"✅ LOWER RISK — Gentle slope, intact vegetation and drainage, no nearby construction disturbance. This home profile carries moderate landslide risk." },
      { text:"Multi-storey unreinforced masonry, steep slope (>35°), recently deforested, drainage channels blocked, recent road cut above", correct:true, explain:"✅ HIGHEST RISK — Every factor maximises risk: steep slope + heavy vulnerable structure + removed root binding + blocked drainage + destabilised slope above. Priority for mitigation or relocation." },
      { text:"Reinforced concrete home, gentle to moderate slope, some trees, drainage partially blocked", correct:false, explain:"⚠️ MODERATE RISK — Better structure but partially blocked drainage on any slope is a warning sign needing attention. Not the highest-risk profile." },
      { text:"Wooden home, flat terrace carved into slope, old retaining wall, natural stream nearby", correct:false, explain:"⚠️ ELEVATED RISK — Wooden homes are more vulnerable. Terraced construction can affect drainage. But a flat terrace with a retaining wall is less extreme than option B." },
    ]},

  // ─── HEATWAVE (10 scenarios) ──────────────────────────────────────────────
  { id:"hw1", disaster:"Heatwave", em:"🌡️", col:"#d97706", sfx:"alarm",
    title:"Extreme Heatwave — Neighbour Collapsed",
    alert:"🌡️ RED ALERT — EXTREME HEAT 48°C",
    alertSub:"Heat stroke is a medical emergency",
    desc:"A red-alert heatwave is underway at 48°C. You find your 75-year-old neighbour collapsed outside — showing confusion, hot dry skin, rapid breathing, and no sweating. Signs of severe heat stroke.",
    bg:"linear-gradient(170deg,#3d1200,#7a3000)",
    shake:false,
    choices:[
      { text:"💨 Fan them vigorously with a big fan — moving air cools", correct:false, explain:"❌ WRONG — Above 40°C, fanning pushes hot air over the body, INCREASING heat load. This worsens heat stroke." },
      { text:"💧 Cool with water, move to shade/AC, call 112 immediately", correct:true, explain:"✅ CORRECT! Wet their skin with cool water, apply ice packs to neck/armpits/groin, move to air-conditioned space, call 112. Every minute matters." },
      { text:"☕ Give them hot tea to induce sweating and cool down", correct:false, explain:"❌ DANGEROUS — Hot liquids worsen heat stroke. The person may also be unable to swallow safely if confused." },
      { text:"😴 Let them rest in the shade — they'll recover on their own", correct:false, explain:"❌ POTENTIALLY FATAL — Severe heat stroke has a 20–30% fatality rate without rapid medical treatment. This is a 112 emergency." },
    ]},
  { id:"hw2", disaster:"Heatwave", em:"🌡️", col:"#d97706", sfx:"alarm",
    title:"Child Left in Hot Car",
    alert:"🌡️ EXTREME HEAT ALERT — CHILD IN VEHICLE",
    alertSub:"Car interior can reach 65°C — act immediately",
    desc:"You see a child alone in a parked car in direct sunlight. The outside temperature is 42°C. The windows are cracked 2cm. The child appears distressed — flushed, crying. The car has been there 10 minutes.",
    bg:"linear-gradient(170deg,#3a0e00,#6e2800)",
    shake:false,
    choices:[
      { text:"🔍 Wait 5 more minutes to see if the parent returns", correct:false, explain:"❌ TOO SLOW — At 42°C outside, car interior reaches 60°C within 10 minutes. The child is already in distress. Waiting 5 more minutes risks heatstroke or death." },
      { text:"🚨 Call 112, try to unlock doors, break a window away from the child as last resort to get the child out", correct:true, explain:"✅ CORRECT — This is a medical emergency. Call 112 first. Try handles and nearby persons with keys. Breaking the window is legally justified to save a child's life. Move the child to cool AC environment immediately." },
      { text:"📢 Loudly announce the car licence plate inside nearby shops to find the parent", correct:false, explain:"⚠️ TRY IT WHILE CALLING 112 but don't do only this — finding the parent is useful but takes time the child doesn't have. Call 112 simultaneously." },
      { text:"🪟 Break all windows immediately for maximum ventilation", correct:false, explain:"❌ PARTIALLY WRONG — Breaking one window away from the child to access the door is appropriate. Breaking all windows creates unnecessary glass hazards. Extract the child to cool air immediately." },
    ]},
  { id:"hw3", disaster:"Heatwave", em:"🌡️", col:"#d97706", sfx:"alarm",
    title:"Construction Worker — Heat Exhaustion on Site",
    alert:"🌡️ HEAT WARNING — OUTDOOR WORKERS AT RISK",
    alertSub:"Wet bulb temperature exceeds safe working threshold",
    desc:"You are a site supervisor. At 1:30 PM, one of your labourers stops working, sits down, is heavily sweating, dizzy, and nauseous. Temperature is 44°C. He has been working since 6 AM without adequate water.",
    bg:"linear-gradient(170deg,#2d0e00,#5a2000)",
    shake:false,
    choices:[
      { text:"🏗️ Give him 10 minutes break and have him continue — project deadline is today", correct:false, explain:"❌ NEGLIGENT — This is heat exhaustion that is progressing toward heat stroke. Continuing to work in 44°C risks life. NDMA outdoor worker guidelines prohibit work between 12-3 PM in extreme heat. Project deadlines do not override life safety." },
      { text:"🏠 Move him to shade/cool area, give ORS/water, rest fully for at least 1 hour, monitor for deterioration", correct:true, explain:"✅ CORRECT — Move to cool shade, rehydrate with ORS, rest. Monitor closely — if he stops sweating, becomes confused, or skin becomes hot and dry (heat stroke signs), call 112 immediately." },
      { text:"💊 Give him paracetamol for the headache and continue", correct:false, explain:"❌ WRONG — Paracetamol treats fever from illness (infection). Heat exhaustion is an external temperature problem — paracetamol does nothing for it and gives a false sense that treatment was given." },
      { text:"🌊 Have him jump into the water tank for immediate cooling", correct:false, explain:"❌ POTENTIALLY DANGEROUS — Sudden cold water immersion in someone with heat exhaustion can cause cardiovascular shock. Gradual cooling with wet cloths and cool (not ice-cold) water is correct." },
    ]},
  { id:"hw4", disaster:"Heatwave", em:"🌡️", col:"#d97706", sfx:"alarm",
    title:"Heatwave — Deciding Outdoor Activity Safety",
    alert:"🌡️ HEAT ALERT — TEMPERATURE 46°C, HIGH HUMIDITY",
    alertSub:"Conditions dangerous for any prolonged outdoor activity",
    desc:"It is 2 PM. Temperature is 46°C with high humidity. Your 14-year-old wants to go play cricket with friends. They argue: 'We'll just be out for 1 hour, we'll drink water.'",
    bg:"linear-gradient(170deg,#340f00,#6b2200)",
    shake:false,
    choices:[
      { text:"✅ Allow it — they're young and healthy, and they'll drink water", correct:false, explain:"❌ WRONG — 46°C with high humidity exceeds safe exercise limits even for healthy teenagers. Young athletes have died of heat stroke in these conditions. Youth does not eliminate risk." },
      { text:"🏠 No outdoor activity — reschedule to after sunset. Indoor exercise only.", correct:true, explain:"✅ CORRECT — 46°C with high humidity is medically dangerous for any sustained outdoor activity. The combination of exercise, heat, and humidity can overwhelm even young, healthy bodies in under an hour." },
      { text:"⏰ Allow a maximum 20 minutes with a water bottle each", correct:false, explain:"❌ STILL TOO LONG — At 46°C with humidity, 20 minutes of active sport can induce heat exhaustion in teenagers. Even with water, evaporative cooling fails at high humidity." },
      { text:"🌲 Allow it if they play in shade", correct:false, explain:"❌ INSUFFICIENT — Shade reduces radiant heat but not ambient air temperature (46°C) or humidity. Exertion in 46°C shaded air is still dangerous for sustained activity." },
    ]},
  { id:"hw5", disaster:"Heatwave", em:"🌡️", col:"#d97706", sfx:"alarm",
    title:"Heatwave — Rural Farm Worker Emergency",
    alert:"🌡️ HEATWAVE — RED ALERT RURAL DISTRICTS",
    alertSub:"Outdoor work dangerous — seek shelter",
    desc:"You are a health worker visiting a rural village during an extreme heatwave. You find three farm labourers still working in fields at 12:30 PM. They say 'We can't stop — if we don't work we don't get paid today.'",
    bg:"linear-gradient(170deg,#2a0c00,#540e00)",
    shake:false,
    choices:[
      { text:"🌾 Acknowledge their hardship and leave — they are adults making their own choice", correct:false, explain:"❌ WRONG — As a health worker during an official Red Alert, you have a responsibility to intervene. Wage pressures do not justify life risk during extreme heat." },
      { text:"💬 Explain the Red Alert risk, provide ORS if available, strongly advise shelter during 12–3 PM, contact local ASHA/panchayat for wage-protection support", correct:true, explain:"✅ CORRECT — Immediate intervention: explain risk, provide ORS, ensure they understand the danger. Connect with ASHA workers and panchayat who can address the wage-barrier issue. Document and report to district health officer." },
      { text:"🚑 Call 112 to force them to stop working", correct:false, explain:"❌ NOT HOW IT WORKS — Emergency services don't remove healthy workers from fields. Persuasion, ORS, shade access, and addressing wage pressure through panchayat is the correct intervention." },
      { text:"🌿 Tell them to take shelter under the nearest tree and continue working in intervals", correct:false, explain:"⚠️ BETTER THAN NOTHING but incomplete — Shade helps, but working in any outdoor conditions during Red Alert heat is dangerous. Full shelter during 12–3 PM is the target." },
    ]},
  { id:"hw6", disaster:"Heatwave", em:"🌡️", col:"#d97706", sfx:"alarm",
    title:"Heatwave — City Power Outage",
    alert:"🌡️ HEATWAVE + POWER OUTAGE — COOLING CENTRE OPEN",
    alertSub:"Load shedding during peak heat — 8-hour outage",
    desc:"An 8-hour planned power outage is starting at 11 AM during a 45°C heatwave. You live alone in a top-floor apartment. You have no AC. The nearest government cooling centre is 2km away.",
    bg:"linear-gradient(170deg,#300e00,#601c00)",
    shake:false,
    choices:[
      { text:"🏠 Stay home and use electric fans", correct:false, explain:"❌ WRONG — Fans are on the circuit that's being cut. A top-floor apartment in 45°C without ventilation or AC becomes dangerously hot within 1–2 hours. You are in the highest-risk category." },
      { text:"🏛️ Go to the government cooling centre for the 8-hour outage", correct:true, explain:"✅ CORRECT — Cooling centres exist precisely for situations like this. An 8-hour outage in 45°C in a top-floor flat is a genuine health emergency. The 2km walk is manageable in the early morning before it gets unbearable." },
      { text:"🛁 Sit in a cool bath all day", correct:false, explain:"⚠️ PARTIALLY HELPFUL — Cool (not cold) bathing helps temporarily but you cannot stay in a bath safely for 8 hours. And your water supply may also be affected. The cooling centre is the more reliable option." },
      { text:"🌊 Open all windows and create cross-ventilation", correct:false, explain:"❌ INADEQUATE IN 45°C — Cross-ventilation works when outside air is cooler than indoor. At 45°C, all you do is circulate dangerously hot air. This strategy fails above ~32–35°C outdoor temperatures." },
    ]},
  { id:"hw7", disaster:"Heatwave", em:"🌡️", col:"#d97706", sfx:"alarm",
    title:"Heatwave — Medication and Heat Interaction",
    alert:"🌡️ HEALTH ADVISORY — MEDICATION HEAT WARNINGS",
    alertSub:"Some medications increase heatwave risk",
    desc:"Your elderly mother takes blood pressure medication and antihistamines. During a heatwave, she is outside at noon and starts feeling very dizzy and faint. She is sweating but looks pale.",
    bg:"linear-gradient(170deg,#2c0c00,#580e00)",
    shake:false,
    choices:[
      { text:"💊 Give her an extra dose of her BP medication — it might help", correct:false, explain:"❌ DANGEROUS — Extra BP medication during a heat emergency can cause dangerous blood pressure drops. Do NOT self-adjust prescribed medication." },
      { text:"🏠 Move immediately to cool shade or AC, have her lie down with feet elevated, give ORS, call her doctor or 112 if she doesn't improve", correct:true, explain:"✅ CORRECT — Diuretic BP medications and antihistamines impair the body's cooling response. Move to cool air immediately, hydrate, rest. Feet elevated for near-faint. Seek medical advice." },
      { text:"🏃 Walk her briskly to the nearest hospital", correct:false, explain:"❌ WRONG — Walking in 45°C heat when already in heat distress worsens the condition. Call 112 or get her to cool shade immediately — movement should be minimised." },
      { text:"🧊 Pack her face with ice cubes to cool down quickly", correct:false, explain:"❌ RISKY — Ice directly on face/skin causes blood vessel constriction, reducing blood flow to core and paradoxically reducing cooling efficiency. Use cool (not ice-cold) wet cloths." },
    ]},
  { id:"hw8", disaster:"Heatwave", em:"🌡️", col:"#d97706", sfx:"alarm",
    title:"Heatwave — School Sports Day Decision",
    alert:"🌡️ ORANGE HEAT ALERT — HIGH RISK FOR OUTDOOR ACTIVITY",
    alertSub:"Schools advised to avoid outdoor physical activity",
    desc:"Your school's annual sports day is scheduled for today. The IMD has issued an Orange heat alert with temperatures of 42°C expected to peak at 2 PM. Sports events are scheduled from 10 AM to 4 PM.",
    bg:"linear-gradient(170deg,#2e0b00,#5a1500)",
    shake:false,
    choices:[
      { text:"🏆 Proceed as planned — sports day happens once a year", correct:false, explain:"❌ WRONG — An Orange heat alert with outdoor events involving children all day in 42°C is a serious health risk. Children have died at school events in similar conditions in India." },
      { text:"🏫 Postpone or reschedule to an indoor format — children's safety overrides the annual schedule", correct:true, explain:"✅ CORRECT — NDMA's Heat Action Plan specifically recommends cancelling or rescheduling outdoor events for children during Orange and Red alerts. Safety must override calendar." },
      { text:"⏰ Move all events to the cooler 6–9 AM morning slot only", correct:false, explain:"⚠️ BETTER — Moving events to morning is a valid mitigation if postponement is impossible. But if today's Orange alert continues into morning, even this is risky. Postponement is safer." },
      { text:"🌊 Provide extra water stations and continue — hydration solves the problem", correct:false, explain:"❌ INSUFFICIENT — Hydration alone cannot prevent heat illness when children exercise in 42°C ambient temperature for a full day. Water helps but is not a sufficient safeguard on its own." },
    ]},
  { id:"hw9", disaster:"Heatwave", em:"🌡️", col:"#d97706", sfx:"alarm",
    title:"Heatwave — Infant Heat Distress",
    alert:"🌡️ HEAT ALERT — VULNERABLE POPULATION WARNING",
    alertSub:"Infants and toddlers at acute risk",
    desc:"During a 44°C heatwave, your 8-month-old infant is restless, has stopped feeding, has very few wet nappies, and feels hot to touch. No fever thermometer is available. The power is on and AC is working.",
    bg:"linear-gradient(170deg,#2f0d00,#5c1a00)",
    shake:false,
    choices:[
      { text:"🍼 Try a new bottle feeding style — it could be a feeding issue", correct:false, explain:"❌ POTENTIALLY DELAYED RESPONSE — While feeding issues are possible, the combination of heat + restlessness + decreased output + hot skin during a heatwave is a heat distress signal requiring immediate action." },
      { text:"🌡️ Move infant to cooled AC room, offer fluids (breastmilk/formula/ORS as appropriate), call paediatrician or 112 immediately", correct:true, explain:"✅ CORRECT — Infants cannot self-regulate temperature or communicate distress clearly. Signs of heat distress in an infant are a medical emergency. Cool the environment and seek immediate medical advice." },
      { text:"🪟 Open all windows — fresh air will help the infant", correct:false, explain:"❌ WRONG IN 44°C — At 44°C outside, open windows bring in scorching air. Keep the AC running in a closed room." },
      { text:"🛁 Immerse infant in cold bath water to cool them quickly", correct:false, explain:"❌ DANGEROUS — Cold water immersion in infants can cause dangerous temperature shock. Use lukewarm (not cold) water and cool the environment through AC. Seek medical advice." },
    ]},
  { id:"hw10", disaster:"Heatwave", em:"🌡️", col:"#d97706", sfx:"alarm",
    title:"Heatwave Preparedness — Before the Season",
    alert:"ℹ️ HEATWAVE SEASON PREP — CHECKLIST",
    alertSub:"Pre-season preparation saves lives",
    desc:"It is early March. The IMD forecast predicts an above-normal temperature season for your region. Your neighbour asks: 'What's the most important thing to do NOW, before the heatwave hits?'",
    bg:"linear-gradient(170deg,#240900,#480f00)",
    shake:false,
    choices:[
      { text:"❄️ Buy the most powerful AC unit available", correct:false, explain:"⚠️ HELPFUL if affordable but not the MOST important for everyone — many communities cannot afford AC. The universally applicable preparation is more important." },
      { text:"🗺️ Identify the nearest government cooling centre, ensure elderly neighbours know it, check on vulnerable people in your network, review ORS preparation", correct:true, explain:"✅ MOST IMPACTFUL — Knowing your cooling centre, creating a community check-in network for vulnerable neighbours, and having ORS available are the preparations that save the most lives — particularly for those without AC." },
      { text:"🌿 Plant shade trees in the garden", correct:false, explain:"⚠️ LONG-TERM GOOD but trees take years to provide significant shade — not an 'immediate before season' preparation." },
      { text:"📱 Download the IMD weather app", correct:false, explain:"⚠️ USEFUL but not sufficient — information without a plan and action saves no lives. The cooling centre + vulnerable person network is far more impactful." },
    ]},
];

/* ══════════════════════════════════════════════════
   CANVAS + WORLD CONSTANTS
══════════════════════════════════════════════════ */
const CW = 900, CH = 500;
const FLOOR = 390;
const PLX   = 110;
const PLW   = 48, PLH = 80;

// Disaster-specific mechanics per level
const LEVEL_MECHANICS = {
  earthquake:{ risingHazard:false, fallingDebris:true,  staminaDrain:false },
  flood:     { risingHazard:true,  fallingDebris:false, staminaDrain:true  },
  fire:      { risingHazard:false, fallingDebris:false, staminaDrain:true  },
  cyclone:   { risingHazard:false, fallingDebris:true,  staminaDrain:false },
  tsunami:   { risingHazard:true,  fallingDebris:false, staminaDrain:false },
  tornado:   { risingHazard:false, fallingDebris:true,  staminaDrain:false },
  wildfire:  { risingHazard:false, fallingDebris:false, staminaDrain:true  },
  avalanche: { risingHazard:true,  fallingDebris:true,  staminaDrain:false },
  heatwave:  { risingHazard:false, fallingDebris:false, staminaDrain:true  },
  landslide: { risingHazard:true,  fallingDebris:true,  staminaDrain:false },
};

/* ══════════════════════════════════════════════════
   SPRITE RENDERER  — pixel-art quality canvas drawing
   All shapes use layered gradients, outlines, highlights
   and shadows to look like real 2D game sprites
══════════════════════════════════════════════════ */

/* ─── Utility ─── */
function rr(ctx, x, y, w, h, r, fill, stroke, sw=0) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x,y,w,h,r);
  else {
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }
  if (fill) { ctx.fillStyle=fill; ctx.fill(); }
  if (stroke && sw>0) { ctx.strokeStyle=stroke; ctx.lineWidth=sw; ctx.stroke(); }
}

function poly(ctx, pts, fill, stroke, sw=0) {
  ctx.beginPath(); ctx.moveTo(pts[0],pts[1]);
  for (let i=2;i<pts.length;i+=2) ctx.lineTo(pts[i],pts[i+1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle=fill; ctx.fill(); }
  if (stroke && sw>0) { ctx.strokeStyle=stroke; ctx.lineWidth=sw; ctx.stroke(); }
}

/* ─── PARALLAX BACKGROUND LAYERS ─── */
function paintBackground(ctx, level, scrollX, t) {
  const id = level.id;

  /* SKY */
  const sky = ctx.createLinearGradient(0,0,0,CH);
  const skyColors = {
    earthquake: ["#1a0800","#3d1500","#0a0200"],
    flood:      ["#020c1e","#04152d","#000510"],
    fire:       ["#1a0200","#3d0800","#0a0000"],
    cyclone:    ["#06001a","#0d0030","#03000e"],
    tsunami:    ["#000c18","#001830","#000408"],
    tornado:    ["#080614","#110a28","#040210"],
    wildfire:   ["#160200","#2d0500","#080100"],
    avalanche:  ["#0a1420","#1a2840","#060c14"],
    heatwave:   ["#3d1000","#5a1800","#1e0800"],
    landslide:  ["#0a0600","#180e00","#050200"],
  };
  const [s0,s1,s2] = skyColors[id] || skyColors.earthquake;
  sky.addColorStop(0,s0); sky.addColorStop(0.5,s1); sky.addColorStop(1,s2);
  ctx.fillStyle=sky; ctx.fillRect(0,0,CW,CH);

  /* STARS / ATMOSPHERE particles */
  if (id !== "heatwave") {
    ctx.save();
    for(let i=0;i<80;i++){
      const sx=((i*173+scrollX*0.02)%CW);
      const sy=(i*97)%200;
      const sa=0.3+Math.sin(t*0.8+i)*0.25;
      ctx.fillStyle=`rgba(255,255,255,${sa})`;
      ctx.fillRect(sx,sy,i%3===0?2:1,i%3===0?2:1);
    }
    ctx.restore();
  }

  /* ═══ EARTHQUAKE ═══ */
  if(id==="earthquake"){
    // Far city — damaged silhouette
    for(let i=0;i<12;i++){
      const bx=((i*82+scrollX*0.08)%1100)-50;
      const bh=100+i%4*55;
      const bw=30+i%3*20;
      const lean=(i%5-2)*0.03;
      ctx.save(); ctx.translate(bx+bw/2,FLOOR); ctx.rotate(lean);
      ctx.fillStyle=`hsl(15,30%,${6+i%4*3}%)`;
      ctx.fillRect(-bw/2,-bh,bw,bh);
      // Broken windows
      for(let r=0;r<4;r++) for(let c=0;c<2;c++){
        const lit=Math.random()>0.7;
        ctx.fillStyle=lit?`rgba(255,200,50,0.25)`:`rgba(0,0,0,0.6)`;
        ctx.fillRect(-bw/2+5+c*12,-(bh-12)+r*22,10,14);
      }
      // Crack
      ctx.strokeStyle="rgba(200,50,20,0.4)"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(-3,-bh*0.8); ctx.lineTo(5,-bh*0.5); ctx.lineTo(-2,-bh*0.2); ctx.stroke();
      ctx.restore();
    }
    // Red sky crack lines
    [[100,0,180,80,230,140],[400,20,480,100,510,180],[650,0,720,90]].forEach(pts=>{
      ctx.save();
      ctx.strokeStyle=`rgba(220,50,20,${0.35+Math.sin(t*2)*0.15})`; ctx.lineWidth=2.5;
      ctx.shadowColor="#dc2626"; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.moveTo(pts[0],pts[1]);
      for(let j=2;j<pts.length;j+=2) ctx.lineTo(pts[j],pts[j+1]);
      ctx.stroke(); ctx.shadowBlur=0; ctx.restore();
    });
    // Dust clouds mid-distance
    for(let i=0;i<6;i++){
      const cx=((i*155+scrollX*0.18)%1000)-60;
      const cy=220+i*20;
      ctx.fillStyle=`rgba(140,80,20,${0.07+i%2*0.04})`;
      ctx.beginPath(); ctx.ellipse(cx,cy,80+i*15,30+i*8,0,0,Math.PI*2); ctx.fill();
    }
  }

  /* ═══ FLOOD ═══ */
  if(id==="flood"){
    // Storm clouds
    for(let i=0;i<10;i++){
      const cx=((i*110+scrollX*0.12)%1100)-50;
      const cy=60+i%4*35;
      const r=55+i%3*30;
      const g2=ctx.createRadialGradient(cx,cy,5,cx,cy,r);
      g2.addColorStop(0,`rgba(20,30,60,0.9)`); g2.addColorStop(1,"transparent");
      ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
    }
    // Rain streaks
    ctx.save(); ctx.strokeStyle="rgba(100,150,220,0.55)"; ctx.lineWidth=1.5;
    for(let i=0;i<55;i++){
      const rx=((i*17+scrollX*0.6+t*40)%CW);
      const ry=((i*23+t*220)%CH);
      ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx-8,ry+22); ctx.stroke();
    }
    ctx.restore();
    // Distant flooded city
    for(let i=0;i<8;i++){
      const bx=((i*120+scrollX*0.1)%1000)-40;
      const bh=80+i%3*40;
      ctx.fillStyle=`rgba(5,20,50,${0.7+i%2*0.1})`;
      ctx.fillRect(bx,FLOOR-bh,50+i%3*20,bh);
    }
  }

  /* ═══ FIRE ═══ */
  if(id==="fire"){
    // Burning buildings bg
    for(let i=0;i<10;i++){
      const bx=((i*100+scrollX*0.1)%1000)-40;
      const bh=120+i%4*50;
      const bw=40+i%3*20;
      ctx.fillStyle=`hsl(${15+i%4*5},40%,${8+i%3*4}%)`;
      ctx.fillRect(bx,FLOOR-bh,bw,bh);
      // Fire glow on building
      const fg=ctx.createRadialGradient(bx+bw/2,FLOOR-bh,0,bx+bw/2,FLOOR-bh,bw*1.5);
      fg.addColorStop(0,`rgba(255,100,0,0.4)`); fg.addColorStop(1,"transparent");
      ctx.fillStyle=fg; ctx.fillRect(bx-bw,FLOOR-bh-40,bw*3,100);
    }
    // Smoke layers
    for(let i=0;i<8;i++){
      const cx=((i*130+scrollX*0.2+t*15)%1100)-60;
      const cy=100+i*25;
      ctx.fillStyle=`rgba(30,20,15,${0.2+i%3*0.08})`;
      ctx.beginPath(); ctx.ellipse(cx,cy,60+i*12,25+i*6,0,0,Math.PI*2); ctx.fill();
    }
    // Flying embers
    ctx.save();
    for(let i=0;i<40;i++){
      const ex=((i*29+scrollX*0.5+t*30)%CW);
      const ey=((i*43+t*(-60+i%4*20))%CH);
      if(ey<0||ey>CH) continue;
      ctx.fillStyle=`rgba(255,${100+i%3*50},0,${0.5+Math.sin(t*3+i)*0.4})`;
      ctx.shadowColor="#f97316"; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.arc(ex,ey,1.5+i%2,0,Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur=0; ctx.restore();
  }

  /* ═══ CYCLONE ═══ */
  if(id==="cyclone"){
    // Spiral cloud bands
    ctx.save();
    for(let ring=0;ring<5;ring++){
      const rx=CW*0.7+((scrollX*0.05)%200)-100;
      const ry=120;
      const r2=80+ring*40;
      ctx.strokeStyle=`rgba(80,50,150,${0.35-ring*0.06})`;
      ctx.lineWidth=12+ring*8;
      ctx.beginPath(); ctx.arc(rx,ry,r2,t*0.3+ring*0.5,t*0.3+ring*0.5+Math.PI*1.5); ctx.stroke();
    }
    ctx.restore();
    // Flying debris
    for(let i=0;i<30;i++){
      const dx=((i*41+scrollX*0.8+t*80)%CW);
      const dy=(i*53+t*(30+i%3*25))%CH;
      if(dy>FLOOR) continue;
      ctx.save(); ctx.translate(dx,dy); ctx.rotate(t*3+i);
      ctx.fillStyle=`rgba(${60+i%3*20},${40+i%4*10},${80+i%5*15},0.7)`;
      ctx.fillRect(-3,-3,6+i%4*3,4+i%3*2);
      ctx.restore();
    }
  }

  /* ═══ TSUNAMI ═══ */
  if(id==="tsunami"){
    // Dark ocean backdrop
    const og=ctx.createLinearGradient(0,0,0,CH);
    og.addColorStop(0,"#000c18"); og.addColorStop(0.6,"#001830"); og.addColorStop(1,"#000d20");
    ctx.fillStyle=og; ctx.fillRect(0,0,CW,CH);
    // Distant buildings/coastline
    for(let i=0;i<8;i++){
      const bx=((i*110+scrollX*0.06)%900)-40;
      ctx.fillStyle=`rgba(0,25,50,0.9)`;
      ctx.fillRect(bx,FLOOR-80-i%4*40,40+i%3*25,80+i%4*40);
    }
    // Background wave
    ctx.save();
    const waveH=80+Math.sin(t*0.5)*15;
    ctx.fillStyle="rgba(0,60,120,0.35)";
    ctx.beginPath(); ctx.moveTo(-10,CH*0.5);
    for(let x=0;x<=CW+10;x+=20){
      ctx.lineTo(x, CH*0.5-waveH*0.5+Math.sin((x+scrollX*0.3)*0.015+t*0.8)*waveH*0.3);
    }
    ctx.lineTo(CW+10,CH); ctx.lineTo(-10,CH); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ═══ TORNADO ═══ */
  if(id==="tornado"){
    // Dark purple sky with funnel
    const tw=100+Math.sin(t*0.4)*20;
    const tx=CW*0.75+((scrollX*0.04)%200)-100;
    ctx.save();
    for(let seg=0;seg<12;seg++){
      const sy=(seg/12)*CH;
      const sw2=tw*(seg/12)*1.8;
      const alpha=0.55-seg*0.03;
      const cg=ctx.createLinearGradient(tx-sw2/2,sy,tx+sw2/2,sy);
      cg.addColorStop(0,"transparent");
      cg.addColorStop(0.3,`rgba(60,40,120,${alpha})`);
      cg.addColorStop(0.5,`rgba(80,60,160,${alpha*1.3})`);
      cg.addColorStop(0.7,`rgba(60,40,120,${alpha})`);
      cg.addColorStop(1,"transparent");
      ctx.fillStyle=cg;
      ctx.fillRect(tx-sw2/2,sy,sw2,CH/12+2);
    }
    // Swirl lines
    for(let ring=0;ring<4;ring++){
      ctx.strokeStyle=`rgba(100,80,200,${0.3-ring*0.06})`;
      ctx.lineWidth=3;
      ctx.beginPath();
      for(let a=0;a<Math.PI*2;a+=0.1){
        const sr=(30+ring*25)*(1-ring*0.15);
        const sy2=200+ring*60;
        const lx=tx+Math.cos(a+t*2-ring)*sr;
        const ly=sy2+Math.sin(a+t*2-ring)*sr*0.3;
        a<0.1?ctx.moveTo(lx,ly):ctx.lineTo(lx,ly);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ═══ WILDFIRE ═══ */
  if(id==="wildfire"){
    // Burning forest silhouette
    for(let i=0;i<18;i++){
      const tx=((i*58+scrollX*0.1)%1050)-20;
      const th=80+i%5*25;
      const tw=28+i%3*10;
      ctx.fillStyle=`rgba(40,8,0,${0.8+i%2*0.1})`;
      // Tree triangle
      poly(ctx,[tx,FLOOR,tx+tw/2,FLOOR-th,tx+tw,FLOOR], `rgba(${20+i%3*8},${5+i%3*3},0,0.9)`, null);
      // Fire tips on trees
      if(i%3!==1){
        const fg3=ctx.createLinearGradient(tx+tw/2,FLOOR-th,tx+tw/2,FLOOR-th+40);
        fg3.addColorStop(0,`rgba(255,150,0,0.7)`); fg3.addColorStop(1,"transparent");
        ctx.fillStyle=fg3;
        poly(ctx,[tx+tw*0.2,FLOOR-th+10,tx+tw/2,FLOOR-th-15,tx+tw*0.8,FLOOR-th+10],`rgba(255,100,0,0.5)`,null);
      }
    }
    // Smoke
    for(let i=0;i<12;i++){
      const cx=((i*90+scrollX*0.18+t*12)%1050)-40;
      ctx.fillStyle=`rgba(25,12,5,${0.22+i%3*0.06})`;
      ctx.beginPath(); ctx.ellipse(cx,80+i*18,55+i*10,22+i*5,0,0,Math.PI*2); ctx.fill();
    }
  }

  /* ═══ AVALANCHE ═══ */
  if(id==="avalanche"){
    // Mountain range
    const peaks=[[0,120,200],[180,60,160],[340,100,220],[540,40,180],[720,80,200],[870,110,160]];
    peaks.forEach(([px,py,pw])=>{
      const mg=ctx.createLinearGradient(px+pw/2,py,px+pw/2,FLOOR);
      mg.addColorStop(0,"#c8e0f0"); mg.addColorStop(0.3,"#8fbbd4"); mg.addColorStop(1,"#4a7090");
      poly(ctx,[px,FLOOR,px+pw/2,py,px+pw,FLOOR],null,null);
      ctx.fillStyle=mg;
      ctx.beginPath(); ctx.moveTo(px,FLOOR); ctx.lineTo(px+pw/2,py); ctx.lineTo(px+pw,FLOOR); ctx.closePath(); ctx.fill();
      // Snow cap
      ctx.fillStyle="rgba(240,250,255,0.9)";
      ctx.beginPath(); ctx.moveTo(px+pw/2,py); ctx.lineTo(px+pw/2-20,py+30); ctx.lineTo(px+pw/2+20,py+30); ctx.closePath(); ctx.fill();
    });
    // Snow fall
    ctx.save();
    for(let i=0;i<60;i++){
      const sx=((i*17+scrollX*0.4+t*25)%CW);
      const sy=((i*29+t*60)%CH);
      if(sy>FLOOR) continue;
      ctx.fillStyle=`rgba(220,240,255,${0.4+i%3*0.15})`;
      ctx.beginPath(); ctx.arc(sx,sy,1+i%2,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  /* ═══ HEATWAVE ═══ */
  if(id==="heatwave"){
    // Barren landscape
    for(let i=0;i<10;i++){
      const bx=((i*95+scrollX*0.08)%950)-30;
      const bh=60+i%4*30;
      ctx.fillStyle=`rgba(80,30,5,0.8)`;
      ctx.fillRect(bx,FLOOR-bh,35+i%3*15,bh);
    }
    // Sun glare
    const sunX=CW*0.8, sunY=60;
    const sunG=ctx.createRadialGradient(sunX,sunY,5,sunX,sunY,200);
    sunG.addColorStop(0,"rgba(255,200,50,0.5)");
    sunG.addColorStop(0.3,"rgba(255,150,0,0.2)");
    sunG.addColorStop(1,"transparent");
    ctx.fillStyle=sunG; ctx.fillRect(0,0,CW,CH);
    // Heat shimmer waves
    ctx.save();
    for(let i=0;i<8;i++){
      const hy=FLOOR-20-i*15;
      ctx.strokeStyle=`rgba(255,120,30,${0.05+i*0.01})`;
      ctx.lineWidth=2;
      ctx.beginPath();
      for(let x=0;x<=CW;x+=20){
        const wave=Math.sin(x*0.03+t*2+i)*6*(1-i*0.08);
        x===0?ctx.moveTo(x,hy+wave):ctx.lineTo(x,hy+wave);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ═══ LANDSLIDE ═══ */
  if(id==="landslide"){
    // Mountain side
    ctx.fillStyle="#3d1800";
    ctx.beginPath(); ctx.moveTo(0,FLOOR); ctx.lineTo(0,FLOOR-200); ctx.lineTo(300,FLOOR-280); ctx.lineTo(CW,FLOOR-180); ctx.lineTo(CW,FLOOR); ctx.closePath(); ctx.fill();
    // Mud streams
    for(let i=0;i<6;i++){
      const mx=((i*150+scrollX*0.2+t*40)%1050)-30;
      ctx.strokeStyle=`rgba(100,50,10,0.7)`;
      ctx.lineWidth=8+i%3*4;
      ctx.beginPath(); ctx.moveTo(mx,FLOOR-180); ctx.bezierCurveTo(mx-20,FLOOR-120,mx+15,FLOOR-80,mx,FLOOR); ctx.stroke();
    }
  }

  /* ─── GROUND TILES ─── */
  drawGround(ctx, level, scrollX, t);
}

/* ─── GROUND TILE SYSTEM ─── */
function drawGround(ctx, level, scrollX, t) {
  const id = level.id;

  // Ground configs per disaster
  const gndCfg = {
    earthquake: { base:"#2a0e00", mid:"#3d1500", line:"#521800", crack:true,  glow:"rgba(220,60,20,0.25)" },
    flood:      { base:"#040d1a", mid:"#071528", line:"#0a2040", crack:false, glow:"rgba(30,80,200,0.3)" },
    fire:       { base:"#1a0600", mid:"#2d0900", line:"#400d00", crack:false, glow:"rgba(255,80,0,0.35)" },
    cyclone:    { base:"#0d0a1a", mid:"#181228", line:"#241a3a", crack:false, glow:"rgba(100,60,220,0.2)" },
    tsunami:    { base:"#030e1a", mid:"#061828", line:"#082035", crack:false, glow:"rgba(20,100,200,0.3)" },
    tornado:    { base:"#0a0818", mid:"#140f28", line:"#201838", crack:false, glow:"rgba(80,60,180,0.2)" },
    wildfire:   { base:"#1a0500", mid:"#2d0800", line:"#400b00", crack:false, glow:"rgba(200,60,0,0.3)" },
    avalanche:  { base:"#182030", mid:"#283848", line:"#384860", crack:false, glow:"rgba(80,160,220,0.2)" },
    heatwave:   { base:"#2d1000", mid:"#451800", line:"#5c2000", crack:true,  glow:"rgba(255,120,0,0.2)" },
    landslide:  { base:"#1a0c00", mid:"#2d1500", line:"#3d1c00", crack:true,  glow:"rgba(160,70,10,0.25)" },
  };
  const cfg = gndCfg[id] || gndCfg.earthquake;

  // Ground glow strip
  ctx.fillStyle = cfg.glow;
  ctx.fillRect(0, FLOOR-8, CW, 16);

  // Main ground fill
  const gg = ctx.createLinearGradient(0, FLOOR, 0, CH);
  gg.addColorStop(0, cfg.mid); gg.addColorStop(0.3, cfg.base); gg.addColorStop(1, "#000");
  ctx.fillStyle = gg; ctx.fillRect(0, FLOOR, CW, CH - FLOOR);

  // Ground surface line with glow
  ctx.strokeStyle = cfg.line; ctx.lineWidth = 3;
  ctx.shadowColor = cfg.glow; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(CW, FLOOR); ctx.stroke();
  ctx.shadowBlur = 0;

  // Tiled ground detail — horizontal planks / slabs
  const tileW = 80, tileH = 12;
  const off = (-(scrollX % tileW) + tileW) % tileW;
  for (let i = -1; i < Math.ceil(CW/tileW)+1; i++) {
    const tx = off + i * tileW;
    // Tile face
    ctx.fillStyle = cfg.mid;
    ctx.fillRect(tx+1, FLOOR+1, tileW-2, tileH-2);
    // Top highlight
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(tx+1, FLOOR+1, tileW-2, 3);
    // Bottom shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(tx+1, FLOOR+tileH-3, tileW-2, 3);
    // Vertical grout
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx, FLOOR); ctx.lineTo(tx, FLOOR+tileH); ctx.stroke();
  }

  // Second deeper tile row
  const off2 = (-(scrollX*0.8 % tileW) + tileW) % tileW;
  for (let i = -1; i < Math.ceil(CW/tileW)+1; i++) {
    const tx = off2 + i * tileW;
    ctx.fillStyle = cfg.base;
    ctx.fillRect(tx+1, FLOOR+tileH+1, tileW-2, tileH-2);
    ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(tx, FLOOR+tileH); ctx.lineTo(tx, FLOOR+tileH*2); ctx.stroke();
  }

  // Ground cracks for earthquake/heatwave/landslide
  if (cfg.crack) {
    ctx.save();
    const crackOff = (scrollX * 0.95) % 180;
    for (let c = 0; c < 5; c++) {
      const cx = ((c * 180 + crackOff) % (CW+180)) - 30;
      const pulse = 0.4 + Math.sin(t*2+c)*0.2;
      ctx.strokeStyle = `rgba(220,60,0,${pulse})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = "#f97316"; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(cx, FLOOR);
      ctx.lineTo(cx-5, FLOOR+8); ctx.lineTo(cx+3, FLOOR+15); ctx.lineTo(cx-2, FLOOR+20);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}

/* ─── PLAYER CHARACTER SPRITE ─── */
function drawPlayer(ctx, x, y, char, frame, isHurt, isDashing, hasShield) {
  const t = Date.now() * 0.001;

  ctx.save();

  // Hurt flicker
  if (isHurt) {
    ctx.globalAlpha = 0.35 + Math.abs(Math.sin(t * 20)) * 0.65;
  }

  // Dash trail
  if (isDashing) {
    for (let d = 1; d <= 6; d++) {
      ctx.save();
      ctx.globalAlpha = 0.07 * (7 - d);
      ctx.translate(-d * 16, 0);
      _drawCharBody(ctx, x, y, char, frame);
      ctx.restore();
    }
  }

  // Shadow ellipse under player
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(x + PLW/2, FLOOR + 6, PLW*0.45, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // Shield bubble
  if (hasShield) {
    ctx.save();
    const sg = ctx.createRadialGradient(x+PLW/2, y+PLH*0.5, 10, x+PLW/2, y+PLH*0.5, 52);
    sg.addColorStop(0, "rgba(96,165,250,0)");
    sg.addColorStop(0.7, "rgba(96,165,250,0.12)");
    sg.addColorStop(1, "rgba(96,165,250,0.55)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(x+PLW/2, y+PLH*0.5, 52, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 2;
    ctx.shadowColor = "#60a5fa"; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(x+PLW/2, y+PLH*0.5, 52, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.restore();
  }

  _drawCharBody(ctx, x, y, char, frame);
  ctx.restore();
}

function _drawCharBody(ctx, x, y, char, frame) {
  const { skin:sk, hair:hr, outfit:sh, pants:pt } = char;
  const isRun = frame % 2;
  const legSwing = isRun ? 0.42 : 0;
  const armSwing = isRun ? 0.38 : 0;
  const bob = isRun ? -2 : 0;

  // ── LEGS ──
  const legY = y + PLH * 0.62;
  const legW = 11, legH = PLH * 0.36;
  const lLegX = x + PLW * 0.25;
  const rLegX = x + PLW * 0.65;

  // Left leg
  ctx.save(); ctx.translate(lLegX, legY); ctx.rotate(legSwing);
  // Pants
  ctx.fillStyle = pt;
  ctx.fillRect(-legW/2, 0, legW, legH * 0.65);
  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(-legW/2+1, 0, 3, legH * 0.4);
  // Shoe
  ctx.fillStyle = "#0f172a";
  rr(ctx, -legW/2-2, legH*0.55, legW+6, legH*0.22, 4, "#0f172a");
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  rr(ctx, -legW/2-1, legH*0.55, legW*0.4, legH*0.12, 2, "rgba(255,255,255,0.06)");
  ctx.restore();

  // Right leg
  ctx.save(); ctx.translate(rLegX, legY); ctx.rotate(-legSwing);
  ctx.fillStyle = pt;
  ctx.fillRect(-legW/2, 0, legW, legH * 0.65);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(-legW/2+1, 0, 3, legH * 0.4);
  ctx.fillStyle = "#0f172a";
  rr(ctx, -legW/2-2, legH*0.55, legW+6, legH*0.22, 4, "#0f172a");
  ctx.restore();

  // ── TORSO ──
  const torsoX = x + 6;
  const torsoY = y + PLH * 0.30 + bob;
  const torsoW = PLW - 12;
  const torsoH = PLH * 0.35;

  // Main torso with gradient
  const tg = ctx.createLinearGradient(torsoX, torsoY, torsoX + torsoW, torsoY + torsoH);
  tg.addColorStop(0, sh); tg.addColorStop(1, shadeColor(sh, -25));
  rr(ctx, torsoX, torsoY, torsoW, torsoH, 5, null);
  ctx.fillStyle = tg; ctx.fill();
  // Shoulder highlight
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  rr(ctx, torsoX+2, torsoY+2, torsoW-4, torsoH*0.3, 4, "rgba(255,255,255,0.12)");
  // Chest stripe / detail
  ctx.fillStyle = shadeColor(sh, -40);
  rr(ctx, torsoX + torsoW*0.3, torsoY + torsoH*0.25, torsoW*0.4, torsoH*0.55, 3, shadeColor(sh,-40));

  // ── ARMS ──
  const armY = torsoY + torsoH*0.08;
  const armW = 9, armH = PLH * 0.28;

  // Left arm
  ctx.save(); ctx.translate(torsoX-2, armY); ctx.rotate(-armSwing);
  const lag = ctx.createLinearGradient(0,0,armW,armH);
  lag.addColorStop(0, sh); lag.addColorStop(1, shadeColor(sh,-20));
  rr(ctx,0,0,armW,armH,4,null); ctx.fillStyle=lag; ctx.fill();
  // Hand
  ctx.fillStyle = sk;
  ctx.beginPath(); ctx.arc(armW/2, armH+4, 6, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // Right arm
  ctx.save(); ctx.translate(torsoX+torsoW-7, armY); ctx.rotate(armSwing);
  const rag = ctx.createLinearGradient(0,0,armW,armH);
  rag.addColorStop(0, sh); rag.addColorStop(1, shadeColor(sh,-20));
  rr(ctx,0,0,armW,armH,4,null); ctx.fillStyle=rag; ctx.fill();
  ctx.fillStyle = sk;
  ctx.beginPath(); ctx.arc(armW/2, armH+4, 6, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // ── NECK ──
  ctx.fillStyle = sk;
  rr(ctx, x+PLW*0.38, torsoY-PLH*0.08, PLW*0.24, PLH*0.10, 3, sk);

  // ── HEAD ──
  const hx = x + PLW/2, hy = y + PLH*0.14 + bob;
  // Head base
  ctx.fillStyle = sk;
  ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 4;
  ctx.beginPath(); ctx.arc(hx, hy, 15, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  // Head highlight
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath(); ctx.arc(hx-3, hy-4, 7, 0, Math.PI*2); ctx.fill();

  // ── HAIR ──
  ctx.fillStyle = hr;
  ctx.beginPath();
  ctx.ellipse(hx, hy-4, 15, 11, 0, Math.PI, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx-12, hy, 5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx+12, hy, 5, 0, Math.PI*2); ctx.fill();

  // ── EYES ──
  const ey = hy - 1;
  // Whites
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.ellipse(hx-5, ey, 4, 4.5, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+5, ey, 4, 4.5, 0, 0, Math.PI*2); ctx.fill();
  // Irises
  ctx.fillStyle = hr;
  ctx.beginPath(); ctx.arc(hx-5, ey+0.5, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx+5, ey+0.5, 2.5, 0, Math.PI*2); ctx.fill();
  // Pupils
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(hx-5, ey+0.5, 1.4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx+5, ey+0.5, 1.4, 0, Math.PI*2); ctx.fill();
  // Eye shine
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.arc(hx-4.3, ey-0.5, 0.9, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx+5.7, ey-0.5, 0.9, 0, Math.PI*2); ctx.fill();

  // ── MOUTH ──
  ctx.strokeStyle = shadeColor(sk, -40); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(hx, hy+5, 4, 0.2, Math.PI-0.2); ctx.stroke();
}

function shadeColor(hex, amt) {
  try {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amt));
    const b = Math.min(255, Math.max(0, (num & 0xFF) + amt));
    return `rgb(${r},${g},${b})`;
  } catch { return hex; }
}

/* ═══════════════════════════════════════════════════
   OBSTACLE SPRITE LIBRARY
   Each obstacle is a multi-layer canvas sprite that
   looks like a real game asset — NOT programmer art
═══════════════════════════════════════════════════ */

/* ── Cracked Boulder / Rock ── */
function sprRock(ctx, x, y, w, h, palette) {
  const [c1,c2,c3] = palette;
  ctx.save();
  // Base shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(x+w/2, y+h+4, w*0.45, 6, 0, 0, Math.PI*2); ctx.fill();

  // Rock body
  poly(ctx,[
    x+w*0.45, y+2,
    x+w-3,    y+h*0.28,
    x+w-1,    y+h*0.72,
    x+w*0.6,  y+h-2,
    x+4,      y+h-3,
    x+2,      y+h*0.4,
    x+w*0.18, y+5,
  ], null, null);
  const rg = ctx.createLinearGradient(x,y,x+w,y+h);
  rg.addColorStop(0, c1); rg.addColorStop(0.45, c2); rg.addColorStop(1, c3);
  ctx.fillStyle = rg; ctx.fill();

  // Outline
  ctx.strokeStyle = shadeColor(c3,-30); ctx.lineWidth=2.5;
  ctx.stroke();

  // Surface highlight
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(x+w*0.35,y+4); ctx.lineTo(x+w*0.7,y+h*0.18); ctx.lineTo(x+w*0.55,y+h*0.35); ctx.lineTo(x+w*0.22,y+h*0.15);
  ctx.closePath(); ctx.fill();

  // Cracks
  ctx.strokeStyle = shadeColor(c3,-50); ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.moveTo(x+w*0.55,y+h*0.25); ctx.lineTo(x+w*0.38,y+h*0.55); ctx.lineTo(x+w*0.5,y+h*0.75); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+w*0.38,y+h*0.55); ctx.lineTo(x+w*0.18,y+h*0.65); ctx.stroke();

  // Label
  ctx.restore();
  drawLabel(ctx, x+w/2, y-10, "JUMP", "#fca5a5");
}

/* ── Collapsed Wall / Rubble ── */
function sprWall(ctx, x, y, w, h, palette) {
  const [c1,c2,c3] = palette;
  ctx.save();
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(x+w/2, y+h+4, w*0.6, 6, 0, 0, Math.PI*2); ctx.fill();

  // Wall bricks
  const brickH = 16, brickW = w < 40 ? w : 36;
  const rows = Math.ceil(h / brickH);
  for(let row = 0; row < rows; row++){
    const by = y + h - (row+1)*brickH;
    const off = row%2===0 ? 0 : brickW*0.5;
    for(let col = 0; col < Math.ceil((w+brickW)/brickW)+1; col++){
      const bx = x + col*brickW - off;
      if(bx+brickW < x || bx > x+w) continue;
      const cx2 = Math.max(x, bx);
      const cw = Math.min(bx+brickW, x+w) - cx2;
      if(cw <= 0) continue;

      // Brick gradient
      const bg = ctx.createLinearGradient(cx2,by,cx2,by+brickH);
      const shade = row%3===0 ? c1 : row%3===1 ? c2 : c3;
      bg.addColorStop(0, shadeColor(shade,15));
      bg.addColorStop(0.5, shade);
      bg.addColorStop(1, shadeColor(shade,-20));
      rr(ctx, cx2+1, by+1, cw-2, brickH-2, 2, null);
      ctx.fillStyle=bg; ctx.fill();
      // Mortar
      ctx.strokeStyle="rgba(0,0,0,0.35)"; ctx.lineWidth=1;
      ctx.strokeRect(cx2+0.5, by+0.5, cw-1, brickH-1);
    }
  }

  // Damage cracks on top
  ctx.strokeStyle = "rgba(255,100,0,0.6)"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x+w*0.4,y+5); ctx.lineTo(x+w*0.55,y+h*0.35); ctx.lineTo(x+w*0.35,y+h*0.6); ctx.lineTo(x+w*0.48,y+h-8); ctx.stroke();

  ctx.restore();
  drawLabel(ctx, x+w/2, y-10, "JUMP", "#fca5a5");
}

/* ── Overturned Car ── */
function sprCar(ctx, x, y, w, h, accent) {
  ctx.save();
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath(); ctx.ellipse(x+w/2, y+h+5, w*0.55, 7, 0, 0, Math.PI*2); ctx.fill();

  const bodyY = y + h*0.3;
  const bodyH = h*0.48;

  // Car body — flipped/damaged
  const cg = ctx.createLinearGradient(x, bodyY, x, bodyY+bodyH);
  cg.addColorStop(0, shadeColor(accent, 20));
  cg.addColorStop(0.5, accent);
  cg.addColorStop(1, shadeColor(accent, -40));
  rr(ctx, x, bodyY, w, bodyH, 6, null);
  ctx.fillStyle=cg; ctx.fill();
  ctx.strokeStyle=shadeColor(accent,-50); ctx.lineWidth=2; ctx.stroke();

  // Cab
  const cabG = ctx.createLinearGradient(x+w*0.15, y+h*0.05, x+w*0.15, bodyY);
  cabG.addColorStop(0, shadeColor(accent,-10)); cabG.addColorStop(1, shadeColor(accent,-30));
  rr(ctx, x+w*0.15, y+h*0.05, w*0.7, h*0.28, 6, null);
  ctx.fillStyle=cabG; ctx.fill();
  ctx.strokeStyle=shadeColor(accent,-50); ctx.lineWidth=1.5; ctx.stroke();

  // Windows — cracked
  const wc = "#93c5fdaa";
  rr(ctx, x+w*0.18, y+h*0.08, w*0.28, h*0.2, 4, wc);
  rr(ctx, x+w*0.54, y+h*0.08, w*0.28, h*0.2, 4, wc);
  // Crack on window
  ctx.strokeStyle="rgba(255,255,255,0.7)"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(x+w*0.25,y+h*0.1); ctx.lineTo(x+w*0.35,y+h*0.22); ctx.lineTo(x+w*0.3,y+h*0.27); ctx.stroke();

  // Body highlight
  ctx.fillStyle="rgba(255,255,255,0.08)";
  rr(ctx, x+3, bodyY+3, w-6, bodyH*0.3, 4, "rgba(255,255,255,0.08)");

  // Wheels (two visible)
  [x+w*0.2, x+w*0.72].forEach(wx=>{
    ctx.fillStyle="#1a1a1a";
    ctx.beginPath(); ctx.arc(wx, y+h-4, 11, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle="#2a2a2a";
    ctx.beginPath(); ctx.arc(wx, y+h-4, 7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle="#444";
    ctx.beginPath(); ctx.arc(wx, y+h-4, 4, 0, Math.PI*2); ctx.fill();
    // Rim spokes
    for(let s=0;s<4;s++){
      const sa = s*Math.PI/2;
      ctx.strokeStyle="#555"; ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(wx+Math.cos(sa)*2, y+h-4+Math.sin(sa)*2);
      ctx.lineTo(wx+Math.cos(sa)*6, y+h-4+Math.sin(sa)*6);
      ctx.stroke();
    }
  });

  ctx.restore();
  drawLabel(ctx, x+w/2, y-10, "JUMP", "#fca5a5");
}

/* ── Fire Wall / Burning Barrier ── */
function sprFlame(ctx, x, y, w, h, t) {
  ctx.save();
  // Char base
  ctx.fillStyle = "#1a0600";
  rr(ctx, x, y+h*0.6, w, h*0.4, 4, "#1a0600");

  // Flame layers (3 tiers for depth)
  [[0,"#dc2626",h*1.0],[0.15,"#ea580c",h*0.85],[0.3,"#f97316",h*0.7],[0.5,"#fb923c",h*0.55],[0.7,"#fde047",h*0.35]].forEach(([ox,col,fh],layer)=>{
    const fg=ctx.createLinearGradient(x+w*ox,y+h-fh,x+w*ox,y+h);
    fg.addColorStop(0,"transparent"); fg.addColorStop(0.3,col+"99"); fg.addColorStop(0.7,col); fg.addColorStop(1,shadeColor(col,-30));
    ctx.fillStyle=fg;
    ctx.beginPath(); ctx.moveTo(x+w*ox, y+h);
    const pts=8;
    for(let i=0;i<=pts;i++){
      const fx=x+w*ox+(i/pts)*w*(1-ox*0.5);
      const flicker=Math.sin(t*4+i*1.3+layer)*16;
      ctx.lineTo(fx, y+h - fh*(i%2===0?1.0:0.65) + flicker);
    }
    ctx.lineTo(x+w, y+h); ctx.closePath();
    ctx.globalAlpha = 0.8+layer*0.04;
    ctx.fill();
  });
  ctx.globalAlpha=1;

  // Inner glow
  ctx.shadowColor="#f97316"; ctx.shadowBlur=18;
  ctx.strokeStyle="#fde04799"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x+w*0.2, y+h);
  for(let i=0;i<=6;i++) ctx.lineTo(x+w*0.2+(i/6)*w*0.6, y+h*0.45+Math.sin(t*5+i)*14);
  ctx.stroke(); ctx.shadowBlur=0;

  ctx.restore();
  drawLabel(ctx, x+w/2, y-10, "JUMP", "#fca5a5");
}

/* ── Aerial Fallen Beam / Girder ── */
function sprBeam(ctx, x, y, w, h, accent) {
  ctx.save();
  // Drop shadow
  ctx.fillStyle="rgba(0,0,0,0.3)";
  rr(ctx, x+4, y+4, w, h, 3, "rgba(0,0,0,0.3)");

  // Metal beam
  const bg2=ctx.createLinearGradient(x,y,x,y+h);
  bg2.addColorStop(0, shadeColor(accent,30));
  bg2.addColorStop(0.4, accent);
  bg2.addColorStop(1, shadeColor(accent,-30));
  rr(ctx, x, y, w, h, 3, null);
  ctx.fillStyle=bg2; ctx.fill();
  ctx.strokeStyle=shadeColor(accent,-50); ctx.lineWidth=2; ctx.stroke();

  // Top highlight stripe
  ctx.fillStyle="rgba(255,255,255,0.18)";
  rr(ctx,x+3,y+2,w-6,h*0.3,2,"rgba(255,255,255,0.18)");

  // Rivet bolts
  [0.1,0.5,0.9].forEach(f=>{
    const rx=x+w*f, ry=y+h*0.5;
    ctx.fillStyle=shadeColor(accent,-20);
    ctx.beginPath(); ctx.arc(rx,ry,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.2)";
    ctx.beginPath(); ctx.arc(rx-1,ry-1,2.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=shadeColor(accent,-60); ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(rx,ry,5,0,Math.PI*2); ctx.stroke();
  });

  // Hazard stripes on ends
  const strW=20;
  ctx.save(); ctx.rect(x,y,strW,h); ctx.clip();
  for(let i=0;i<6;i++){
    ctx.fillStyle=i%2===0?"#fde047aa":"transparent";
    ctx.fillRect(x+i*(strW/4),y,strW/4,h);
  }
  ctx.restore();

  ctx.restore();
  drawLabel(ctx, x+w/2, y-10, "DUCK", "#f87171");
}

/* ── Electric Wire ── */
function sprWire(ctx, x, y, w, h, t) {
  ctx.save();
  // Pole
  const pg=ctx.createLinearGradient(x+w/2-5,y,x+w/2+5,y);
  pg.addColorStop(0,"#374151"); pg.addColorStop(0.5,"#6b7280"); pg.addColorStop(1,"#374151");
  rr(ctx, x+w/2-5, y+h*0.35, 10, h*0.65, 4, null);
  ctx.fillStyle=pg; ctx.fill();
  ctx.strokeStyle="#1f2937"; ctx.lineWidth=1.5; ctx.stroke();
  // Pole cap
  rr(ctx, x+w/2-9, y+h*0.32, 18, 10, 3, "#4b5563","#374151",1);

  // Wire cable — catenary curve
  ctx.strokeStyle="#78716c"; ctx.lineWidth=4;
  ctx.shadowColor="#000"; ctx.shadowBlur=4;
  ctx.beginPath(); ctx.moveTo(x-30, y+h*0.15);
  ctx.quadraticCurveTo(x+w/2, y+h*0.28, x+w+30, y+h*0.15);
  ctx.stroke(); ctx.shadowBlur=0;

  // Hot wire glow
  ctx.strokeStyle="#fde047"; ctx.lineWidth=2.5;
  ctx.shadowColor="#fde047"; ctx.shadowBlur=14;
  ctx.beginPath(); ctx.moveTo(x-30, y+h*0.15);
  ctx.quadraticCurveTo(x+w/2, y+h*0.28, x+w+30, y+h*0.15);
  ctx.stroke(); ctx.shadowBlur=0;

  // Sparks
  const sx=x+w/2+Math.sin(t*7)*6, sy=y+h*0.22;
  for(let i=0;i<4;i++){
    const sa=t*6+i*Math.PI/2;
    const sd=8+Math.sin(t*5+i)*5;
    ctx.fillStyle=`rgba(253,224,71,${0.6+Math.sin(t*8+i)*0.4})`;
    ctx.shadowColor="#fde047"; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(sx+Math.cos(sa)*sd, sy+Math.sin(sa)*sd*0.5, 2.5, 0, Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur=0;
  ctx.restore();
  drawLabel(ctx, x+w/2, y-10, "DUCK", "#f87171");
}

/* ── Smoke / Gas Cloud ── */
function sprSmoke(ctx, x, y, w, h, t) {
  ctx.save();
  const alpha=0.78+Math.sin(t*1.5)*0.08;
  const puffs=[
    [x+w*0.2, y+8,    w*0.42],
    [x+w*0.5, y-6,    w*0.52],
    [x+w*0.78,y+8,    w*0.42],
    [x+w*0.1, y+22,   w*0.35],
    [x+w*0.9, y+22,   w*0.35],
    [x+w*0.5, y+h*0.6,w*0.30],
  ];
  puffs.forEach(([px,py,pr])=>{
    const sg=ctx.createRadialGradient(px,py,pr*0.1,px,py,pr*0.5);
    sg.addColorStop(0,`rgba(55,65,81,${alpha})`);
    sg.addColorStop(0.6,`rgba(40,50,60,${alpha*0.8})`);
    sg.addColorStop(1,"transparent");
    ctx.fillStyle=sg;
    ctx.beginPath(); ctx.arc(px,py,pr*0.5,0,Math.PI*2); ctx.fill();
  });
  // Toxic tinge
  ctx.fillStyle=`rgba(100,130,80,${alpha*0.25})`;
  ctx.beginPath(); ctx.arc(x+w/2,y+h*0.3,w*0.28,0,Math.PI*2); ctx.fill();
  ctx.restore();
  drawLabel(ctx, x+w/2, y-10, "DUCK", "#f87171");
}

/* ── Tsunami Wave ── */
function sprWave(ctx, x, y, w, h, t, accent) {
  ctx.save();
  // Wave base
  const wg=ctx.createLinearGradient(x,y,x,y+h);
  wg.addColorStop(0,"rgba(147,197,253,0.95)");
  wg.addColorStop(0.3,accent);
  wg.addColorStop(1,shadeColor(accent,-40)+"dd");
  ctx.fillStyle=wg;
  ctx.beginPath();
  ctx.moveTo(x, y+h);
  for(let i=0;i<=12;i++){
    const wx=x+(i/12)*w;
    const wy=y+Math.sin(t*3.5+i*0.65)*18*(1-i/16);
    i===0?ctx.moveTo(wx,wy):ctx.lineTo(wx,wy);
  }
  ctx.lineTo(x+w, y+h); ctx.closePath();
  ctx.fill();

  // Foam crest — thick white line
  ctx.strokeStyle="rgba(255,255,255,0.85)"; ctx.lineWidth=5;
  ctx.shadowColor="#93c5fd"; ctx.shadowBlur=14;
  ctx.beginPath();
  for(let i=0;i<=12;i++){
    const wx=x+(i/12)*w;
    const wy=y+Math.sin(t*3.5+i*0.65)*18*(1-i/16);
    i===0?ctx.moveTo(wx,wy):ctx.lineTo(wx,wy);
  }
  ctx.stroke(); ctx.shadowBlur=0;

  // Water droplets spraying
  for(let d=0;d<6;d++){
    const dx=x+w*0.1+d*(w*0.15)+Math.sin(t*4+d)*12;
    const dy=y-12-Math.abs(Math.sin(t*3+d*1.4))*28;
    ctx.fillStyle=`rgba(147,197,253,${0.8+Math.sin(t*5+d)*0.2})`;
    ctx.shadowColor="#93c5fd"; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.ellipse(dx,dy,3.5,8,0.3,0,Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur=0;

  // Bubble/foam inner
  ctx.fillStyle="rgba(255,255,255,0.15)";
  for(let b=0;b<5;b++){
    const bx=x+w*0.1+b*(w*0.18);
    const by=y+h*0.4+Math.sin(t*2+b)*10;
    ctx.beginPath(); ctx.arc(bx,by,4+b%3*2,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  drawLabel(ctx, x+w/2, y-16, "JUMP", "#fca5a5");
}

/* ── Snow / Ice Block ── */
function sprSnow(ctx, x, y, w, h, t) {
  ctx.save();
  // Shadow
  ctx.fillStyle="rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(x+w/2,y+h+4,w*0.55,6,0,0,Math.PI*2); ctx.fill();

  // Ice block with refraction gradient
  const ig=ctx.createLinearGradient(x,y,x+w,y+h);
  ig.addColorStop(0,"#dbeafe"); ig.addColorStop(0.35,"#bfdbfe"); ig.addColorStop(0.7,"#93c5fd"); ig.addColorStop(1,"#60a5fa");
  rr(ctx,x,y,w,h,6,null);
  ctx.fillStyle=ig; ctx.fill();
  ctx.strokeStyle="#3b82f6"; ctx.lineWidth=2.5;
  ctx.shadowColor="#93c5fd"; ctx.shadowBlur=10;
  ctx.stroke(); ctx.shadowBlur=0;

  // Ice highlights
  ctx.fillStyle="rgba(255,255,255,0.45)";
  rr(ctx,x+4,y+4,w*0.4,h*0.25,3,"rgba(255,255,255,0.45)");
  // Internal fracture lines
  ctx.strokeStyle="rgba(255,255,255,0.3)"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(x+w*0.3,y+6); ctx.lineTo(x+w*0.6,y+h*0.5); ctx.lineTo(x+w*0.4,y+h-6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+w*0.6,y+8); ctx.lineTo(x+w*0.35,y+h*0.4); ctx.stroke();

  ctx.restore();
  drawLabel(ctx, x+w/2, y-10, "JUMP", "#fca5a5");
}

/* ── Tornado Debris Swirl ── */
function sprDebrisSwirl(ctx, cx, cy, radius, t, col) {
  ctx.save();
  const pieces=8;
  for(let i=0;i<pieces;i++){
    const angle=t*2.4+(i/pieces)*Math.PI*2;
    const r2=radius*(0.7+i%3*0.15);
    const ox=Math.cos(angle)*r2, oy=Math.sin(angle)*r2*0.45;
    ctx.save(); ctx.translate(cx+ox, cy+oy); ctx.rotate(angle*3);
    const sz=5+i%4*5;
    // Each piece is a mini sprite
    const pg=ctx.createLinearGradient(-sz,-sz,sz,sz);
    pg.addColorStop(0,shadeColor(col,20)); pg.addColorStop(1,shadeColor(col,-30));
    rr(ctx,-sz/2,-sz/2,sz,sz,2,null);
    ctx.fillStyle=pg; ctx.fill();
    ctx.strokeStyle=shadeColor(col,-50); ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
  }
  // Swirl center
  ctx.shadowColor=col; ctx.shadowBlur=15;
  ctx.strokeStyle=col+"88"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(cx,cy,radius*0.3,0,Math.PI*2); ctx.stroke();
  ctx.shadowBlur=0;
  ctx.restore();
  drawLabel(ctx, cx, cy-radius-14, "DODGE", "#f87171");
}

/* ── Lava Geyser ── */
function sprGeyser(ctx, x, y, w, t, active) {
  ctx.save();
  const gx=x+w/2;
  if(active){
    const gH=160+Math.sin(t*7)*18;
    // Lava column
    const gg=ctx.createLinearGradient(gx-w/3,y+gH,gx+w/3,y);
    gg.addColorStop(0,"#c2410c"); gg.addColorStop(0.3,"#ea580c"); gg.addColorStop(0.6,"#f97316"); gg.addColorStop(1,"rgba(253,224,71,0)");
    ctx.fillStyle=gg;
    ctx.beginPath();
    ctx.moveTo(x,y+gH);
    for(let i=0;i<=10;i++){
      const gfx=x+(i/10)*w, gfy=y+gH-(gH*(0.85+Math.sin(t*6+i*1.3)*0.12))*(i%2===0?1:0.9);
      ctx.lineTo(gfx,gfy);
    }
    ctx.lineTo(x+w,y+gH); ctx.closePath(); ctx.fill();

    // Lava blobs
    ctx.shadowColor="#f97316"; ctx.shadowBlur=20;
    for(let b=0;b<6;b++){
      const bx=gx+(Math.sin(t*4+b*1.3))*w*0.4;
      const by=y+gH*0.3-Math.abs(Math.sin(t*3.5+b))*gH*0.5;
      const br=4+b%3*4;
      const bAlpha=0.5+Math.random()*0.5;
      ctx.fillStyle=`rgba(249,115,22,${bAlpha})`;
      ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur=0;
    drawLabel(ctx, gx, y-14, "JUMP", "#fca5a5");
  } else {
    // Dormant — glowing vent
    const pulse=0.4+Math.abs(Math.sin(t*3.5))*0.5;
    const vg=ctx.createRadialGradient(gx,FLOOR-2,2,gx,FLOOR-2,w);
    vg.addColorStop(0,`rgba(239,68,68,${pulse})`);
    vg.addColorStop(0.5,`rgba(239,68,68,${pulse*0.4})`);
    vg.addColorStop(1,"transparent");
    ctx.fillStyle=vg; ctx.beginPath(); ctx.arc(gx,FLOOR-2,w,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=`rgba(251,146,60,${pulse})`; ctx.font="bold 9px monospace"; ctx.textAlign="center";
    ctx.fillText("⚠ VENT", gx, FLOOR-20);
  }
  ctx.restore();
}

/* ── Ground Crack Trap ── */
function sprCrack(ctx, x, y, w, t) {
  ctx.save();
  const lava=`rgba(251,146,60,${0.7+Math.sin(t*3)*0.2})`;
  const cg=ctx.createLinearGradient(x,y,x,y+24);
  cg.addColorStop(0,lava); cg.addColorStop(0.5,"rgba(200,30,0,0.9)"); cg.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=cg;
  ctx.beginPath(); ctx.moveTo(x, y);
  const segs=10;
  for(let i=0;i<=segs;i++){
    const cx2=x+(i/segs)*w;
    const cy2=y+(i%2===0?-3:5)+8*(i/(segs-1));
    ctx.lineTo(cx2,cy2);
  }
  ctx.lineTo(x+w,y); ctx.closePath(); ctx.fill();

  // Glow edges
  ctx.strokeStyle=`rgba(251,146,60,${0.8+Math.sin(t*4)*0.2})`; ctx.lineWidth=3;
  ctx.shadowColor="#f97316"; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.moveTo(x,y);
  for(let i=1;i<=segs;i++) ctx.lineTo(x+(i/segs)*w, y+(i%2===0?-3:4));
  ctx.stroke(); ctx.shadowBlur=0;

  // Surface glow haze
  ctx.fillStyle=`rgba(255,100,0,${0.06+Math.sin(t*2)*0.03})`;
  ctx.fillRect(x-10, y-20, w+20, 24);
  ctx.restore();
  drawLabel(ctx, x+w/2, y-12, "JUMP", "#fca5a5");
}

/* ── Pickup Orb Sprite ── */
function sprPickup(ctx, x, y, emoji, label, color, t, bob) {
  const cx=x+22, cy=y+22;
  const pulse=2.5+Math.sin(t*2.5+bob)*2.5;
  ctx.save();

  // Outer glow ring
  const og=ctx.createRadialGradient(cx,cy,10,cx,cy,32+pulse);
  og.addColorStop(0,color+"44"); og.addColorStop(0.6,color+"22"); og.addColorStop(1,"transparent");
  ctx.fillStyle=og; ctx.beginPath(); ctx.arc(cx,cy,32+pulse,0,Math.PI*2); ctx.fill();

  // Rotating orbit ring
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(t*1.2);
  ctx.strokeStyle=color+"66"; ctx.lineWidth=1.5;
  ctx.setLineDash([4,8]);
  ctx.beginPath(); ctx.arc(0,0,22+pulse*0.5,0,Math.PI*2); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();

  // Inner sphere
  const sg=ctx.createRadialGradient(cx-5,cy-5,2,cx,cy,18);
  sg.addColorStop(0,"rgba(255,255,255,0.6)");
  sg.addColorStop(0.3,color);
  sg.addColorStop(1,shadeColor(color,-40));
  ctx.shadowColor=color; ctx.shadowBlur=20;
  ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(cx,cy,18,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;

  // Sphere highlight
  ctx.fillStyle="rgba(255,255,255,0.35)";
  ctx.beginPath(); ctx.ellipse(cx-5,cy-5,7,5,0.5,0,Math.PI*2); ctx.fill();

  // Emoji
  ctx.font="17px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(emoji, cx, cy);

  // Label
  ctx.fillStyle=color; ctx.font="bold 8px 'Segoe UI',sans-serif";
  ctx.textBaseline="top"; ctx.shadowColor="rgba(0,0,0,0.9)"; ctx.shadowBlur=4;
  ctx.fillText(label, cx, cy+21); ctx.shadowBlur=0;
  ctx.restore();
}

/* ─── Shared label helper ─── */
function drawLabel(ctx, cx, y, text, color) {
  ctx.save();
  // Pill background
  const tw=ctx.measureText(text).width;
  rr(ctx, cx-tw/2-6, y-13, tw+12, 14, 4, "rgba(0,0,0,0.75)");
  ctx.fillStyle=color; ctx.font="bold 9px 'Segoe UI',sans-serif";
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.shadowColor=color; ctx.shadowBlur=5;
  ctx.fillText(text, cx, y-6); ctx.shadowBlur=0;
  ctx.restore();
}

/* ═══════════════════════════════════════════════════
   OBSTACLE POOL — maps level ID to obstacle templates
═══════════════════════════════════════════════════ */
function getObstaclePools(levelId) {
  const G=(id,w,h,fn)=>({id,w,h,aerial:false,y:()=>FLOOR-h,fn});
  const A=(id,w,h,yf,fn)=>({id,w,h,aerial:true,y:()=>CH*yf-h/2,fn});

  const pools={
    earthquake:[
      G("rock1",  64,64, (c,x,y,t)=>sprRock(c,x,y,64,64,["#6b7280","#4b5563","#374151"])),
      G("rock2",  80,80, (c,x,y,t)=>sprRock(c,x,y,80,80,["#78716c","#57534e","#44403c"])),
      G("wall1",  34,220,(c,x,y,t)=>sprWall(c,x,y,34,220,["#4b5563","#374151","#1f2937"])),
      G("wall2",  70, 90,(c,x,y,t)=>sprWall(c,x,y,70,90,["#6b7280","#4b5563","#374151"])),
      G("car1",   96, 66,(c,x,y,t)=>sprCar(c,x,y,96,66,"#374151")),
      G("crack1", 110,28,(c,x,y,t)=>sprCrack(c,x,y,110,t)),
      A("beam1",  240,24,0.44,(c,x,y,t)=>sprBeam(c,x,y,240,24,"#6b7280")),
    ],
    flood:[
      G("rock1",  60,56,(c,x,y,t)=>sprRock(c,x,y,60,56,["#1e40af","#1e3a8a","#1e3380"])),
      G("car1",   96,64,(c,x,y,t)=>sprCar(c,x,y,96,64,"#1d4ed8")),
      G("wave1",  150,90,(c,x,y,t)=>sprWave(c,x,y,150,90,t,"#1e40af")),
      G("wave2",  110,70,(c,x,y,t)=>sprWave(c,x,y,110,70,t,"#1d4ed8")),
      A("beam1",  200,24,0.42,(c,x,y,t)=>sprBeam(c,x,y,200,24,"#1d4ed8")),
      A("wire1",  65,165,0.28,(c,x,y,t)=>sprWire(c,x,y,65,165,t)),
    ],
    fire:[
      G("flame1", 56,120,(c,x,y,t)=>sprFlame(c,x,y,56,120,t)),
      G("flame2", 42, 90,(c,x,y,t)=>sprFlame(c,x,y,42,90,t)),
      G("geyser1",44,  1,(c,x,y,t)=>sprGeyser(c,x,y,44,t,Math.sin(t*1.9)>0.2)),
      G("wall1",  34,200,(c,x,y,t)=>sprWall(c,x,y,34,200,["#78350f","#6b2e0c","#5c2508"])),
      A("beam1",  240,24,0.43,(c,x,y,t)=>sprBeam(c,x,y,240,24,"#78350f")),
      A("smoke1", 110,96,0.30,(c,x,y,t)=>sprSmoke(c,x,y,110,96,t)),
    ],
    cyclone:[
      G("rock1",  66,60,(c,x,y,t)=>sprRock(c,x,y,66,60,["#7c3aed","#6d28d9","#5b21b6"])),
      G("car1",   96,62,(c,x,y,t)=>sprCar(c,x,y,96,62,"#6d28d9")),
      G("wall1",  30,235,(c,x,y,t)=>sprWall(c,x,y,30,235,["#6d28d9","#5b21b6","#4c1d95"])),
      A("swirl1", 80,80,0.38,(c,x,y,t)=>sprDebrisSwirl(c,x+40,y+40,38,t,"#7c3aed")),
      A("swirl2", 65,65,0.52,(c,x,y,t)=>sprDebrisSwirl(c,x+32,y+32,30,t,"#6d28d9")),
      A("beam1",  260,24,0.37,(c,x,y,t)=>sprBeam(c,x,y,260,24,"#7c3aed")),
    ],
    tsunami:[
      G("rock1",  68,64,(c,x,y,t)=>sprRock(c,x,y,68,64,["#155e75","#0e7490","#0891b2"])),
      G("car1",   96,64,(c,x,y,t)=>sprCar(c,x,y,96,64,"#0c4a6e")),
      G("wave1",  170,105,(c,x,y,t)=>sprWave(c,x,y,170,105,t,"#0e7490")),
      G("wave2",  130,80,(c,x,y,t)=>sprWave(c,x,y,130,80,t,"#155e75")),
      A("wire1",  60,180,0.27,(c,x,y,t)=>sprWire(c,x,y,60,180,t)),
      A("beam1",  210,24,0.40,(c,x,y,t)=>sprBeam(c,x,y,210,24,"#0891b2")),
    ],
    tornado:[
      G("car1",   96,62,(c,x,y,t)=>sprCar(c,x,y,96,62,"#4338ca")),
      G("wall1",  32,225,(c,x,y,t)=>sprWall(c,x,y,32,225,["#4f46e5","#4338ca","#3730a3"])),
      G("rock1",  64,58,(c,x,y,t)=>sprRock(c,x,y,64,58,["#4f46e5","#4338ca","#3730a3"])),
      A("swirl1", 84,84,0.42,(c,x,y,t)=>sprDebrisSwirl(c,x+42,y+42,40,t,"#4f46e5")),
      A("swirl2", 68,68,0.57,(c,x,y,t)=>sprDebrisSwirl(c,x+34,y+34,32,t,"#6366f1")),
      A("beam1",  275,24,0.35,(c,x,y,t)=>sprBeam(c,x,y,275,24,"#6366f1")),
    ],
    wildfire:[
      G("flame1", 54,110,(c,x,y,t)=>sprFlame(c,x,y,54,110,t)),
      G("flame2", 40, 88,(c,x,y,t)=>sprFlame(c,x,y,40,88,t)),
      G("geyser1",46,  1,(c,x,y,t)=>sprGeyser(c,x,y,46,t,Math.sin(t*2.1)>0.15)),
      G("wall1",  34,205,(c,x,y,t)=>sprWall(c,x,y,34,205,["#78350f","#6b2e0c","#5c2508"])),
      A("smoke1", 118,100,0.28,(c,x,y,t)=>sprSmoke(c,x,y,118,100,t)),
      G("rock1",  62,58,(c,x,y,t)=>sprRock(c,x,y,62,58,["#92400e","#78350f","#6b2e0c"])),
    ],
    avalanche:[
      G("snow1",  70,66,(c,x,y,t)=>sprSnow(c,x,y,70,66,t)),
      G("snow2",  88,80,(c,x,y,t)=>sprSnow(c,x,y,88,80,t)),
      G("rock1",  66,62,(c,x,y,t)=>sprRock(c,x,y,66,62,["#cbd5e1","#94a3b8","#64748b"])),
      G("wall1",  30,220,(c,x,y,t)=>sprWall(c,x,y,30,220,["#93c5fd","#60a5fa","#3b82f6"])),
      A("beam1",  255,24,0.39,(c,x,y,t)=>sprBeam(c,x,y,255,24,"#93c5fd")),
    ],
    heatwave:[
      G("wall1",  34,205,(c,x,y,t)=>sprWall(c,x,y,34,205,["#78350f","#6b2e0c","#5c2508"])),
      G("car1",   96,62,(c,x,y,t)=>sprCar(c,x,y,96,62,"#92400e")),
      G("crack1", 115,28,(c,x,y,t)=>sprCrack(c,x,y,115,t)),
      A("beam1",  225,24,0.41,(c,x,y,t)=>sprBeam(c,x,y,225,24,"#d97706")),
      A("smoke1", 112,94,0.30,(c,x,y,t)=>sprSmoke(c,x,y,112,94,t)),
      G("rock1",  60,56,(c,x,y,t)=>sprRock(c,x,y,60,56,["#b45309","#a16207","#92400e"])),
    ],
    landslide:[
      G("rock1",  66,62,(c,x,y,t)=>sprRock(c,x,y,66,62,["#b45309","#a16207","#92400e"])),
      G("rock2",  80,76,(c,x,y,t)=>sprRock(c,x,y,80,76,["#92400e","#78350f","#6b2e0c"])),
      G("crack1", 108,28,(c,x,y,t)=>sprCrack(c,x,y,108,t)),
      G("wall1",  34,210,(c,x,y,t)=>sprWall(c,x,y,34,210,["#92400e","#78350f","#6b2e0c"])),
      A("beam1",  235,24,0.40,(c,x,y,t)=>sprBeam(c,x,y,235,24,"#b45309")),
    ],
  };
  return pools[levelId] || pools.earthquake;
}

/* Pickups per level */
const PICKUPS = {
  earthquake:[{em:"🧰",label:"FIRST AID",pts:100,col:"#22c55e"},{em:"⛑️",label:"HELMET",pts:80,col:"#3b82f6"},{em:"💧",label:"WATER",pts:50,col:"#06b6d4"}],
  flood:     [{em:"🛟",label:"LIFE RING",pts:100,col:"#22c55e"},{em:"🪢",label:"ROPE",pts:75,col:"#f59e0b"},{em:"📻",label:"RADIO",pts:50,col:"#8b5cf6"}],
  fire:      [{em:"🧯",label:"EXTINGUISHER",pts:110,col:"#22c55e"},{em:"😷",label:"MASK",pts:80,col:"#3b82f6"},{em:"🚪",label:"EXIT",pts:150,col:"#22c55e"}],
  cyclone:   [{em:"🏛️",label:"SHELTER",pts:100,col:"#22c55e"},{em:"⛑️",label:"HELMET",pts:75,col:"#3b82f6"},{em:"📱",label:"PHONE",pts:50,col:"#f59e0b"}],
  tsunami:   [{em:"🏢",label:"HIGH GROUND",pts:150,col:"#22c55e"},{em:"🚨",label:"ALARM",pts:80,col:"#ef4444"},{em:"🪢",label:"ROPE",pts:60,col:"#f59e0b"}],
  tornado:   [{em:"🏚️",label:"SHELTER",pts:100,col:"#22c55e"},{em:"⛑️",label:"HELMET",pts:75,col:"#3b82f6"},{em:"🪢",label:"ROPE",pts:50,col:"#f59e0b"}],
  wildfire:  [{em:"💧",label:"WATER",pts:100,col:"#3b82f6"},{em:"😷",label:"MASK",pts:80,col:"#22c55e"},{em:"🗺️",label:"MAP",pts:55,col:"#f59e0b"}],
  avalanche: [{em:"🔦",label:"BEACON",pts:110,col:"#22c55e"},{em:"📡",label:"TRACKER",pts:80,col:"#3b82f6"},{em:"⛏️",label:"TOOL",pts:60,col:"#f59e0b"}],
  heatwave:  [{em:"💧",label:"WATER",pts:80,col:"#06b6d4"},{em:"🧊",label:"ICE PACK",pts:100,col:"#3b82f6"},{em:"🩺",label:"MEDKIT",pts:90,col:"#22c55e"}],
  landslide: [{em:"🧰",label:"TOOLKIT",pts:100,col:"#22c55e"},{em:"🪢",label:"ROPE",pts:75,col:"#f59e0b"},{em:"📻",label:"RADIO",pts:50,col:"#8b5cf6"}],
};

/* ═══════════════════════════════════════════════════
   PARTICLE SYSTEM
═══════════════════════════════════════════════════ */
function spawnParticles(g, cx, cy, color, count=10) {
  for(let i=0;i<count;i++){
    const angle=Math.random()*Math.PI*2;
    const speed=80+Math.random()*160;
    g.particles.push({
      x:cx, y:cy,
      vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed-80,
      r:3+Math.random()*4,
      color, life:0.6+Math.random()*0.4, maxLife:1,
    });
  }
}

/* ═══════════════════════════════════════════════════
   HUD CANVAS RENDERER
═══════════════════════════════════════════════════ */
function drawHUD(ctx, g, lv, _ts) {

  /* ── Top Bar ── */
  // Subtle top bar background
  const topGrad=ctx.createLinearGradient(0,0,0,52);
  topGrad.addColorStop(0,"rgba(0,0,0,0.92)");
  topGrad.addColorStop(1,"rgba(0,0,0,0.55)");
  ctx.fillStyle=topGrad; ctx.fillRect(0,0,CW,52);

  // ── Lives (hearts) ──
  const maxL=g.char?.id==="ravi"?4:3;
  for(let i=0;i<maxL;i++){
    const alive=i<g.lives;
    ctx.globalAlpha=alive?1:0.2;
    ctx.font="18px serif";
    ctx.textAlign="left";
    ctx.shadowColor=alive?"#ef4444":"transparent";
    ctx.shadowBlur=alive?8:0;
    ctx.fillText(alive?"❤️":"🖤", 12+i*24, 32);
  }
  ctx.globalAlpha=1; ctx.shadowBlur=0;

  // ── Wave badge (center) ──
  const waveW=180;
  rr(ctx, CW/2-waveW/2, 8, waveW, 32, 8, lv.col+"22");
  ctx.strokeStyle=lv.col+"55"; ctx.lineWidth=1; ctx.strokeRect(CW/2-waveW/2, 8, waveW, 32);
  ctx.fillStyle=lv.col; ctx.font="bold 11px 'Segoe UI',sans-serif"; ctx.textAlign="center";
  ctx.shadowColor=lv.col; ctx.shadowBlur=8;
  ctx.fillText(`${lv.em} ${lv.name}  ·  WAVE ${g.wave}`, CW/2, 29);
  ctx.shadowBlur=0;

  // ── Score (right) ──
  ctx.fillStyle="#fbbf24"; ctx.font="bold 20px 'Segoe UI',sans-serif"; ctx.textAlign="right";
  ctx.shadowColor="#f59e0b"; ctx.shadowBlur=12;
  ctx.fillText(`⭐ ${g.score.toLocaleString()}`, CW-12, 32);
  ctx.shadowBlur=0;

  // Combo
  if(g.combo>=1.5){
    ctx.fillStyle="#f97316"; ctx.font="bold 10px 'Segoe UI',sans-serif"; ctx.textAlign="right";
    ctx.shadowColor="#f97316"; ctx.shadowBlur=6;
    ctx.fillText(`🔥 ×${g.combo.toFixed(1)} COMBO`, CW-12, 46);
    ctx.shadowBlur=0;
  }

  /* ── Progress bar ── */
  const barY=52, barH=6;
  ctx.fillStyle="#111"; ctx.fillRect(0,barY,CW,barH);
  const pw=(g.dist/100)*CW;
  const pCol=g.dist>68?"#22c55e":g.dist>38?"#f59e0b":lv.col;
  const pGrad=ctx.createLinearGradient(0,0,pw,0);
  pGrad.addColorStop(0,lv.col); pGrad.addColorStop(1,pCol);
  ctx.fillStyle=pGrad; ctx.fillRect(0,barY,pw,barH);
  ctx.shadowColor=pCol; ctx.shadowBlur=8;
  ctx.fillRect(pw-4,barY,4,barH); ctx.shadowBlur=0;
  if(!g.checkpoint){
    ctx.fillStyle="#f59e0b66"; ctx.fillRect(CW*0.5,barY,2,barH+3);
  }
  ctx.font="12px serif"; ctx.textAlign="right"; ctx.fillText("🏁",CW-4,barY+barH+13);

  /* ── Objective banner (first 4s) ── */
  if(g.surviveTime<4.5){
    const a=g.surviveTime<0.5?g.surviveTime/0.5:g.surviveTime>3.5?1-(g.surviveTime-3.5):1;
    ctx.save(); ctx.globalAlpha=a*0.96;
    rr(ctx, CW/2-270, 10, 540, 64, 12, "rgba(0,0,0,0.88)");
    ctx.strokeStyle=lv.col+"55"; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle=lv.col; ctx.font="bold 12px 'Segoe UI',sans-serif"; ctx.textAlign="center";
    ctx.shadowColor=lv.col; ctx.shadowBlur=10;
    ctx.fillText(`⚠ SURVIVE THE ${lv.name.toUpperCase()} — REACH THE EXIT`, CW/2, 32);
    ctx.shadowBlur=0;
    ctx.fillStyle="rgba(255,255,255,0.75)"; ctx.font="12px 'Segoe UI',sans-serif";
    ctx.fillText("← → Move   SPACE Jump   ↓ Duck   Collect supplies!", CW/2, 52);
    ctx.restore();
  }

  /* ── Wave-up notification ── */
  if(g.levelUpTimer>0){
    const waveMessages={
      earthquake:["AFTERSHOCK!","MAGNITUDE RISING!","COLLAPSE ZONE!"],
      flood:["SURGE INCOMING!","WATER LEVEL UP!","FLASH FLOOD!"],
      fire:["FIRE SPREADING!","BACKDRAFT!","CROWN FIRE!"],
      cyclone:["EYE WALL!","CATEGORY UP!","GALE FORCE!"],
      tsunami:["SECOND WAVE!","COASTAL SURGE!","WAVE GROWING!"],
      tornado:["VORTEX WIDENS!","DEBRIS FIELD!","F-SCALE UP!"],
      wildfire:["FIRE JUMPING!","EMBERS FLYING!","INFERNO!"],
      avalanche:["SNOWPACK FAILING!","SURGE INCOMING!","WHITE OUT!"],
      heatwave:["TEMP SPIKE!","HEAT DOME!","DANGER ZONE!"],
      landslide:["GROUND SLIPS!","DEBRIS SURGE!","MUDFLOW!"],
    };
    const msgs=waveMessages[lv.id]||["INTENSITY UP!"];
    const msg=msgs[Math.min(g.wave-2,msgs.length-1)]||"DISASTER ESCALATING!";
    const a=Math.min(1,g.levelUpTimer/0.4)*Math.min(1,g.levelUpTimer);
    ctx.save(); ctx.globalAlpha=a;
    // Backdrop
    rr(ctx, CW/2-220, CH/2-65, 440, 54, 12, "rgba(0,0,0,0.85)");
    ctx.strokeStyle=lv.col; ctx.lineWidth=2;
    ctx.shadowColor=lv.col; ctx.shadowBlur=20; ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle=lv.col; ctx.font="bold 24px 'Segoe UI',sans-serif"; ctx.textAlign="center";
    ctx.shadowColor=lv.col; ctx.shadowBlur=18;
    ctx.fillText(`⚡ WAVE ${g.wave} — ${msg}`, CW/2, CH/2-40);
    ctx.shadowBlur=0;
    ctx.restore();
  }

  /* ── Checkpoint flash ── */
  if(g.checkpointSfx){
    ctx.save(); ctx.globalAlpha=0.14;
    ctx.fillStyle="#22c55e"; ctx.fillRect(0,0,CW,CH);
    ctx.restore();
    ctx.fillStyle="#22c55e"; ctx.font="bold 22px 'Segoe UI',sans-serif"; ctx.textAlign="center";
    ctx.shadowColor="#22c55e"; ctx.shadowBlur=20;
    ctx.fillText("🏁 CHECKPOINT!", CW/2, CH/2-40); ctx.shadowBlur=0;
  }

  /* ── Controls (bottom-left, first 10s) ── */
  if(g.surviveTime<10){
    const ca=g.surviveTime<1?g.surviveTime:g.surviveTime>9?10-g.surviveTime:1;
    ctx.save(); ctx.globalAlpha=ca*0.82;
    rr(ctx, 8, CH-72, 312, 64, 8, "rgba(0,0,0,0.82)");
    ctx.fillStyle="#e5e7eb"; ctx.font="bold 10px 'Segoe UI',sans-serif"; ctx.textAlign="left";
    ctx.fillText("← A  /  → D     Move Left & Right", 16, CH-52);
    ctx.fillText("SPACE / ↑ / W   Jump", 16, CH-38);
    ctx.fillText("↓ / S           Fast Fall / Duck", 16, CH-24);
    if(g.char?.id==="vikram") ctx.fillText("SHIFT  Invincible Dash", 16, CH-10);
    ctx.restore();
  }

  /* ── NDMA tip (bottom, after 6s) ── */
  if(g.surviveTime>=6){
    const ta=Math.min(1,(g.surviveTime-6)/1.5);
    ctx.save(); ctx.globalAlpha=ta*0.88;
    const tipGrad=ctx.createLinearGradient(0,CH-30,0,CH);
    tipGrad.addColorStop(0,"rgba(0,0,0,0.8)"); tipGrad.addColorStop(1,"rgba(0,0,0,0.95)");
    ctx.fillStyle=tipGrad; ctx.fillRect(0,CH-30,CW,30);
    ctx.fillStyle=lv.col; ctx.font="bold 10px 'Segoe UI',sans-serif"; ctx.textAlign="left";
    ctx.fillText("💡 NDMA: ", 10, CH-11);
    ctx.fillStyle="rgba(255,255,255,0.58)"; ctx.font="10px 'Segoe UI',sans-serif";
    ctx.fillText(lv.tip, 78, CH-11);
    ctx.restore();
  }
}

/* ── Quiz disaster categories derived from QUIZ_QUESTIONS ── */
const QUIZ_CATEGORIES = (() => {
  const CAT_META = {
    Earthquake: { em:"🌍", col:"#dc2626", id:"earthquake" },
    Flood:      { em:"🌊", col:"#2563eb", id:"flood" },
    Cyclone:    { em:"🌀", col:"#7c3aed", id:"cyclone" },
    Tsunami:    { em:"🏄", col:"#0891b2", id:"tsunami" },
    Wildfire:   { em:"🌲", col:"#c2410c", id:"wildfire" },
    Landslide:  { em:"⛰️", col:"#b45309", id:"landslide" },
    Heatwave:   { em:"🌡️", col:"#d97706", id:"heatwave" },
    Tornado:    { em:"🌪️", col:"#4f46e5", id:"tornado" },
    General:    { em:"🚨", col:"#059669", id:"general" },
  };
  const map = {};
  for (const q of QUIZ_QUESTIONS) {
    if (!map[q.cat]) map[q.cat] = [];
    map[q.cat].push(q);
  }
  return Object.entries(map).map(([cat, questions]) => ({
    cat, questions, ...CAT_META[cat] || { em:"❓", col:"#6b7280", id:cat.toLowerCase() },
  }));
})();

function QuizTab({ quizShuffle, quizIdx, setQuizIdx, quizAns, setQuizAns, quizScore, setQuizScore, quizDone, setQuizDone, resetQuiz, quizCat, setQuizCat, setQuizShuffle }) {
  const [hovCat, setHovCat] = React.useState(null);

  /* ── Disaster selector screen ── */
  if (!quizCat) {
    return (
      <div style={{padding:"0 18px 60px",maxWidth:"860px",margin:"0 auto",animation:"fadeIn 0.4s ease-out"}}>
        <div style={{textAlign:"center",marginBottom:"22px"}}>
          <p style={{color:"#374151",fontSize:"0.68rem",letterSpacing:"3px",textTransform:"uppercase",margin:0}}>— Select a Disaster to be Quizzed On —</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:"10px"}}>
          {QUIZ_CATEGORIES.map((cat) => (
            <button key={cat.cat}
              onClick={()=>{
                SFX.select();
                const shuffled = [...cat.questions].sort(()=>Math.random()-0.5);
                setQuizShuffle(shuffled);
                setQuizIdx(0); setQuizAns(null); setQuizScore(0); setQuizDone(false);
                setQuizCat(cat);
              }}
              onMouseEnter={()=>setHovCat(cat.cat)}
              onMouseLeave={()=>setHovCat(null)}
              style={{padding:"22px 14px",textAlign:"center",cursor:"pointer",
                background:hovCat===cat.cat?"#0d0d0d":"#070707",
                border:`1px solid ${hovCat===cat.cat?cat.col:"#141414"}`,borderRadius:"18px",
                transition:"all 0.22s ease",
                transform:hovCat===cat.cat?"translateY(-6px)":"none",
                boxShadow:hovCat===cat.cat?`0 14px 35px ${cat.col}2e,0 0 0 1px ${cat.col}18`:"0 2px 8px rgba(0,0,0,0.3)"}}>
              <div style={{fontSize:"2.4rem",marginBottom:"10px",filter:hovCat===cat.cat?`drop-shadow(0 0 14px ${cat.col})`:"none",transition:"filter 0.22s"}}>{cat.em}</div>
              <div style={{color:"white",fontWeight:800,fontSize:"0.82rem",letterSpacing:"1px",marginBottom:"6px"}}>{cat.cat.toUpperCase()}</div>
              <div style={{fontSize:"0.62rem",padding:"3px 11px",borderRadius:"10px",background:`${cat.col}18`,color:cat.col,border:`1px solid ${cat.col}35`,display:"inline-block"}}>
                {cat.questions.length} Questions
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const total = quizShuffle.length;
  const q     = quizShuffle[quizIdx];
  const pct   = Math.round((quizIdx / total) * 100);

  function handleAnswer(i) {
    if (quizAns !== null) return;
    setQuizAns(i);
    if (i === q.ans) { SFX.success?.() || SFX.win?.() || SFX.coin(); setQuizScore(s => s + 10); }
    else { SFX.fail?.() || SFX.hit(); }
  }
  function next() {
    if (quizIdx + 1 >= total) { setQuizDone(true); SFX.win(); }
    else { setQuizIdx(i => i + 1); setQuizAns(null); }
  }

  const CAT_COLORS = { Earthquake:"#dc2626", Flood:"#2563eb", Cyclone:"#7c3aed", Tsunami:"#0891b2", Wildfire:"#c2410c", Landslide:"#b45309", Heatwave:"#d97706", Tornado:"#4f46e5", General:"#059669" };
  const catCol = CAT_COLORS[q?.cat] || "#6b7280";

  if (quizDone) return (
    <div style={{padding:"24px 20px 60px",maxWidth:"620px",margin:"0 auto",textAlign:"center",animation:"fadeIn 0.5s ease-out"}}>
      <div style={{fontSize:"5rem",marginBottom:"16px",animation:"pulse 1s ease-in-out infinite"}}>🏆</div>
      <h2 style={{color:"white",fontSize:"2rem",fontWeight:900,margin:"0 0 8px",letterSpacing:"2px"}}>Quiz Complete!</h2>
      <p style={{color:"#4b5563",marginBottom:"24px"}}>You answered {total} questions on {quizCat?.cat}</p>
      <div style={{background:"#0a0a0a",borderRadius:"20px",padding:"28px",marginBottom:"20px",border:"1px solid #1a1a1a"}}>
        <div style={{fontSize:"4rem",fontWeight:900,color: quizScore>=total*7?"#22c55e":quizScore>=total*5?"#f59e0b":"#ef4444",
          textShadow:`0 0 30px ${quizScore>=total*7?"#22c55e":quizScore>=total*5?"#f59e0b":"#ef4444"}66`}}>
          {quizScore}/{total*10}
        </div>
        <div style={{color:"#374151",fontSize:"0.75rem",marginTop:"6px"}}>
          {quizScore>=total*9?"🌟 Outstanding — Disaster Expert!":quizScore>=total*7?"✅ Great — Well Prepared!":quizScore>=total*5?"📚 Good — Keep Learning!":"💪 Keep Practising — Lives Depend on It!"}
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:"10px",marginTop:"16px",flexWrap:"wrap"}}>
          {["Correct","Skipped"].map((l,i)=>(
            <div key={l} style={{background:"#111",borderRadius:"10px",padding:"10px 18px",textAlign:"center",border:"1px solid #1a1a1a"}}>
              <div style={{color:i===0?"#22c55e":"#ef4444",fontWeight:800,fontSize:"1.4rem"}}>{i===0?quizScore/10:total-quizScore/10}</div>
              <div style={{color:"#374151",fontSize:"0.62rem"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
        <button onClick={resetQuiz}
          style={{padding:"13px 28px",background:"#dc2626",border:"none",borderRadius:"14px",color:"white",cursor:"pointer",fontWeight:800,fontSize:"0.92rem",letterSpacing:"1px",boxShadow:"0 6px 24px rgba(220,38,38,0.4)",transition:"transform 0.2s"}}
          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"}
          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
          🔄 Try Again
        </button>
        <button onClick={()=>{setQuizCat(null);setQuizDone(false);setQuizIdx(0);setQuizAns(null);setQuizScore(0);}}
          style={{padding:"13px 22px",background:"transparent",border:"1px solid #1a1a1a",borderRadius:"14px",color:"#4b5563",cursor:"pointer",fontSize:"0.92rem",transition:"all 0.2s"}}
          onMouseEnter={e=>{e.currentTarget.style.color="white";e.currentTarget.style.borderColor="#444";}}
          onMouseLeave={e=>{e.currentTarget.style.color="#4b5563";e.currentTarget.style.borderColor="#1a1a1a";}}>
          🌍 All Disasters
        </button>
      </div>
    </div>
  );

  return (
    <div style={{padding:"0 18px 60px",maxWidth:"680px",margin:"0 auto",animation:"fadeIn 0.4s ease-out"}}>
      {/* Back + Progress */}
      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
        <button onClick={()=>{setQuizCat(null);setQuizDone(false);setQuizIdx(0);setQuizAns(null);setQuizScore(0);}}
          style={{background:"transparent",border:"1px solid #1a1a1a",color:"#4b5563",padding:"6px 14px",borderRadius:"8px",cursor:"pointer",fontSize:"0.75rem",transition:"all 0.18s",flexShrink:0,whiteSpace:"nowrap"}}
          onMouseEnter={e=>{e.currentTarget.style.color="white";e.currentTarget.style.borderColor="#333";}}
          onMouseLeave={e=>{e.currentTarget.style.color="#4b5563";e.currentTarget.style.borderColor="#1a1a1a";}}>
          ← Back
        </button>
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"5px"}}>
            <span style={{color:"#374151",fontSize:"0.68rem",letterSpacing:"1px"}}>Question {quizIdx+1} of {total}</span>
            <span style={{color:"#fbbf24",fontSize:"0.72rem",fontWeight:700}}>⭐ {quizScore} pts</span>
          </div>
          <div style={{height:"5px",background:"#111",borderRadius:"3px",overflow:"hidden",border:"1px solid #1a1a1a"}}>
            <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#dc2626,#f97316)",transition:"width 0.4s ease",boxShadow:"0 0 10px rgba(220,38,38,0.5)"}}/>
          </div>
        </div>
      </div>

      {/* Question card */}
      <div style={{background:"#070707",borderRadius:"20px",border:`1px solid ${catCol}30`,overflow:"hidden",boxShadow:`0 8px 32px ${catCol}15`}}>
        {/* Category badge */}
        <div style={{background:`${catCol}14`,borderBottom:`1px solid ${catCol}22`,padding:"12px 20px",display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{fontSize:"1.6rem"}}>{q.em}</span>
          <div>
            <span style={{background:`${catCol}22`,color:catCol,fontSize:"0.62rem",fontWeight:800,padding:"3px 10px",borderRadius:"8px",letterSpacing:"1px",border:`1px solid ${catCol}35`}}>{q.cat.toUpperCase()}</span>
            <div style={{color:"#1f2937",fontSize:"0.6rem",marginTop:"3px"}}>Disaster Awareness Question</div>
          </div>
        </div>

        {/* Question */}
        <div style={{padding:"22px 22px 16px"}}>
          <p style={{color:"white",fontSize:"1.05rem",fontWeight:700,margin:0,lineHeight:1.55}}>{q.q}</p>
        </div>

        {/* Options */}
        <div style={{padding:"0 16px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"9px"}}>
          {q.opts.map((opt, i) => {
            const isSelected = quizAns === i;
            const isCorrect  = i === q.ans;
            const revealed   = quizAns !== null;
            let bg = "#0d0d0d", border = "#1a1a1a", col = "#6b7280";
            if (revealed) {
              if (isCorrect) { bg="#052e16"; border="#22c55e"; col="#22c55e"; }
              else if (isSelected) { bg="#1f0707"; border="#ef4444"; col="#ef4444"; }
            } else if (isSelected) { bg="#111"; border=catCol; col="white"; }
            return (
              <button key={i} onClick={()=>handleAnswer(i)}
                style={{padding:"13px 14px",background:bg,border:`1.5px solid ${border}`,borderRadius:"12px",cursor:revealed?"default":"pointer",
                  color:col,fontSize:"0.83rem",fontWeight:600,textAlign:"left",lineHeight:1.4,
                  transition:"all 0.22s ease",
                  transform:!revealed?"translateY(0)":"none",
                  boxShadow:revealed&&isCorrect?`0 0 18px rgba(34,197,94,0.3)`:revealed&&isSelected?`0 0 18px rgba(239,68,68,0.3)`:"none"}}
                onMouseEnter={e=>{if(!revealed)e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";}}>
                <span style={{display:"inline-block",width:"22px",height:"22px",borderRadius:"50%",background:revealed?isCorrect?"#22c55e":isSelected?"#ef4444":"#111":"#111",border:`1px solid ${revealed?isCorrect?"#22c55e":isSelected?"#ef4444":border:border}`,marginRight:"9px",fontSize:"0.7rem",lineHeight:"22px",textAlign:"center",color:revealed?isCorrect||isSelected?"white":col:col,fontWeight:800,flexShrink:0,verticalAlign:"middle",transition:"all 0.2s"}}>
                  {revealed?(isCorrect?"✓":isSelected?"✗":String.fromCharCode(65+i)):String.fromCharCode(65+i)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {quizAns !== null && (
          <div style={{margin:"0 16px 16px",padding:"14px 16px",background: quizAns===q.ans?"#052e16":"#1c0707",borderRadius:"12px",border:`1px solid ${quizAns===q.ans?"#22c55e":"#dc2626"}35`,animation:"fadeIn 0.35s ease-out"}}>
            <div style={{color:quizAns===q.ans?"#22c55e":"#f87171",fontSize:"0.8rem",fontWeight:800,marginBottom:"5px",letterSpacing:"0.5px"}}>
              {quizAns===q.ans?"✅ CORRECT!":"❌ INCORRECT"}
            </div>
            <p style={{color:"#9ca3af",fontSize:"0.8rem",margin:0,lineHeight:1.6}}>{q.exp}</p>
          </div>
        )}

        {/* Next button */}
        {quizAns !== null && (
          <div style={{padding:"0 16px 20px",textAlign:"right"}}>
            <button onClick={next}
              style={{padding:"10px 26px",background:"#dc2626",border:"none",borderRadius:"10px",color:"white",cursor:"pointer",fontWeight:800,fontSize:"0.85rem",letterSpacing:"1px",boxShadow:"0 4px 16px rgba(220,38,38,0.4)",transition:"transform 0.15s,box-shadow 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.04)";e.currentTarget.style.boxShadow="0 6px 22px rgba(220,38,38,0.55)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 4px 16px rgba(220,38,38,0.4)";}}>
              {quizIdx+1>=total?"See Results →":"Next Question →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   AWARENESS MODE COMPONENT
══════════════════════════════════════════════════ */
/* ── Awareness disaster categories derived from SCENARIOS ── */
const AWARE_CATEGORIES = (() => {
  const map = {};
  for (const sc of SCENARIOS) {
    // Normalise "Flash Flood" → group with "Flood"
    const key = sc.disaster.replace("Flash ","");
    if (!map[key]) map[key] = { disaster:key, em:sc.em, col:sc.col, scenarios:[] };
    map[key].scenarios.push(sc);
  }
  return Object.values(map);
})();

function AwarenessTab({ awareSc, setAwareSc, awareAns, setAwareAns, awareLives, setAwareLives, awareScore, setAwareScore, awareDone, setAwareDone, awarePre, setAwarePre, resetAware, awareCat, setAwareCat, awareScenariosFiltered, setAwareScenariosFiltered }) {
  const [hovCat, setHovCat] = React.useState(null);
  const sc     = awareScenariosFiltered[awareSc];
  const total  = awareScenariosFiltered.length;
  const [shakeOn, setShakeOn] = React.useState(false);

  // Trigger shake animation when alert is shown
  React.useEffect(() => {
    if (awarePre && sc?.shake) {
      setShakeOn(true);
      const t = setInterval(()=>setShakeOn(s=>!s), 130);
      return ()=>clearInterval(t);
    }
    setShakeOn(false);
  }, [awarePre, awareSc, sc]);

  /* ── Disaster selector screen ── */
  if (!awareCat) {
    return (
      <div style={{padding:"0 18px 60px",maxWidth:"860px",margin:"0 auto",animation:"fadeIn 0.4s ease-out"}}>
        <div style={{textAlign:"center",marginBottom:"22px"}}>
          <p style={{color:"#374151",fontSize:"0.68rem",letterSpacing:"3px",textTransform:"uppercase",margin:0}}>— Select a Disaster Scenario —</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:"10px"}}>
          {AWARE_CATEGORIES.map((cat) => (
            <button key={cat.disaster}
              onClick={()=>{
                SFX.select();
                setAwareCat(cat);
                setAwareScenariosFiltered(cat.scenarios);
                setAwareSc(0); setAwareAns(null); setAwareLives(3); setAwareScore(0); setAwareDone(false); setAwarePre(true);
              }}
              onMouseEnter={()=>setHovCat(cat.disaster)}
              onMouseLeave={()=>setHovCat(null)}
              style={{padding:"22px 14px",textAlign:"center",cursor:"pointer",
                background:hovCat===cat.disaster?"#0d0d0d":"#070707",
                border:`1px solid ${hovCat===cat.disaster?cat.col:"#141414"}`,borderRadius:"18px",
                transition:"all 0.22s ease",
                transform:hovCat===cat.disaster?"translateY(-6px)":"none",
                boxShadow:hovCat===cat.disaster?`0 14px 35px ${cat.col}2e,0 0 0 1px ${cat.col}18`:"0 2px 8px rgba(0,0,0,0.3)"}}>
              <div style={{fontSize:"2.4rem",marginBottom:"10px",filter:hovCat===cat.disaster?`drop-shadow(0 0 14px ${cat.col})`:"none",transition:"filter 0.22s"}}>{cat.em}</div>
              <div style={{color:"white",fontWeight:800,fontSize:"0.82rem",letterSpacing:"1px",marginBottom:"6px"}}>{cat.disaster.toUpperCase()}</div>
              <div style={{fontSize:"0.62rem",padding:"3px 11px",borderRadius:"10px",background:`${cat.col}18`,color:cat.col,border:`1px solid ${cat.col}35`,display:"inline-block"}}>
                {cat.scenarios.length} Scenario{cat.scenarios.length!==1?"s":""}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function handleChoice(i) {
    if (awareAns !== null) return;
    setAwareAns(i);
    const choice = sc.choices[i];
    if (choice.correct) { SFX.success?.() || SFX.win(); setAwareScore(s => s + 30); }
    else {
      SFX.fail?.() || SFX.hit();
      const newLives = awareLives - 1;
      setAwareLives(newLives);
    }
  }

  function nextScenario() {
    if (awareSc + 1 >= total || awareLives <= 0) { setAwareDone(true); SFX.win(); }
    else { setAwareSc(i=>i+1); setAwareAns(null); setAwarePre(true); }
  }

  // DONE screen
  if (awareDone) {
    const survived = awareLives > 0;
    return (
      <div style={{padding:"24px 20px 60px",maxWidth:"620px",margin:"0 auto",textAlign:"center",animation:"fadeIn 0.5s ease-out"}}>
        <div style={{fontSize:"5rem",marginBottom:"16px",animation:"pulse 1s ease-in-out infinite"}}>{survived?"🛡️":"💀"}</div>
        <h2 style={{color:survived?"#22c55e":"#ef4444",fontSize:"2rem",fontWeight:900,margin:"0 0 8px",letterSpacing:"2px"}}>{survived?"ALL SCENARIOS CLEARED!":"TRAINING FAILED"}</h2>
        <p style={{color:"#4b5563",marginBottom:"24px"}}>{survived?"You made the right decisions in all disaster scenarios.":"Run the training again to master all scenarios."}</p>
        <div style={{background:"#0a0a0a",borderRadius:"20px",padding:"28px",marginBottom:"20px",border:`1px solid ${survived?"#22c55e":"#ef4444"}22`}}>
          <div style={{fontSize:"4rem",fontWeight:900,color:survived?"#22c55e":"#ef4444"}}>{awareScore}</div>
          <div style={{color:"#374151",fontSize:"0.72rem",marginTop:"4px"}}>Awareness Points</div>
          <div style={{display:"flex",justifyContent:"center",gap:"10px",marginTop:"16px",flexWrap:"wrap"}}>
            <div style={{background:"#111",borderRadius:"10px",padding:"10px 18px",border:"1px solid #1a1a1a"}}>
              <div style={{color:"#22c55e",fontWeight:800,fontSize:"1.4rem"}}>{awareSc+1}</div>
              <div style={{color:"#374151",fontSize:"0.62rem"}}>Scenarios</div>
            </div>
            <div style={{background:"#111",borderRadius:"10px",padding:"10px 18px",border:"1px solid #1a1a1a"}}>
              <div style={{color:"#ef4444",fontWeight:800,fontSize:"1.4rem",display:"flex",gap:"4px",justifyContent:"center"}}>
                {Array.from({length:3}).map((_,i)=><span key={i} style={{opacity:i<awareLives?1:0.2}}>{i<awareLives?"❤️":"🖤"}</span>)}
              </div>
              <div style={{color:"#374151",fontSize:"0.62rem"}}>Lives Left</div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={resetAware}
            style={{padding:"13px 28px",background:"#dc2626",border:"none",borderRadius:"14px",color:"white",cursor:"pointer",fontWeight:800,fontSize:"0.92rem",letterSpacing:"1px",boxShadow:"0 6px 24px rgba(220,38,38,0.4)",transition:"transform 0.2s"}}
            onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"}
            onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
            🔄 Play Again
          </button>
          <button onClick={()=>{ setAwareCat(null); setAwareDone(false); setAwareSc(0); setAwareAns(null); setAwareLives(3); setAwareScore(0); setAwarePre(true); setAwareScenariosFiltered(SCENARIOS); }}
            style={{padding:"13px 22px",background:"transparent",border:"1px solid #1a1a1a",borderRadius:"14px",color:"#4b5563",cursor:"pointer",fontSize:"0.92rem",transition:"all 0.2s"}}
            onMouseEnter={e=>{e.currentTarget.style.color="white";e.currentTarget.style.borderColor="#444";}}
            onMouseLeave={e=>{e.currentTarget.style.color="#4b5563";e.currentTarget.style.borderColor="#1a1a1a";}}>
            🌍 All Disasters
          </button>
        </div>
      </div>
    );
  }

  // PRE-SCREEN: Alert / situation intro
  if (awarePre) return (
    <div style={{padding:"0 18px 60px",maxWidth:"680px",margin:"0 auto",animation:"fadeIn 0.4s ease-out"}}>
      {/* Lives + progress */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <button onClick={()=>{ setAwareCat(null); setAwareSc(0); setAwareAns(null); setAwareLives(3); setAwareScore(0); setAwareDone(false); setAwarePre(true); setAwareScenariosFiltered(SCENARIOS); }}
            style={{background:"transparent",border:"1px solid #1a1a1a",color:"#4b5563",padding:"5px 12px",borderRadius:"7px",cursor:"pointer",fontSize:"0.7rem",transition:"all 0.18s"}}
            onMouseEnter={e=>{e.currentTarget.style.color="white";e.currentTarget.style.borderColor="#333";}}
            onMouseLeave={e=>{e.currentTarget.style.color="#4b5563";e.currentTarget.style.borderColor="#1a1a1a";}}>
            ← Back
          </button>
          <div style={{display:"flex",gap:"4px",alignItems:"center"}}>
            {Array.from({length:3}).map((_,i)=>(
              <span key={i} style={{fontSize:"1rem",opacity:i<awareLives?1:0.18,transition:"opacity 0.3s",filter:i<awareLives?"drop-shadow(0 0 5px #ef4444)":"none"}}>{i<awareLives?"❤️":"🖤"}</span>
            ))}
            <span style={{color:"#374151",fontSize:"0.65rem",marginLeft:"6px"}}>Lives</span>
          </div>
        </div>
        <span style={{color:"#fbbf24",fontWeight:700,fontSize:"0.75rem"}}>⭐ {awareScore} pts &nbsp;·&nbsp; Scenario {awareSc+1}/{total}</span>
      </div>

      {/* Alert banner */}
      <div style={{borderRadius:"18px",overflow:"hidden",border:`1px solid ${sc.col}`,animation:"alertFlash 1.2s ease-in-out infinite",background:`${sc.col}14`,marginBottom:"16px"}}>
        <div style={{background:`${sc.col}22`,padding:"14px 20px",display:"flex",alignItems:"center",gap:"12px",animation:shakeOn?"shakeAnim 0.12s ease-in-out":"none"}}>
          <span style={{fontSize:"2.4rem",filter:`drop-shadow(0 0 16px ${sc.col})`}}>{sc.em}</span>
          <div>
            <div style={{color:"white",fontWeight:900,fontSize:"1rem",letterSpacing:"1.5px"}}>{sc.alert}</div>
            <div style={{color:sc.col,fontSize:"0.72rem",fontWeight:600,marginTop:"3px"}}>{sc.alertSub}</div>
          </div>
          <span style={{marginLeft:"auto",width:"10px",height:"10px",borderRadius:"50%",background:sc.col,boxShadow:`0 0 14px ${sc.col}`,animation:"blink 0.6s ease-in-out infinite",display:"inline-block",flexShrink:0}}/>
        </div>
        <div style={{padding:"14px 20px 10px",background:"radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0.3),transparent)"}}>
          <div style={{color:"#9ca3af",fontSize:"0.68rem",letterSpacing:"2px",textTransform:"uppercase",marginBottom:"6px"}}>{sc.disaster} · {sc.title}</div>
          <p style={{color:"white",fontSize:"1rem",fontWeight:600,lineHeight:1.65,margin:"0 0 14px"}}>{sc.desc}</p>
        </div>
      </div>

      <div style={{textAlign:"center"}}>
        <button onClick={()=>{setAwarePre(false); sc.sfx && SFX[sc.sfx]?.();}}
          style={{padding:"13px 36px",background:`${sc.col}`,border:"none",borderRadius:"14px",color:"white",cursor:"pointer",fontWeight:800,fontSize:"0.95rem",letterSpacing:"1.5px",boxShadow:`0 6px 28px ${sc.col}55`,transition:"transform 0.2s,box-shadow 0.2s",animation:"pulse 1.5s ease-in-out infinite"}}
          onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.06)";e.currentTarget.style.animation="none";}}
          onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.animation="pulse 1.5s ease-in-out infinite";}}>
          ⚡ DECIDE NOW
        </button>
        <p style={{color:"#374151",fontSize:"0.64rem",marginTop:"10px"}}>Choose the correct survival action</p>
      </div>
    </div>
  );

  // CHOICE SCREEN
  const chosen  = sc.choices[awareAns];
  const correct = chosen?.correct;

  return (
    <div style={{padding:"0 18px 60px",maxWidth:"680px",margin:"0 auto",animation:"fadeIn 0.35s ease-out"}}>
      {/* Lives + score bar */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <button onClick={()=>{ setAwareCat(null); setAwareSc(0); setAwareAns(null); setAwareLives(3); setAwareScore(0); setAwareDone(false); setAwarePre(true); setAwareScenariosFiltered(SCENARIOS); }}
            style={{background:"transparent",border:"1px solid #1a1a1a",color:"#4b5563",padding:"5px 12px",borderRadius:"7px",cursor:"pointer",fontSize:"0.7rem",transition:"all 0.18s"}}
            onMouseEnter={e=>{e.currentTarget.style.color="white";e.currentTarget.style.borderColor="#333";}}
            onMouseLeave={e=>{e.currentTarget.style.color="#4b5563";e.currentTarget.style.borderColor="#1a1a1a";}}>
            ← Back
          </button>
          <div style={{display:"flex",gap:"4px",alignItems:"center"}}>
            {Array.from({length:3}).map((_,i)=>(
              <span key={i} style={{fontSize:"1rem",opacity:i<awareLives?1:0.18,filter:i<awareLives?"drop-shadow(0 0 5px #ef4444)":"none"}}>{i<awareLives?"❤️":"🖤"}</span>
            ))}
          </div>
        </div>
        <span style={{color:"#fbbf24",fontWeight:700,fontSize:"0.75rem"}}>⭐ {awareScore} pts</span>
      </div>

      {/* Scenario summary */}
      <div style={{background:"#070707",border:`1px solid ${sc.col}25`,borderRadius:"18px",padding:"16px 20px",marginBottom:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
          <span style={{fontSize:"1.5rem"}}>{sc.em}</span>
          <span style={{color:sc.col,fontSize:"0.72rem",fontWeight:800,letterSpacing:"1px"}}>{sc.title.toUpperCase()}</span>
        </div>
        <p style={{color:"#6b7280",fontSize:"0.83rem",margin:0,lineHeight:1.55}}>{sc.desc}</p>
      </div>

      {/* Question */}
      <div style={{color:"white",fontWeight:800,fontSize:"1rem",marginBottom:"14px",padding:"0 2px"}}>
        ⚡ What is the correct survival action?
      </div>

      {/* Choices */}
      <div style={{display:"grid",gap:"9px",marginBottom:"16px"}}>
        {sc.choices.map((ch, i) => {
          const isSelected = awareAns === i;
          const revealed   = awareAns !== null;
          let bg="#0d0d0d", border="#1a1a1a", textCol="#6b7280";
          if (revealed) {
            if (ch.correct)     { bg="#052e16"; border="#22c55e"; textCol="#22c55e"; }
            else if (isSelected){ bg="#1f0707"; border="#ef4444"; textCol="#ef4444"; }
          }
          return (
            <button key={i} onClick={()=>handleChoice(i)}
              style={{padding:"14px 18px",background:bg,border:`1.5px solid ${border}`,borderRadius:"13px",cursor:revealed?"default":"pointer",
                color:textCol,fontSize:"0.88rem",fontWeight:600,textAlign:"left",lineHeight:1.45,
                transition:"all 0.22s ease",
                boxShadow:revealed&&ch.correct?"0 0 20px rgba(34,197,94,0.25)":revealed&&isSelected?"0 0 20px rgba(239,68,68,0.25)":"none"}}
              onMouseEnter={e=>{if(!revealed){e.currentTarget.style.background="#111";e.currentTarget.style.borderColor=sc.col;e.currentTarget.style.color="white";e.currentTarget.style.transform="translateX(4px)";}}}
              onMouseLeave={e=>{if(!revealed){e.currentTarget.style.background="#0d0d0d";e.currentTarget.style.borderColor="#1a1a1a";e.currentTarget.style.color="#6b7280";e.currentTarget.style.transform="translateX(0)";}}}>
              <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"26px",height:"26px",borderRadius:"50%",background:revealed?ch.correct?"#22c55e":isSelected?"#ef4444":"#111":"#111",border:`1px solid ${revealed?ch.correct?"#22c55e":isSelected?"#ef4444":"#333":"#333"}`,marginRight:"11px",fontSize:"0.7rem",fontWeight:800,color:revealed?ch.correct||isSelected?"white":textCol:"#374151",flexShrink:0,verticalAlign:"middle",transition:"all 0.2s"}}>
                {revealed?(ch.correct?"✓":isSelected?"✗":String.fromCharCode(65+i)):String.fromCharCode(65+i)}
              </span>
              {ch.text}
            </button>
          );
        })}
      </div>

      {/* Result explanation */}
      {awareAns !== null && (
        <div style={{padding:"16px 18px",background:correct?"#052e16":"#1c0707",borderRadius:"14px",border:`1px solid ${correct?"#22c55e":"#dc2626"}35`,marginBottom:"16px",animation:"fadeIn 0.35s ease-out"}}>
          <div style={{color:correct?"#22c55e":"#f87171",fontWeight:800,fontSize:"0.88rem",marginBottom:"7px",letterSpacing:"0.5px"}}>
            {correct?"✅ CORRECT SURVIVAL ACTION!":"❌ WRONG CHOICE — Learn from this:"}
          </div>
          <p style={{color:"#9ca3af",fontSize:"0.82rem",margin:0,lineHeight:1.6}}>{sc.choices[awareAns].explain}</p>
          {!correct && awareLives <= 0 && (
            <div style={{marginTop:"12px",padding:"10px 14px",background:"rgba(239,68,68,0.1)",borderRadius:"8px",border:"1px solid #ef444430"}}>
              <span style={{color:"#ef4444",fontWeight:700,fontSize:"0.8rem"}}>💀 No lives remaining — Training ended.</span>
            </div>
          )}
        </div>
      )}

      {/* Continue button */}
      {awareAns !== null && (
        <button onClick={nextScenario}
          style={{width:"100%",padding:"13px 0",background:awareLives<=0&&!correct?"#1f2937":sc.col,border:"none",borderRadius:"13px",color:"white",cursor:"pointer",fontWeight:800,fontSize:"0.92rem",letterSpacing:"1px",boxShadow:`0 4px 20px ${sc.col}44`,transition:"transform 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.02)"}
          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
          {awareSc+1>=total||awareLives<=0?"📊 See Final Results":"Next Scenario →"}
        </button>
      )}
    </div>
  );
}


export default function PanicMode() {

  /* Screen: "menu" | "charselect" | "game" | "win" | "lose" */
  const [screen,   setScreen]   = useState("menu");
  const [selDis,   setSelDis]   = useState(null);
  const [char,     setChar]     = useState(null);
  const [hovD,     setHovD]     = useState(null);
  const [hovC,     setHovC]     = useState(null);
  const [hud,      setHud]      = useState({ score:0, lives:3, combo:1, dist:0, tip:"" });
  const [endScore, setEndScore] = useState(0);
  // New modes
  const [menuTab,   setMenuTab]   = useState("runner");  // "runner"|"quiz"|"awareness"
  // Quiz state
  const [quizIdx,   setQuizIdx]   = useState(0);
  const [quizAns,   setQuizAns]   = useState(null);  // selected option index
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone,  setQuizDone]  = useState(false);
  const [quizCat,   setQuizCat]   = useState(null);  // selected disaster category
  const [quizShuffle, setQuizShuffle] = useState([]);
  // Awareness state
  const [awareSc,   setAwareSc]   = useState(0);    // current scenario index
  const [awareAns,  setAwareAns]  = useState(null); // chosen option index
  const [awareLives,setAwareLives]= useState(3);
  const [awareScore,setAwareScore]= useState(0);
  const [awareDone, setAwareDone] = useState(false);
  const [awarePre,  setAwarePre]  = useState(true);  // pre-scenario alert screen
  const [awareCat,  setAwareCat]  = useState(null);  // selected disaster category
  const [awareScenariosFiltered, setAwareScenariosFiltered] = useState(SCENARIOS);

  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const prevT     = useRef(0);

  /* ─── Mutable game state (lives in a ref to avoid re-render overhead) ─── */
  /* ══════════════════════════════════════════════════
     GAME STATE REF  — all mutable game data lives here
     to avoid triggering React re-renders inside the loop
  ══════════════════════════════════════════════════ */
  const G = useRef({
    /* ── lifecycle ── */
    running:       false,
    pendingEnd:    null,   // "win"|"lose" — set inside loop, consumed outside

    /* ── player position (px) ── */
    px:            PLX,          // horizontal position (NEW: player can move L/R)
    py:            FLOOR,        // feet Y
    pvx:           0,            // horizontal velocity
    pvy:           0,            // vertical velocity
    onGround:      true,         // robust ground flag
    jumps:         0,            // 0=grounded,1=first jump,2=double jump used

    /* ── animation ── */
    runFrame:      0,
    frameTick:     0,
    facingRight:   true,

    /* ── status ── */
    isHurt:        false,
    hurtTimer:     0,
    isInvincible:  false,
    invTimer:      0,
    hasShield:     false,
    isDashing:     false,
    dashTimer:     0,

    /* ── game stats ── */
    lives:         3,
    score:         0,
    highScore:     0,
    combo:         1,
    comboTimer:    0,
    dist:          0,           // 0–100 progress to exit
    wave:          1,           // difficulty wave (increases over time)
    waveTimer:     0,           // time until next wave
    surviveTime:   0,           // seconds alive (extra reward)

    /* ── scroll ── */
    scrollX:       0,
    bgX:           0,
    baseSpeed:     260,         // initial world scroll speed px/s
    speed:         260,         // current world speed

    /* ── entities ── */
    obstacles:     [],
    pickups:       [],
    particles:     [],          // visual burst particles on collect/hit
    popups:        [],          // floating score text

    /* ── spawn timers ── */
    obsTimer:      1.8,         // time until next obstacle (starts with gap)
    pkpTimer:      2.5,
    lastObsX:      9999,        // track last obstacle X to guarantee minimum gap

    /* ── feedback ── */
    shakeTimer:    0,
    shakeIntensity:0,
    flashTimer:    0,           // green flash on pickup
    levelUpTimer:  0,           // wave-up text display

    /* ── checkpoint ── */
    checkpoint:    false,       // reached halfway checkpoint
    checkpointSfx: false,

    /* ── disaster mechanics ── */
    risingLevel:   CH + 50,     // Y position of rising hazard (water/snow) — starts below screen
    risingSpeed:   0,           // how fast hazard rises
    stamina:       100,         // 0-100 oxygen/heat meter for fire/flood/heat levels
    staminaTimer:  0,
    geyserTimer:   0,           // periodic geyser/eruption events
    geyserActive:  false,
    lightningTimer: 0,          // lightning flashes for cyclone/tornado
    debrisTimer:   0,           // falling debris spawn timer
    fallingDebris: [],          // active falling debris objects
    envParticles:  [],          // environment particles (ash, snow, rain)
    envParTimer:   0,
    dangerLevel:   0,           // 0-1 overall danger intensity (affects visuals)

    /* ── references ── */
    level:         null,
    char:          null,
    keys:          {},
  });

  /* ══════════════════════════════════════════════════
     KEYBOARD  — robust, no accidental scroll
  ══════════════════════════════════════════════════ */
  useEffect(() => {
    const g = G.current;

    const onDown = e => {
      // Prevent page scroll for game keys
      if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight",
           "KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight"].includes(e.code)) {
        e.preventDefault();
      }

      const wasHeld = g.keys[e.code];
      g.keys[e.code] = true;
      if (!g.running || wasHeld) return;   // ignore held keys for one-shot actions

      /* ── JUMP: Space / ↑ / W ── */
      if (e.code==="Space" || e.code==="ArrowUp" || e.code==="KeyW") {
        if (g.onGround) {
          g.pvy = -720; g.onGround = false; g.jumps = 1;
          SFX.jump();
        } else if (g.char?.id === "arjun" && g.jumps < 2) {
          // Arjun double jump — slightly weaker so arc is distinct from first jump
          g.pvy = -580; g.jumps = 2;
          SFX.jump();
        }
      }

      /* ── FAST FALL: ↓ / S ── */
      if ((e.code==="ArrowDown" || e.code==="KeyS") && !g.onGround) {
        g.pvy = 820;   // instant fast fall — clear and deliberate
      }

      /* ── DASH: Shift (Vikram only) ── */
      if ((e.code==="ShiftLeft" || e.code==="ShiftRight") &&
           g.char?.id === "vikram" && !g.isDashing) {
        g.isDashing    = true;
        g.dashTimer    = 0.38;
        g.isInvincible = true;
        g.invTimer     = 0.44;
        // Dash gives a brief speed burst in facing direction
        g.pvx          = g.facingRight ? 340 : -340;
        SFX.dash();
      }
    };

    const onUp = e => { delete g.keys[e.code]; };

    window.addEventListener("keydown", onDown, { passive: false });
    window.addEventListener("keyup",   onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup",   onUp);
    };
  }, []);

  /* ══════════════════════════════════════════════════
     TOUCH / CLICK CONTROLS
  ══════════════════════════════════════════════════ */
  const handleTap = useCallback(() => {
    const g = G.current;
    if (!g.running) return;
    if (g.onGround) {
      g.pvy = -720; g.onGround = false; g.jumps = 1; SFX.jump();
    } else if (g.char?.id === "arjun" && g.jumps < 2) {
      g.pvy = -580; g.jumps = 2; SFX.jump();
    }
  }, []);

  const handleDash = useCallback(() => {
    const g = G.current;
    if (!g.running || g.char?.id !== "vikram" || g.isDashing) return;
    g.isDashing = true; g.dashTimer = 0.38;
    g.isInvincible = true; g.invTimer = 0.44;
    g.pvx = g.facingRight ? 340 : -340;
    SFX.dash();
  }, []);

  // Mobile L/R — pointer-held buttons inject directly into key state
  const handleMoveStart = useCallback((dir) => {
    const g = G.current;
    if (!g.running) return;
    if (dir === "left")  { g.keys["ArrowLeft"]  = true; g.facingRight = false; }
    if (dir === "right") { g.keys["ArrowRight"] = true; g.facingRight = true;  }
  }, []);
  const handleMoveEnd = useCallback((dir) => {
    const g = G.current;
    if (dir === "left")  delete g.keys["ArrowLeft"];
    if (dir === "right") delete g.keys["ArrowRight"];
  }, []);

  /* ══════════════════════════════════════════════════
     START GAME
  ══════════════════════════════════════════════════ */
  function startGame(level, character) {
    cancelAnimationFrame(rafRef.current);   // always cancel before restart
    const g   = G.current;
    const isMeera  = character?.id === "meera";
    const isRavi   = character?.id === "ravi";
    const initSpeed = level.speed * (isMeera ? 0.72 : 1);

    SFX.alarm();

    Object.assign(g, {
      running:false,          // set true AFTER state is ready
      pendingEnd: null,
      px: PLX, py: FLOOR,
      pvx: 0, pvy: 0,
      onGround: true, jumps: 0, facingRight: true,
      runFrame: 0, frameTick: 0,
      isHurt: false, hurtTimer: 0,
      isInvincible: false, invTimer: 0,
      hasShield: character?.id === "priya",
      isDashing: false, dashTimer: 0,
      lives:   isRavi ? 4 : 3,
      score:   0, highScore: g.highScore || 0,
      combo:   1, comboTimer: 0,
      dist:    0, wave: 1, waveTimer: 18, surviveTime: 0,
      scrollX: 0, bgX: 0,
      baseSpeed: initSpeed, speed: initSpeed,
      obstacles: [], pickups: [], particles: [], popups: [],
      obsTimer: 2.0,      // generous starting gap
      pkpTimer: 2.2,
      lastObsX: 9999,
      shakeTimer: 0, shakeIntensity: 0,
      flashTimer: 0, levelUpTimer: 0,
      checkpoint: false, checkpointSfx: false,
      lastSurviveBonus: 0,
      // Disaster mechanics
      risingLevel: CH + 80,
      risingSpeed: 0,
      stamina: 100,
      staminaTimer: 0,
      geyserTimer: 3 + Math.random() * 4,
      geyserActive: false,
      lightningTimer: 2 + Math.random() * 5,
      debrisTimer: 1.5 + Math.random() * 2,
      fallingDebris: [],
      envParticles: [],
      envParTimer: 0,
      dangerLevel: 0,
      level, char: character, keys: {},
    });

    setHud({ score: 0, lives: g.lives, combo: 1, dist: 0, wave: 1, tip: level.tip });
    setEndScore(0);

    // Small delay so canvas is mounted before loop starts
    setTimeout(() => {
      g.running  = true;
      prevT.current = performance.now();
      rafRef.current = requestAnimationFrame(gameLoop);
    }, 60);
  }

  function stopGame() {
    G.current.running = false;
    cancelAnimationFrame(rafRef.current);
  }
  /* ══════════════════════════════════════════════════
     APPLY HIT
  ══════════════════════════════════════════════════ */
  function applyHit(g) {
    if (g.isInvincible || g.pendingEnd) return;
    if (g.hasShield) {
      g.hasShield    = false;
      g.isInvincible = true;
      g.invTimer     = 0.8;
      g.shakeTimer   = 0.2;
      g.shakeIntensity = 5;
      spawnParticles(g, g.px + PLW/2, g.py - PLH/2, "#60a5fa", 10);
      SFX.dash();
      return;
    }
    g.lives--;
    g.isHurt       = true;
    g.hurtTimer    = 0.55;
    g.isInvincible = true;
    g.invTimer     = 2.2;
    g.combo        = 1;
    g.comboTimer   = 0;
    g.shakeTimer   = 0.45;
    g.shakeIntensity = 9;
    spawnParticles(g, g.px + PLW/2, g.py - PLH/2, "#ef4444", 12);
    SFX.hit();
    if (g.lives <= 0) {
      g.running    = false;
      g.pendingEnd = "lose";
      SFX.die();
    }
  }

  /* ══════════════════════════════════════════════════
     GAME LOOP  — 60 fps rAF loop, zero React setState
     except the throttled HUD sync
  ══════════════════════════════════════════════════ */
  const hudSyncTimer = useRef(0);

  const gameLoop = useCallback(ts => {
    const g = G.current;

    /* ── Guard: if not running, stop immediately ── */
    if (!g.running) {
      // Handle deferred screen transitions (set inside loop, applied here)
      if (g.pendingEnd === "lose") {
        setEndScore(g.score);
        setTimeout(() => setScreen("lose"), 400);
        g.pendingEnd = null;
      } else if (g.pendingEnd === "win") {
        setEndScore(g.score + g.lives * 450);
        setTimeout(() => setScreen("win"),  300);
        g.pendingEnd = null;
      }
      return;
    }

    /* ── Delta time: capped at 50ms to prevent spiral of death ── */
    const now = performance.now();
    const dt  = Math.min((now - prevT.current) / 1000, 0.05);
    prevT.current = now;

    const lv  = g.level;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lv) { rafRef.current = requestAnimationFrame(gameLoop); return; }

    /* ════════════════════════════
       1. SURVIVE TIMER + WAVE
    ════════════════════════════ */
    g.surviveTime += dt;
    g.waveTimer   -= dt;
    if (g.waveTimer <= 0) {
      g.wave++;
      g.waveTimer    = 22 + g.wave * 3;
      g.levelUpTimer = 2.5;
      g.baseSpeed = Math.min(lv.speed * 1.65, g.baseSpeed * 1.08);
      SFX.alarm?.() || SFX.select();
    }
    if (g.levelUpTimer > 0) g.levelUpTimer -= dt;

    // Survive-time bonus: +15 pts every 5 seconds — reward staying alive
    const surviveFloor = Math.floor(g.surviveTime / 5);
    if (!g.lastSurviveBonus) g.lastSurviveBonus = 0;
    if (surviveFloor > g.lastSurviveBonus) {
      g.lastSurviveBonus = surviveFloor;
      g.score += 15;
      g.popups.push({ x: g.px + PLW/2, y: g.py - PLH - 20, text: "+15 SURVIVE", life: 1.1 });
    }

    /* ════════════════════════════
       2. PLAYER MOVEMENT (L/R)
    ════════════════════════════ */
    const keys  = g.keys;
    const moveL = keys["ArrowLeft"]  || keys["KeyA"];
    const moveR = keys["ArrowRight"] || keys["KeyD"];

    // Horizontal movement — responsive acceleration + strong friction for snappy feel
    const accel    = 880;          // px/s²  (faster response)
    const friction = 720;          // px/s²  (snappy stop)
    const maxHSpd  = 320;          // px/s   (fast enough to dodge meaningfully)

    if (moveL && !moveR) {
      g.pvx -= accel * dt;
      g.facingRight = false;
      if (g.pvx < -maxHSpd) g.pvx = -maxHSpd;
    } else if (moveR && !moveL) {
      g.pvx += accel * dt;
      g.facingRight = true;
      if (g.pvx >  maxHSpd) g.pvx =  maxHSpd;
    } else {
      // Friction — stop quickly so player doesn't slide into obstacles
      if (Math.abs(g.pvx) < friction * dt) g.pvx = 0;
      else g.pvx -= Math.sign(g.pvx) * friction * dt;
    }

    // Apply horizontal movement — full-width lane so L/R movement is meaningful
    // LANE_L: keep player from going off left edge
    // LANE_R: keep player visible (leave right 180px for incoming obstacles to be seen)
    const LANE_L = 48;
    const LANE_R = CW - 180;
    g.px += g.pvx * dt;
    if (g.px < LANE_L) { g.px = LANE_L; g.pvx = 0; }
    if (g.px > LANE_R) { g.px = LANE_R; g.pvx = 0; }

    /* ════════════════════════════
       3. PHYSICS (vertical)
    ════════════════════════════ */
    const GRAV = 1800;   // same as global GRAVITY

    if (!g.onGround) {
      // Variable gravity: rise slowly, fall faster = snappy platformer feel
      // Extra pull only during downward phase (positive pvy = falling)
      const fallingBoost = g.pvy > 80  ? 560 : 0;
      // Low-jump cut: if jump key released early, cut upward velocity for variable height
      const jumpHeld = g.keys["Space"] || g.keys["ArrowUp"] || g.keys["KeyW"];
      const cutGrav  = (!jumpHeld && g.pvy < 0 && g.jumps >= 1) ? 780 : 0;
      g.pvy += (GRAV + fallingBoost + cutGrav) * dt;
      g.pvy  = Math.min(g.pvy, 1320);   // terminal velocity
    }

    g.py += g.pvy * dt;

    // Ground collision
    if (g.py >= FLOOR) {
      if (g.pvy > 120 && !g.onGround) SFX.land();
      g.py      = FLOOR;
      g.pvy     = 0;
      g.onGround = true;
      g.jumps    = 0;
    } else {
      g.onGround = false;
    }

    /* ════════════════════════════
       4. STATUS TIMERS
    ════════════════════════════ */
    g.frameTick += dt;
    if (g.frameTick > 0.085) { g.runFrame = (g.runFrame + 1) % 4; g.frameTick = 0; }

    if (g.hurtTimer  > 0) { g.hurtTimer  -= dt; if (g.hurtTimer  <= 0) g.isHurt      = false; }
    if (g.invTimer   > 0) { g.invTimer   -= dt; if (g.invTimer   <= 0) { g.isInvincible = false; g.isDashing = false; } }
    if (g.dashTimer  > 0) { g.dashTimer  -= dt; if (g.dashTimer  <= 0) { g.isDashing   = false; if (Math.abs(g.pvx) > maxHSpd) g.pvx = Math.sign(g.pvx) * maxHSpd; } }
    if (g.comboTimer > 0) { g.comboTimer -= dt; if (g.comboTimer <= 0) g.combo = 1; }
    if (g.shakeTimer > 0) { g.shakeTimer -= dt; if (g.shakeTimer <= 0) g.shakeIntensity = 0; }
    if (g.flashTimer > 0)   g.flashTimer -= dt;
    if (g.checkpointSfx)    g.checkpointSfx = false;   // one-frame flag

    /* ════════════════════════════
       5. WORLD SCROLL
       Speed ramps up smoothly toward base target
    ════════════════════════════ */
    g.speed   += (g.baseSpeed - g.speed) * Math.min(1, dt * 2.5);
    g.scrollX += g.speed * dt;
    g.bgX     += g.speed * dt;
    g.dist    += g.speed * dt * 0.007;    // 0→100 in ~55s at base speed

    /* Checkpoint at 50% */
    if (!g.checkpoint && g.dist >= 50) {
      g.checkpoint    = true;
      g.checkpointSfx = true;
      g.score        += 250;
      g.popups.push({ x: CW/2, y: CH/2 - 30, text: "🏁 CHECKPOINT! +250", life: 2.0, big: true });
      SFX.success();
    }

    /* ════════════════════════════
       5b. DISASTER MECHANICS
    ════════════════════════════ */
    const mech = LEVEL_MECHANICS[lv.id] || {};
    const lvId = lv.id;

    // Update overall danger level
    g.dangerLevel = Math.min(1, g.dist / 80 + (g.wave - 1) * 0.12);

    // ── RISING HAZARD (flood, tsunami, avalanche, landslide) ──
    if (mech.risingHazard) {
      // Start rising after wave 1, accelerate with waves
      const riseDelay = 8; // seconds before rising starts
      if (g.surviveTime > riseDelay) {
        const baseRiseSpeed = lvId === "tsunami" ? 14 : lvId === "avalanche" ? 12 : 10;
        g.risingSpeed = baseRiseSpeed * (1 + g.wave * 0.15) * (g.surviveTime - riseDelay) / 20;
        g.risingSpeed = Math.min(g.risingSpeed, 45);
        g.risingLevel -= g.risingSpeed * dt;
        g.risingLevel = Math.max(g.risingLevel, FLOOR - 160); // cap how high it rises
      }

      // Player touched rising hazard
      if (g.py >= g.risingLevel - 8 && !g.isInvincible) {
        applyHit(g);
        g.risingLevel -= 30; // knock back the hazard slightly after hit (mercy)
        if(lvId==="flood"||lvId==="tsunami") SFX.flood?.() || SFX.hit();
        else SFX.hit();
      }
    } else {
      g.risingLevel = CH + 80; // keep offscreen if not rising level
    }

    // ── STAMINA (fire, flood, wildfire, heatwave) ──
    if (mech.staminaDrain) {
      g.staminaTimer += dt;
      if (g.staminaTimer > 0.12) {
        g.staminaTimer = 0;
        // Drain faster at higher waves and when near obstacles
        const nearHazard = g.obstacles.some(o => Math.abs(o.x - g.px) < 140);
        const drainRate = (lvId === "heatwave" ? 0.7 : lvId === "fire" || lvId === "wildfire" ? 1.1 : 0.5)
                        * (1 + g.wave * 0.06) * (nearHazard ? 1.4 : 1);
        g.stamina = Math.max(0, g.stamina - drainRate);
        if (g.stamina === 0 && !g.isInvincible) {
          // Stamina depleted — slow the player and drain lives faster
          applyHit(g);
          g.stamina = 35; // reset to partial after hit
        }
      }
    } else {
      g.stamina = 100; // full stamina for non-stamina levels
    }

    // ── FALLING DEBRIS (earthquake, cyclone, tornado, landslide, avalanche) ──
    if (mech.fallingDebris) {
      g.debrisTimer -= dt;
      if (g.debrisTimer <= 0) {
        const debrisCount = 1 + Math.floor(g.wave / 3);
        for (let d = 0; d < debrisCount; d++) {
          const debrisX = CW * 0.25 + Math.random() * CW * 0.65;
          const debrisSize = 28 + Math.random() * 32;
          const debrisColors = {
            earthquake:["#78716c","#6b7280","#57534e"],
            cyclone:["#7c3aed","#6d28d9","#5b21b6"],
            tornado:["#4f46e5","#4338ca","#6366f1"],
            landslide:["#92400e","#78350f","#a16207"],
            avalanche:["#bae6fd","#e0f2fe","#7dd3fc"],
          };
          const colors = debrisColors[lvId] || ["#6b7280","#78716c"];
          g.fallingDebris.push({
            x: debrisX,
            y: -debrisSize,
            vy: 180 + Math.random() * 160 + g.wave * 20,
            size: debrisSize,
            color: colors[Math.floor(Math.random()*colors.length)],
            rotation: Math.random() * Math.PI,
            rotSpeed: (Math.random()-0.5)*4,
            active: true,
            warned: false,
          });
        }
        g.debrisTimer = Math.max(0.6, 2.5 - g.wave * 0.18) + Math.random() * 0.8;
      }

      // Update falling debris
      for (const db of g.fallingDebris) {
        db.y += db.vy * dt;
        db.rotation += db.rotSpeed * dt;
        db.active = db.y < CH + db.size;

        if (db.active && !g.isInvincible) {
          const pL = g.px + 10, pR = g.px + PLW - 10;
          const pT = g.py - PLH + 12, pB = g.py - 6;
          const dR = db.x + db.size, dB = db.y + db.size;
          if (pR > db.x + 6 && pL < dR - 6 && pB > db.y + 6 && pT < dB - 6) {
            applyHit(g);
            db.active = false;
            spawnParticles(g, db.x + db.size/2, db.y + db.size/2, db.color, 8);
          }
        }
      }
      g.fallingDebris = g.fallingDebris.filter(d => d.active);
    } else {
      g.fallingDebris = [];
    }

    // ── GROUND CRACKS (earthquake, landslide) ──
    // Ground cracks are drawn in background — they don't independently move
    // but we track timing for when cracks pulse/glow

    // ── ENVIRONMENT PARTICLES (rain, ash, snow, embers) ──
    g.envParTimer -= dt;
    if (g.envParTimer <= 0) {
      g.envParTimer = 0.02 + Math.random() * 0.03;
      const parCount = 1 + Math.floor(g.wave / 2);
      for (let p = 0; p < parCount; p++) {
        let par;
        if (lvId === "flood" || lvId === "tsunami") {
          par = { x: Math.random()*CW, y: -8, vy: 280+Math.random()*120, vx: -40-Math.random()*60,
                  size: 1+Math.random()*2.5, color:"rgba(147,197,253,0.7)", type:"rain" };
        } else if (lvId === "fire" || lvId === "wildfire") {
          par = { x: Math.random()*CW, y: CH+8, vy: -80-Math.random()*100, vx: (Math.random()-0.5)*40,
                  size: 2+Math.random()*3, color:`rgba(${251},${146+Math.floor(Math.random()*60)},${60},0.7)`, type:"ember" };
        } else if (lvId === "avalanche") {
          par = { x: Math.random()*CW, y: -8, vy: 120+Math.random()*80, vx: -20-Math.random()*30,
                  size: 2+Math.random()*4, color:"rgba(224,242,254,0.8)", type:"snow" };
        } else if (lvId === "cyclone" || lvId === "tornado") {
          par = { x: CW+10, y: Math.random()*CH, vy: (Math.random()-0.5)*60, vx: -200-Math.random()*150,
                  size: 1+Math.random()*3, color:"rgba(100,116,139,0.6)", type:"debris" };
        } else if (lvId === "heatwave") {
          par = { x: Math.random()*CW, y: CH+8, vy: -50-Math.random()*60, vx: (Math.random()-0.5)*20,
                  size: 1.5+Math.random()*2, color:`rgba(251,191,36,${0.2+Math.random()*0.3})`, type:"heat" };
        } else if (lvId === "earthquake" || lvId === "landslide") {
          par = { x: Math.random()*CW, y: -8, vy: 60+Math.random()*80, vx: (Math.random()-0.5)*30,
                  size: 1+Math.random()*3, color:"rgba(161,97,7,0.5)", type:"dust" };
        } else {
          par = null;
        }
        if (par) { par.life = 1; par.maxLife = 1; g.envParticles.push(par); }
      }
    }
    for (const p of g.envParticles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.4;
    }
    g.envParticles = g.envParticles.filter(p => p.life > 0 && p.x > -20 && p.x < CW+20 && p.y < CH+20 && p.y > -20);
    // Cap to avoid memory leak
    if (g.envParticles.length > 200) g.envParticles = g.envParticles.slice(-150);

    /* ════════════════════════════
       6. SPAWN OBSTACLES
       Guarantee a minimum pixel gap between obstacles
       so the player ALWAYS has a fair window to react
    ════════════════════════════ */
    g.obsTimer -= dt;
    if (g.obsTimer <= 0) {
      const pool = getObstaclePools(lv.id);

      // Count how many obstacles are still on-screen and far enough right
      const frontObs = g.obstacles.filter(o => o.x > CW - 260);
      if (frontObs.length === 0) {

        // Wave 1-2: ground only, so player learns jumping first
        // Wave 3+: introduce aerial; wave 5+: all types equal chance
        let eligible = pool.filter(p => !p.falling); // falling debris handled separately above
        if (g.wave <= 2) eligible = eligible.filter(p => !p.aerial);
        else if (g.wave <= 4) eligible = eligible.filter((p, i) => !p.aerial || i % 3 === 0);
        if (eligible.length === 0) eligible = pool.filter(p => !p.falling);

        const tmpl = eligible[Math.floor(Math.random() * eligible.length)];
        g.obstacles.push({
          ...tmpl,
          x:      CW + 30,
          y:      tmpl.y(),
          vx:     -(g.speed * (0.96 + Math.random() * 0.10)),
          active: true,
          warned: false,
          id:     Date.now() + Math.random(),
        });

        // Gap time: wave 1 = very generous, increases with wave, hard floor
        const baseGap  = Math.max(0.70, 1.60 - g.wave * 0.08);
        const randGap  = Math.random() * Math.max(0.30, 0.80 - g.wave * 0.04);
        g.obsTimer = baseGap + randGap;
      } else {
        g.obsTimer = 0.25;
      }
    }

    /* ════════════════════════════
       7. SPAWN PICKUPS
       All pickups must be reachable:
       ground-level = no jump needed,
       mid-air      = one normal jump reaches it
    ════════════════════════════ */
    g.pkpTimer -= dt;
    if (g.pkpTimer <= 0) {
      g.pkpTimer = 1.8 + Math.random() * 1.2;
      const pkPool  = PICKUPS[lv.id] || PICKUPS.earthquake;
      const tmpl    = pkPool[Math.floor(Math.random() * pkPool.length)];

      // 50% ground-level (just above floor, easy grab)
      // 50% mid-air but ONLY within single-jump reach: FLOOR - 60 to FLOOR - 150
      const onGround = Math.random() < 0.5;
      const pickupY  = onGround
        ? FLOOR - 58                        // standing height — walk into it
        : FLOOR - 70 - Math.random() * 80; // jump range — always clearable

      g.pickups.push({
        ...tmpl,
        x:      CW + 30,
        y:      pickupY,
        baseY:  pickupY,
        vx:     -g.speed,
        bob:    Math.random() * Math.PI * 2,
        bobSpd: 2.2 + Math.random() * 0.6,
        active: true,
      });
    }

    /* ════════════════════════════
       8. UPDATE OBSTACLES + COLLISION
    ════════════════════════════ */
    for (const o of g.obstacles) {
      o.x  += o.vx * dt;
      o.active = o.x > -320;

      if (!g.isInvincible && o.active) {
        // Hit-box shrunk 10px each side — visually fair
        const pL = g.px + 10,  pR = g.px + PLW - 10;
        const pT = g.py - PLH + 12, pB = g.py - 6;
        const oR = o.x + o.w,  oB = o.y + o.h;
        if (pR > o.x + 8 && pL < oR - 8 && pB > o.y + 8 && pT < oB - 8) {
          applyHit(g);
          o.active = false;
        }
      }
    }
    g.obstacles = g.obstacles.filter(o => o.active);

    /* ════════════════════════════
       9. UPDATE PICKUPS + COLLECT
    ════════════════════════════ */
    for (const p of g.pickups) {
      p.vx    = -g.speed;          // keep in sync with current speed
      p.x    += p.vx * dt;
      p.bob  += p.bobSpd * dt;
      p.y     = p.baseY + Math.sin(p.bob) * 7;   // bob around base Y, not drift
      p.active = p.x > -80;

      if (p.active) {
        const pL = g.px,      pR = g.px + PLW;
        const pT = g.py - PLH, pB = g.py;
        if (pR - 4 > p.x + 4 && pL + 4 < p.x + 38 - 4 &&
            pB - 4 > p.y + 4 && pT + 4 < p.y + 38 - 4) {
          // Collect!
          const mult = g.char?.id === "ananya" ? 1.5 : 1;
          const pts  = Math.round(p.pts * mult * g.combo);
          g.score      += pts;
          g.combo       = Math.min(10, g.combo + 0.5);
          g.comboTimer  = 3.5;
          g.flashTimer  = 0.12;
          p.active      = false;
          SFX.coin();
          spawnParticles(g, p.x + 20, p.y + 20, p.col, 8);
          g.popups.push({ x: p.x + 20, y: p.y - 5, text: `+${pts}`, life: 1.2 });
        }
      }
    }
    g.pickups = g.pickups.filter(p => p.active);

    /* ════════════════════════════
       10. PARTICLES
    ════════════════════════════ */
    for (const p of g.particles) {
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 400 * dt;    // gravity on particles
      p.life -= dt;
    }
    g.particles = g.particles.filter(p => p.life > 0);

    /* ════════════════════════════
       11. POPUPS
    ════════════════════════════ */
    for (const p of g.popups) {
      p.life -= dt * (p.big ? 0.6 : 1.0);
      p.y    -= p.big ? 0.5 : 0.9;
    }
    g.popups = g.popups.filter(p => p.life > 0);

    /* ════════════════════════════
       12. WIN CHECK
    ════════════════════════════ */
    if (g.dist >= 100 && !g.pendingEnd) {
      g.running    = false;
      g.pendingEnd = "win";
      SFX.win();
      // pendingEnd will be consumed on next rAF tick (when running=false)
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    /* ════════════════════════════
       13. RENDER
    ════════════════════════════ */
    const t = ts * 0.001;

    ctx.save();

    // Screen shake
    if (g.shakeTimer > 0) {
      const si = g.shakeIntensity * (g.shakeTimer / 0.45);
      ctx.translate(
        (Math.random() - 0.5) * si,
        (Math.random() - 0.5) * si * 0.55
      );
    }

    // Background
    paintBackground(ctx, lv, g.scrollX, t);

    // ── ENVIRONMENT PARTICLES (rain, ash, snow, embers — behind obstacles) ──
    for (const p of g.envParticles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life) * 0.85;
      ctx.fillStyle = p.color;
      if (p.type === "rain") {
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx*0.04, p.y + p.vy*0.04); ctx.stroke();
      } else if (p.type === "snow") {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
      } else if (p.type === "ember") {
        ctx.shadowColor = p.color; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    // ── RISING HAZARD (flood water / snow / lava) ──
    const mech2 = LEVEL_MECHANICS[lv.id] || {};
    if (mech2.risingHazard && g.risingLevel < CH + 40) {
      ctx.save();
      const lvId2 = lv.id;
      if (lvId2 === "flood" || lvId2 === "tsunami") {
        // Water fill
        const wg2=ctx.createLinearGradient(0,g.risingLevel,0,CH);
        wg2.addColorStop(0,"rgba(30,64,175,0.88)");
        wg2.addColorStop(0.3,"rgba(29,78,216,0.92)");
        wg2.addColorStop(1,"rgba(7,89,133,0.97)");
        ctx.fillStyle=wg2;
        ctx.fillRect(0, g.risingLevel, CW, CH - g.risingLevel);
        // Animated water surface
        ctx.strokeStyle="rgba(147,197,253,0.7)"; ctx.lineWidth=3;
        ctx.shadowColor="#93c5fd"; ctx.shadowBlur=12;
        ctx.beginPath();
        for(let wi=0;wi<=CW;wi+=12){
          const wy=g.risingLevel+Math.sin(t*3.2+wi*0.04)*8;
          wi===0?ctx.moveTo(wi,wy):ctx.lineTo(wi,wy);
        }
        ctx.stroke(); ctx.shadowBlur=0;
        // Danger label when close to player
        if (g.risingLevel < FLOOR + 40) {
          ctx.fillStyle="rgba(147,197,253,0.9)"; ctx.font="bold 11px 'Segoe UI',sans-serif";
          ctx.textAlign="center"; ctx.shadowColor="rgba(0,0,0,0.9)"; ctx.shadowBlur=5;
          ctx.fillText("⚠ RISING WATER — STAY HIGH!", CW/2, g.risingLevel - 12);
          ctx.shadowBlur=0;
        }
      } else if (lvId2 === "avalanche") {
        // Snow fill
        const sg2=ctx.createLinearGradient(0,g.risingLevel,0,CH);
        sg2.addColorStop(0,"rgba(224,242,254,0.85)");
        sg2.addColorStop(1,"rgba(186,230,253,0.95)");
        ctx.fillStyle=sg2;
        ctx.fillRect(0, g.risingLevel, CW, CH - g.risingLevel);
        // Snowy surface
        ctx.strokeStyle="rgba(255,255,255,0.8)"; ctx.lineWidth=3;
        ctx.beginPath();
        for(let si=0;si<=CW;si+=15){
          const sy=g.risingLevel+Math.sin(t*2+si*0.05)*6;
          si===0?ctx.moveTo(si,sy):ctx.lineTo(si,sy);
        }
        ctx.stroke();
        if (g.risingLevel < FLOOR + 40) {
          ctx.fillStyle="rgba(224,242,254,0.9)"; ctx.font="bold 11px 'Segoe UI',sans-serif";
          ctx.textAlign="center"; ctx.shadowColor="rgba(0,0,0,0.9)"; ctx.shadowBlur=5;
          ctx.fillText("⚠ AVALANCHE RISING — KEEP MOVING!", CW/2, g.risingLevel - 12);
          ctx.shadowBlur=0;
        }
      } else {
        // Generic mudslide/landslide fill
        const lg2=ctx.createLinearGradient(0,g.risingLevel,0,CH);
        lg2.addColorStop(0,"rgba(120,53,15,0.88)");
        lg2.addColorStop(1,"rgba(92,40,0,0.97)");
        ctx.fillStyle=lg2;
        ctx.fillRect(0, g.risingLevel, CW, CH - g.risingLevel);
        if (g.risingLevel < FLOOR + 40) {
          ctx.fillStyle="#f97316"; ctx.font="bold 11px 'Segoe UI',sans-serif";
          ctx.textAlign="center"; ctx.shadowColor="rgba(0,0,0,0.9)"; ctx.shadowBlur=5;
          ctx.fillText("⚠ MUDSLIDE — RUN!", CW/2, g.risingLevel - 12);
          ctx.shadowBlur=0;
        }
      }
      ctx.restore();
    }

    // ── FALLING DEBRIS (earthquake, cyclone, tornado, landslide, avalanche) ──
    for (const db of g.fallingDebris) {
      if (!db.active) continue;
      // Warning line from top when incoming
      if (db.y < 60) {
        ctx.save();
        ctx.strokeStyle = `rgba(239,68,68,${0.4 + Math.abs(Math.sin(t*5))*0.4})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6,4]);
        ctx.beginPath(); ctx.moveTo(db.x + db.size/2, 0); ctx.lineTo(db.x + db.size/2, db.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      // Draw falling debris using rotated rock sprite
      ctx.save();
      ctx.translate(db.x + db.size/2, db.y + db.size/2);
      ctx.rotate(db.rotation);
      ctx.translate(-db.size/2, -db.size/2);
      sprRock(ctx, 0, 0, db.size, db.size, [db.color, shadeColor(db.color, -15), shadeColor(db.color, -30)]);
      ctx.restore();
    }

    // Green flash on pickup
    if (g.flashTimer > 0) {
      ctx.fillStyle = `rgba(34,197,94,${0.18 * (g.flashTimer / 0.12)})`;
      ctx.fillRect(0, 0, CW, CH);
    }

    // Pickups
    for (const p of g.pickups) {
      sprPickup(ctx, p.x, p.y, p.em, p.label, p.col, t, p.bob);
    }

    // Obstacles
    for (const o of g.obstacles) {
      o.fn(ctx, o.x, o.y, null, t);
    }

    // Particles
    for (const p of g.particles) {
      const a = Math.max(0, p.life / (p.maxLife || 1));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Dash ghost trail (Vikram)
    if (g.isDashing) {
      for (let d = 1; d <= 5; d++) {
        ctx.save();
        ctx.globalAlpha = 0.06 * (6 - d);
        drawPlayer(ctx, g.px - d * 14, g.py - PLH, g.char, g.runFrame, false, false, false);
        ctx.restore();
      }
    }

    // Player — use dynamic px now
    drawPlayer(ctx, g.px, g.py - PLH, g.char, g.runFrame, g.isHurt, g.isDashing, g.hasShield);

    // Score popups
    for (const p of g.popups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.fillStyle   = p.big ? "#22c55e" : "#fde047";
      ctx.font        = `bold ${p.big ? 20 : 16}px 'Segoe UI',sans-serif`;
      ctx.textAlign   = "center";
      ctx.shadowColor = p.big ? "#22c55e" : "#f59e0b";
      ctx.shadowBlur  = 10;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur  = 0;
      ctx.restore();
    }

    // Danger vignette (ground obstacle within 200px of player)
    const dangerObs = g.obstacles.find(o =>
      !o.aerial && o.x > g.px && o.x - (g.px + PLW) < 220
    );
    if (dangerObs) {
      const proximity = 1 - (dangerObs.x - (g.px + PLW)) / 220;
      const vg = ctx.createRadialGradient(CW/2, CH/2, CH*0.18, CW/2, CH/2, CH*0.85);
      vg.addColorStop(0, "transparent");
      vg.addColorStop(1, `${lv.col}${Math.round(proximity * 50).toString(16).padStart(2,"0")}`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, CW, CH);
    }

    // ── LIGHTNING FLASH (cyclone, tornado, flood) ──
    const lvId3 = lv.id;
    if (lvId3 === "cyclone" || lvId3 === "tornado" || lvId3 === "flood") {
      g.lightningTimer -= dt;
      if (g.lightningTimer <= 0) {
        g.lightningTimer = 4 + Math.random() * 8 - g.wave * 0.3;
        g.lightningTimer = Math.max(1.5, g.lightningTimer);
        // Draw lightning bolt
        ctx.save();
        ctx.strokeStyle = lvId3 === "cyclone" ? "#a78bfa" : lvId3 === "tornado" ? "#818cf8" : "#93c5fd";
        ctx.lineWidth = 2 + Math.random() * 3;
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 20;
        ctx.globalAlpha = 0.85;
        const lx0 = CW * 0.2 + Math.random() * CW * 0.6;
        ctx.beginPath(); ctx.moveTo(lx0, 0);
        let lxc = lx0;
        for(let li=1; li<=6; li++){
          lxc += (Math.random()-0.5)*60;
          ctx.lineTo(lxc, li*(CH*0.8/6));
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        // White flash overlay
        ctx.globalAlpha = 0.07 + Math.random()*0.05;
        ctx.fillStyle = "white";
        ctx.fillRect(0,0,CW,CH);
        ctx.restore();
        SFX.tone(80 + Math.random()*40, 0.3, 0.15, "sawtooth");
      }
    }

    // ── HEAT SHIMMER (heatwave, wildfire) ──
    if ((lvId3 === "heatwave" || lvId3 === "wildfire") && g.dangerLevel > 0.3) {
      ctx.save();
      ctx.globalAlpha = 0.04 + g.dangerLevel * 0.06;
      ctx.fillStyle = "#f97316";
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
    }

    // ── FALLING DEBRIS WARNING ARROWS ABOVE PLAYER ──
    if ((LEVEL_MECHANICS[lv.id]||{}).fallingDebris) {
      for (const db of g.fallingDebris) {
        if (db.active && db.y > 0 && db.y < g.py - PLH - 20) {
          const distToPlayer = Math.abs((db.x + db.size/2) - (g.px + PLW/2));
          if (distToPlayer < 100) {
            const danger = 1 - distToPlayer/100;
            ctx.save();
            ctx.globalAlpha = danger * 0.9;
            ctx.fillStyle = "#fca5a5";
            ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 8;
            ctx.font = `bold ${14 + Math.round(danger*5)}px 'Segoe UI',sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText("⚠", db.x + db.size/2, db.y + db.size + 16);
            ctx.shadowBlur = 0;
            ctx.restore();
          }
        }
      }
    }

    // Canvas HUD (drawn on top of everything)
    drawHUD(ctx, g, lv, ts);

    ctx.restore();

    /* ════════════════════════════
       14. HUD REACT SYNC (throttled to 12fps to reduce re-renders)
    ════════════════════════════ */
    hudSyncTimer.current += dt;
    if (hudSyncTimer.current > 0.083) {
      hudSyncTimer.current = 0;
      setHud({
        score: g.score,
        lives: g.lives,
        combo: Math.floor(g.combo * 10) / 10,
        dist:  Math.min(100, Math.round(g.dist)),
        wave:  g.wave,
        tip:   lv.tip,
        stamina: Math.round(g.stamina),
        risingNear: g.risingLevel < FLOOR + 60,
      });
    }

    rafRef.current = requestAnimationFrame(gameLoop);
  }, []);


  /* ══════════════════════════════════════════════════
     SCREEN: MENU  (preserved styling from original)
  ══════════════════════════════════════════════════ */
  /* ════════════════════════════════════
     HELPERS — reset quiz / awareness
  ════════════════════════════════════ */
  function resetQuiz() {
    if (quizCat) {
      const shuffled = [...quizCat.questions].sort(()=>Math.random()-0.5);
      setQuizShuffle(shuffled);
    }
    setQuizIdx(0); setQuizAns(null); setQuizScore(0); setQuizDone(false);
  }
  function resetAware() {
    setAwareSc(0); setAwareAns(null); setAwareLives(3); setAwareScore(0); setAwareDone(false); setAwarePre(true);
    if (awareCat) setAwareScenariosFiltered(awareCat.scenarios);
  }

  /* ════════════════════════════════════
     MENU SCREEN  (3 tabs)
  ════════════════════════════════════ */
  if (screen === "menu") {
    const TABS = [
      { id:"runner",   label:"🎮 Runner Game",   sub:"Side-scrolling survival" },
      { id:"quiz",     label:"🧠 Do You Know?",  sub:"20 MCQ questions" },
      { id:"awareness",label:"⚡ Awareness Mode", sub:"Scenario decisions" },
    ];
    return (
    <div style={{minHeight:"100vh",background:"#030303",fontFamily:"'Segoe UI',system-ui,sans-serif",overflow:"auto"}}>
      {/* Hero */}
      <div style={{position:"relative",padding:"44px 20px 28px",textAlign:"center",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(220,38,38,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(220,38,38,0.05) 1px,transparent 1px)",backgroundSize:"44px 44px",animation:"gridPulse 5s ease-in-out infinite"}}/>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 0%,rgba(220,38,38,0.14),transparent 68%)"}}/>
        <div style={{position:"absolute",top:0,left:0,right:0,height:"2px",background:"linear-gradient(90deg,transparent,#dc2626,transparent)",animation:"scanLine 4s linear infinite"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:"7px",background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.25)",padding:"5px 16px",borderRadius:"20px",marginBottom:"18px"}}>
            <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#dc2626",boxShadow:"0 0 10px #dc2626",animation:"blink 0.9s ease-in-out infinite",display:"inline-block"}}/>
            <span style={{color:"#dc2626",fontSize:"0.68rem",fontWeight:700,letterSpacing:"2.5px"}}>LIVE SIMULATION</span>
          </div>
          <h1 style={{fontSize:"clamp(2.8rem,8vw,5.5rem)",fontWeight:900,color:"white",margin:0,letterSpacing:"10px",lineHeight:0.95,textShadow:"0 0 80px rgba(220,38,68,0.55),0 0 160px rgba(220,38,68,0.25)"}}>
            PANIC<span style={{color:"#dc2626",display:"block"}}>MODE</span>
          </h1>
          <p style={{color:"#374151",letterSpacing:"4px",fontSize:"0.72rem",margin:"14px 0 0",fontWeight:500,textTransform:"uppercase"}}>Disaster Survival Training Platform</p>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{display:"flex",justifyContent:"center",gap:"8px",padding:"0 16px 20px",flexWrap:"wrap"}}>
        {TABS.map(tab=>(
          <button key={tab.id} onClick={()=>{SFX.select();setMenuTab(tab.id);}}
            style={{padding:"11px 22px",background: menuTab===tab.id?"#111":"#070707",
              border:`1px solid ${menuTab===tab.id?"#dc2626":"#1a1a1a"}`,borderRadius:"14px",cursor:"pointer",
              transition:"all 0.2s ease",boxShadow:menuTab===tab.id?"0 0 20px rgba(220,38,38,0.25)":"none"}}>
            <div style={{color:menuTab===tab.id?"white":"#4b5563",fontWeight:800,fontSize:"0.88rem",letterSpacing:"0.5px"}}>{tab.label}</div>
            <div style={{color:menuTab===tab.id?"#dc2626":"#1f2937",fontSize:"0.62rem",marginTop:"2px"}}>{tab.sub}</div>
          </button>
        ))}
      </div>

      {/* ── TAB: RUNNER ── */}
      {menuTab === "runner" && (
        <div style={{padding:"0 18px 44px",maxWidth:"1040px",margin:"0 auto"}}>
          {/* Controls guide */}
          <div style={{display:"flex",gap:"7px",justifyContent:"center",flexWrap:"wrap",marginBottom:"18px"}}>
            {[["SPACE / ↑","Jump"],["↓ / S","Fast Fall"],["SHIFT","Vikram Dash"],["TAP","Mobile Jump"]].map(([k,l])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:"5px",background:"#0a0a0a",border:"1px solid #1e1e1e",borderRadius:"8px",padding:"5px 11px"}}>
                <kbd style={{background:"#161616",border:"1px solid #2a2a2a",borderRadius:"4px",padding:"2px 7px",color:"#ccc",fontSize:"0.68rem",fontWeight:700}}>{k}</kbd>
                <span style={{color:"#374151",fontSize:"0.64rem"}}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",marginBottom:"18px"}}>
            <span style={{color:"#1f2937",fontSize:"0.68rem",letterSpacing:"3px",textTransform:"uppercase",borderBottom:"1px solid #111",paddingBottom:"6px"}}>— Select Disaster Level —</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(188px,1fr))",gap:"10px"}}>
            {LEVELS.map((lv,idx)=>(
              <button key={lv.id}
                onClick={()=>{SFX.select();setSelDis(lv.id);setScreen("charselect");}}
                onMouseEnter={()=>setHovD(lv.id)} onMouseLeave={()=>setHovD(null)}
                style={{padding:"20px 14px",textAlign:"center",cursor:"pointer",
                  background:hovD===lv.id?"#0d0d0d":"#070707",
                  border:`1px solid ${hovD===lv.id?lv.col:"#141414"}`,borderRadius:"18px",
                  transition:"all 0.22s ease",
                  transform:hovD===lv.id?"translateY(-6px)":"none",
                  boxShadow:hovD===lv.id?`0 14px 35px ${lv.col}2e,0 0 0 1px ${lv.col}18`:"0 2px 8px rgba(0,0,0,0.3)",
                  animation:`cardIn 0.4s ease-out ${idx*0.055}s both`}}>
                <div style={{fontSize:"2.4rem",marginBottom:"10px",filter:hovD===lv.id?`drop-shadow(0 0 14px ${lv.col})`:"none",transition:"filter 0.22s",animation:hovD===lv.id?"emojiBounce 0.5s ease-in-out":"none"}}>{lv.em}</div>
                <div style={{color:"white",fontWeight:800,fontSize:"0.88rem",letterSpacing:"1.5px",marginBottom:"5px"}}>{lv.name}</div>
                <div style={{display:"flex",justifyContent:"center",gap:"3px",marginBottom:"10px"}}>
                  {Array.from({length:5}).map((_,i)=>{
                    const f=lv.diff==="EASY"?1:lv.diff==="MEDIUM"?2:lv.diff==="HARD"?3:5;
                    return <div key={i} style={{width:"7px",height:"7px",borderRadius:"50%",background:i<f?lv.col:"#1a1a1a",boxShadow:i<f?`0 0 5px ${lv.col}88`:"none"}}/>;
                  })}
                </div>
                <span style={{fontSize:"0.62rem",fontWeight:800,padding:"3px 11px",borderRadius:"10px",background:`${lv.col}18`,color:lv.col,border:`1px solid ${lv.col}35`,letterSpacing:"1px"}}>{lv.diff}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: DO YOU KNOW? ── */}
      {menuTab === "quiz" && <QuizTab quizShuffle={quizShuffle} quizIdx={quizIdx} setQuizIdx={setQuizIdx} quizAns={quizAns} setQuizAns={setQuizAns} quizScore={quizScore} setQuizScore={setQuizScore} quizDone={quizDone} setQuizDone={setQuizDone} resetQuiz={resetQuiz} quizCat={quizCat} setQuizCat={setQuizCat} setQuizShuffle={setQuizShuffle}/>}

      {/* ── TAB: AWARENESS MODE ── */}
      {menuTab === "awareness" && <AwarenessTab awareSc={awareSc} setAwareSc={setAwareSc} awareAns={awareAns} setAwareAns={setAwareAns} awareLives={awareLives} setAwareLives={setAwareLives} awareScore={awareScore} setAwareScore={setAwareScore} awareDone={awareDone} setAwareDone={setAwareDone} awarePre={awarePre} setAwarePre={setAwarePre} resetAware={resetAware} awareCat={awareCat} setAwareCat={setAwareCat} awareScenariosFiltered={awareScenariosFiltered} setAwareScenariosFiltered={setAwareScenariosFiltered}/>}

      <style>{`
        @keyframes blink       {0%,100%{opacity:1} 50%{opacity:0.25}}
        @keyframes gridPulse   {0%,100%{opacity:0.45} 50%{opacity:1}}
        @keyframes scanLine    {0%{top:-2px;opacity:0} 50%{opacity:1} 100%{top:100%;opacity:0}}
        @keyframes cardIn      {from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)}}
        @keyframes emojiBounce {0%,100%{transform:scale(1)} 50%{transform:scale(1.25)}}
        @keyframes fadeIn      {from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)}}
        @keyframes shakeAnim   {0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)}}
        @keyframes pulse       {0%,100%{transform:scale(1)} 50%{transform:scale(1.04)}}
        @keyframes alertFlash  {0%,100%{background:rgba(220,38,38,0.12)} 50%{background:rgba(220,38,38,0.28)}}
      `}</style>
    </div>
  );}

  /* ══════════════════════════════════════════════════
     SCREEN: CHARACTER SELECT
  ══════════════════════════════════════════════════ */
  if (screen === "charselect") {
    const lv = LEVELS.find(l=>l.id===selDis);
    return (
      <div style={{minHeight:"100vh",background:"#030303",fontFamily:"'Segoe UI',system-ui,sans-serif",overflow:"auto"}}>
        <div style={{padding:"28px 20px 16px",textAlign:"center",position:"relative"}}>
          <button onClick={()=>setScreen("menu")}
            style={{position:"absolute",top:"24px",left:"18px",background:"transparent",border:"1px solid #1a1a1a",color:"#4b5563",padding:"8px 16px",borderRadius:"8px",cursor:"pointer",fontSize:"0.8rem",transition:"all 0.18s"}}
            onMouseEnter={e=>{e.currentTarget.style.color="white";e.currentTarget.style.borderColor="#333";}}
            onMouseLeave={e=>{e.currentTarget.style.color="#4b5563";e.currentTarget.style.borderColor="#1a1a1a";}}>← Back</button>

          <div style={{display:"inline-flex",alignItems:"center",gap:"14px",
            padding:"12px 26px",background:`${lv?.col}0d`,border:`1px solid ${lv?.col}30`,borderRadius:"24px"}}>
            <span style={{fontSize:"2rem",filter:`drop-shadow(0 0 12px ${lv?.col})`}}>{lv?.em}</span>
            <div style={{textAlign:"left"}}>
              <div style={{color:lv?.col,fontWeight:900,fontSize:"1rem",letterSpacing:"2px"}}>{lv?.name}</div>
              <div style={{color:"#374151",fontSize:"0.7rem",marginTop:"2px"}}>{lv?.tip?.slice(0,55)}…</div>
            </div>
          </div>
        </div>

        <div style={{padding:"6px 20px 44px",maxWidth:"980px",margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:"18px"}}>
            <span style={{color:"#1f2937",fontSize:"0.68rem",letterSpacing:"3px",textTransform:"uppercase"}}>— Choose Your Survivor —</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"12px"}}>
            {CHARS.map((ch,idx)=>(
              <button key={ch.id}
                onClick={()=>{ SFX.select(); setChar(ch); stopGame(); setScreen("game"); setTimeout(()=>startGame(lv,ch),80); }}
                onMouseEnter={()=>setHovC(ch.id)} onMouseLeave={()=>setHovC(null)}
                style={{
                  padding:"22px 18px",background: hovC===ch.id?"#0d0d0d":"#070707",
                  border:`1px solid ${hovC===ch.id?ch.col:"#141414"}`,
                  borderRadius:"20px",cursor:"pointer",textAlign:"center",
                  transition:"all 0.22s ease",
                  transform: hovC===ch.id ? "translateY(-6px) scale(1.02)" : "none",
                  boxShadow: hovC===ch.id ? `0 16px 40px ${ch.col}33` : "0 2px 8px rgba(0,0,0,0.3)",
                  animation:`cardIn 0.4s ease-out ${idx*0.07}s both`,
                }}>
                {/* Avatar */}
                <div style={{width:"72px",height:"72px",borderRadius:"50%",margin:"0 auto 14px",
                  background:`radial-gradient(circle at 36% 36%,${ch.col}44,${ch.col}0d)`,
                  border:`2px solid ${ch.col}`,display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:"2.5rem",boxShadow:`0 0 28px ${ch.col}44`,position:"relative"}}>
                  {ch.em}
                  <div style={{position:"absolute",bottom:"-10px",left:"50%",transform:"translateX(-50%)",
                    background:ch.col,padding:"2px 9px",borderRadius:"8px",whiteSpace:"nowrap",
                    boxShadow:`0 2px 10px ${ch.col}55`}}>
                    <span style={{color:"white",fontSize:"0.48rem",fontWeight:800,letterSpacing:"0.5px"}}>{ch.role.toUpperCase()}</span>
                  </div>
                </div>
                <div style={{color:"white",fontWeight:800,fontSize:"1.05rem",marginTop:"12px",marginBottom:"4px"}}>{ch.name}</div>
                {/* Power badge */}
                <div style={{background:`${ch.col}14`,border:`1px solid ${ch.col}30`,borderRadius:"12px",padding:"10px 12px",marginTop:"10px"}}>
                  <div style={{color:ch.col,fontSize:"0.8rem",fontWeight:800,letterSpacing:"0.5px",marginBottom:"4px"}}>
                    ⚡ {ch.power}
                  </div>
                  <div style={{color:"#4b5563",fontSize:"0.68rem",lineHeight:1.45}}>{ch.powerDesc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <style>{`@keyframes cardIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════
     SCREEN: GAME  (the actual playable runner!)
  ══════════════════════════════════════════════════ */
  if (screen === "game") {
    const lv   = LEVELS.find(l=>l.id===selDis);
    const maxL = char?.id==="ravi" ? 4 : 3;
    const prog = Math.min(100, hud.dist);
    const tCol = prog>68?"#22c55e":prog>38?"#f59e0b":"#ef4444";

    return (
      <div style={{minHeight:"100vh",background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",userSelect:"none"}}>

        {/* ── TOP HUD ── */}
        <div style={{width:`${CW}px`,maxWidth:"100vw",display:"flex",alignItems:"center",
          justifyContent:"space-between",padding:"9px 16px",
          background:"rgba(0,0,0,0.97)",borderBottom:`1px solid ${lv?.col}25`,gap:"12px"}}>

          {/* Left: char + lives */}
          <div style={{display:"flex",alignItems:"center",gap:"10px",minWidth:"165px"}}>
            <div style={{width:"36px",height:"36px",borderRadius:"50%",flexShrink:0,
              background:`radial-gradient(circle,${char?.col}44,${char?.col}11)`,
              border:`2px solid ${char?.col}`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.35rem",
              boxShadow:`0 0 16px ${char?.col}44`}}>{char?.em}</div>
            <div>
              <div style={{color:"white",fontSize:"0.73rem",fontWeight:700,letterSpacing:"0.5px"}}>{char?.name}</div>
              <div style={{display:"flex",gap:"2px",marginTop:"3px"}}>
                {Array.from({length:maxL}).map((_,i)=>(
                  <span key={i} style={{fontSize:"0.65rem",
                    opacity:i<hud.lives?1:0.18,
                    filter:i<hud.lives?"drop-shadow(0 0 5px #ef4444)":"none",
                    transition:"all 0.3s"}}>{i<hud.lives?"❤️":"🖤"}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Centre: level name + progress bar */}
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{color:lv?.col,fontWeight:900,fontSize:"0.86rem",letterSpacing:"2px",
              textShadow:`0 0 14px ${lv?.col}77`,marginBottom:"5px"}}>
              {lv?.em} {lv?.name}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <div style={{flex:1,height:"6px",background:"#111",borderRadius:"3px",overflow:"hidden",border:"1px solid #222"}}>
                <div style={{height:"100%",width:`${prog}%`,
                  background:`linear-gradient(90deg,${lv?.col},${tCol})`,
                  transition:"width 0.5s linear",
                  boxShadow:`0 0 12px ${lv?.col}88`}}/>
              </div>
              <span style={{color:"#374151",fontSize:"0.6rem",minWidth:"32px"}}>{prog}%</span>
            </div>
          </div>

          {/* Right: score + combo + disaster status */}
          <div style={{textAlign:"right",minWidth:"130px"}}>
            <div style={{color:"#fbbf24",fontWeight:900,fontSize:"1.2rem",
              textShadow:"0 0 14px #fbbf2455",lineHeight:1}}>⭐ {hud.score.toLocaleString()}</div>
            {hud.combo > 1.4 &&
              <div style={{color:"#f97316",fontSize:"0.72rem",fontWeight:800,
                animation:"comboPop 0.2s ease-out",marginTop:"2px"}}>🔥 ×{hud.combo.toFixed(1)} COMBO</div>}
            {/* Disaster danger indicator */}
            {hud.risingNear &&
              <div style={{color:"#3b82f6",fontSize:"0.6rem",fontWeight:800,marginTop:"2px",
                animation:"blink 0.5s ease-in-out infinite"}}>⚠ HAZARD RISING</div>}
          </div>
        </div>

        {/* ── CANVAS ── */}
        <div style={{position:"relative",width:`${CW}px`,maxWidth:"100vw",lineHeight:0,cursor:"pointer"}}
          onClick={handleTap}>
          <canvas ref={canvasRef} width={CW} height={CH}
            style={{display:"block",maxWidth:"100%",imageRendering:"crisp-edges"}}/>

          {/* NDMA tip overlay at bottom of canvas */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,
            background:"linear-gradient(0deg,rgba(0,0,0,0.92) 0%,transparent 100%)",
            padding:"26px 16px 8px",pointerEvents:"none"}}>
            <span style={{color:lv?.col,fontSize:"0.66rem",fontWeight:700,letterSpacing:"1.5px"}}>💡 NDMA TIP: </span>
            <span style={{color:"rgba(255,255,255,0.52)",fontSize:"0.66rem"}}>{hud.tip}</span>
          </div>

          {/* In-game control hints (top right of canvas) */}
          <div style={{position:"absolute",top:"8px",right:"9px",display:"flex",gap:"5px",pointerEvents:"none"}}>
            {[
              ["↑","Jump"],
              ["↓","Duck"],
              ...(char?.id==="arjun"  ? [["↑↑","2x Jump"]] : []),
              ...(char?.id==="vikram" ? [["⇧","Dash"]]     : []),
            ].map(([k,l])=>(
              <div key={k} style={{background:"rgba(0,0,0,0.82)",border:"1px solid #222",borderRadius:"7px",padding:"3px 8px",textAlign:"center"}}>
                <div style={{color:"white",fontSize:"0.8rem",lineHeight:1.1}}>{k}</div>
                <div style={{color:"#374151",fontSize:"0.5rem"}}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOTTOM BAR: Mobile D-pad + quit ── */}
        <div style={{width:`${CW}px`,maxWidth:"100vw",display:"flex",alignItems:"center",
          justifyContent:"space-between",padding:"7px 14px",
          background:"rgba(0,0,0,0.97)",borderTop:`1px solid ${lv?.col}18`,gap:"8px"}}>

          {/* Mobile controls: ◀ JUMP ▶ [DASH] */}
          <div style={{display:"flex",gap:"5px",alignItems:"center"}}>
            <button
              onPointerDown={()=>handleMoveStart("left")}
              onPointerUp={()=>handleMoveEnd("left")}
              onPointerLeave={e=>{handleMoveEnd("left");e.currentTarget.style.background="#111";}}
              style={{background:"#111",border:`1px solid ${lv?.col}44`,borderRadius:"10px",
                color:"white",padding:"10px 15px",cursor:"pointer",fontSize:"1rem",
                fontWeight:700,touchAction:"none",userSelect:"none",transition:"background 0.1s"}}
              onPointerEnter={e=>e.currentTarget.style.background=`${lv?.col}22`}>◀</button>

            <button onPointerDown={handleTap}
              style={{background:"#111",border:`1px solid ${lv?.col}66`,borderRadius:"10px",
                color:"white",padding:"10px 16px",cursor:"pointer",
                fontSize:"0.8rem",fontWeight:800,letterSpacing:"1px",touchAction:"none",
                userSelect:"none",transition:"background 0.1s"}}
              onPointerEnter={e=>e.currentTarget.style.background=`${lv?.col}22`}
              onPointerLeave={e=>e.currentTarget.style.background="#111"}>⬆ JUMP</button>

            <button
              onPointerDown={()=>handleMoveStart("right")}
              onPointerUp={()=>handleMoveEnd("right")}
              onPointerLeave={e=>{handleMoveEnd("right");e.currentTarget.style.background="#111";}}
              style={{background:"#111",border:`1px solid ${lv?.col}44`,borderRadius:"10px",
                color:"white",padding:"10px 15px",cursor:"pointer",fontSize:"1rem",
                fontWeight:700,touchAction:"none",userSelect:"none",transition:"background 0.1s"}}
              onPointerEnter={e=>e.currentTarget.style.background=`${lv?.col}22`}>▶</button>

            {char?.id==="vikram" &&
              <button onPointerDown={handleDash}
                style={{background:"#111",border:"1px solid #10b98155",borderRadius:"10px",
                  color:"#10b981",padding:"10px 14px",cursor:"pointer",
                  fontSize:"0.8rem",fontWeight:700,touchAction:"none",userSelect:"none",transition:"background 0.1s"}}
                onPointerEnter={e=>e.currentTarget.style.background="#10b98122"}
                onPointerLeave={e=>e.currentTarget.style.background="#111"}>⚡ DASH</button>}
          </div>

          <span style={{color:"#1f2937",fontSize:"0.58rem",flex:1,textAlign:"center",lineHeight:1.5}}>
            ← → Move &nbsp;·&nbsp; JUMP &nbsp;·&nbsp; Collect items &nbsp;·&nbsp; Reach 100%
          </span>

          <button onClick={()=>{stopGame();setScreen("menu");}}
            style={{background:"transparent",border:"1px solid #1a1a1a",color:"#374151",
              padding:"6px 14px",borderRadius:"8px",cursor:"pointer",fontSize:"0.75rem",
              transition:"all 0.18s"}}
            onMouseEnter={e=>{e.currentTarget.style.color="white";e.currentTarget.style.borderColor="#444";}}
            onMouseLeave={e=>{e.currentTarget.style.color="#374151";e.currentTarget.style.borderColor="#1a1a1a";}}>
            ✕ Quit
          </button>
        </div>

        <style>{`@keyframes comboPop{from{transform:scale(1.4)}to{transform:scale(1)}}`}</style>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════
     SCREEN: WIN
  ══════════════════════════════════════════════════ */
  if (screen === "win") {
    const lv = LEVELS.find(l=>l.id===selDis);
    const g  = G.current;
    const timeStr = `${Math.floor(g.surviveTime/60)}:${String(Math.floor(g.surviveTime%60)).padStart(2,"0")}`;
    return (
      <div style={{minHeight:"100vh",background:"#030303",display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",
        padding:"24px",textAlign:"center"}}>
        <div style={{maxWidth:"500px",width:"100%",animation:"fadeUp 0.6s ease-out"}}>
          <div style={{fontSize:"5rem",marginBottom:"16px",
            filter:"drop-shadow(0 0 40px #22c55e88)",animation:"floatBob 1s ease-in-out infinite"}}>🛡️</div>
          <h1 style={{color:"#22c55e",fontSize:"2.2rem",margin:"0 0 6px",fontWeight:900,
            letterSpacing:"3px",textShadow:"0 0 40px #22c55e55"}}>YOU SURVIVED!</h1>
          <p style={{color:"#374151",margin:"0 0 24px",fontSize:"0.82rem"}}>
            {lv?.name} &nbsp;·&nbsp; {char?.name} ({char?.role})
          </p>

          <div style={{background:"#0a0a0a",borderRadius:"20px",padding:"28px",
            marginBottom:"18px",border:"1px solid #22c55e1a",boxShadow:"0 0 50px #22c55e08"}}>
            <p style={{color:"#1f2937",margin:"0 0 4px",fontSize:"0.65rem",letterSpacing:"2px",textTransform:"uppercase"}}>Final Score</p>
            <p style={{fontSize:"5rem",fontWeight:900,color:"#22c55e",margin:0,lineHeight:1,
              textShadow:"0 0 40px #22c55e55"}}>{endScore.toLocaleString()}</p>
            <p style={{color:"#1f2937",margin:"6px 0 20px",fontSize:"0.64rem",letterSpacing:"1px"}}>score + lives bonus</p>

            {/* Stats row */}
            <div style={{display:"flex",justifyContent:"center",gap:"10px",marginBottom:"20px",flexWrap:"wrap"}}>
              {[
                ["⚡ Wave", `${g.wave}`],
                ["⏱ Time", timeStr],
                ["❤️ Lives", `${g.lives} left`],
              ].map(([label,val])=>(
                <div key={label} style={{background:"#111",borderRadius:"10px",padding:"10px 16px",border:"1px solid #1a1a1a"}}>
                  <div style={{color:"#22c55e",fontWeight:800,fontSize:"1.1rem"}}>{val}</div>
                  <div style={{color:"#374151",fontSize:"0.6rem",marginTop:"2px"}}>{label}</div>
                </div>
              ))}
            </div>

            {/* NDMA knowledge recap */}
            <div style={{background:"#050505",borderRadius:"12px",padding:"14px 16px",textAlign:"left"}}>
              <p style={{color:"#22c55e",fontSize:"0.65rem",fontWeight:700,letterSpacing:"1.5px",margin:"0 0 10px",textTransform:"uppercase"}}>
                💡 {lv?.name} — NDMA Survival Knowledge
              </p>
              {lv?.tip && (
                <div style={{display:"flex",gap:"10px",alignItems:"flex-start"}}>
                  <span style={{color:"#22c55e",flexShrink:0,marginTop:"2px"}}>✓</span>
                  <span style={{color:"#4b5563",fontSize:"0.78rem",lineHeight:1.55}}>{lv.tip}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{display:"flex",gap:"12px",justifyContent:"center"}}>
            <button onClick={()=>{stopGame();setScreen("game");setTimeout(()=>startGame(lv,char),80);}}
              style={{padding:"13px 28px",background:"#22c55e",border:"none",borderRadius:"14px",
                color:"white",cursor:"pointer",fontWeight:800,fontSize:"0.92rem",letterSpacing:"1px",
                boxShadow:"0 6px 24px #22c55e44",transition:"transform 0.2s"}}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"}
              onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
              🔄 Play Again
            </button>
            <button onClick={()=>{stopGame();setScreen("menu");}}
              style={{padding:"13px 22px",background:"transparent",border:"1px solid #1a1a1a",
                borderRadius:"14px",color:"#4b5563",cursor:"pointer",fontSize:"0.92rem",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.color="white";e.currentTarget.style.borderColor="#444";}}
              onMouseLeave={e=>{e.currentTarget.style.color="#4b5563";e.currentTarget.style.borderColor="#1a1a1a";}}>
              🌍 More Levels
            </button>
          </div>
        </div>
        <style>{`
          @keyframes fadeUp  {from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
          @keyframes floatBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        `}</style>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════
     SCREEN: LOSE
  ══════════════════════════════════════════════════ */
  if (screen === "lose") {
    const lv = LEVELS.find(l=>l.id===selDis);
    const g  = G.current;
    const timeStr = `${Math.floor(g.surviveTime/60)}:${String(Math.floor(g.surviveTime%60)).padStart(2,"0")}`;
    // Update high score
    if (endScore > (g.highScore||0)) g.highScore = endScore;
    return (
      <div style={{minHeight:"100vh",background:"#030303",display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",
        padding:"24px",textAlign:"center"}}>
        <div style={{maxWidth:"500px",width:"100%",animation:"fadeUp 0.6s ease-out"}}>
          <div style={{fontSize:"5rem",marginBottom:"16px",filter:"drop-shadow(0 0 40px #ef444488)",
            animation:"floatBob 1.2s ease-in-out infinite"}}>💀</div>
          <h1 style={{color:"#ef4444",fontSize:"2.2rem",margin:"0 0 6px",fontWeight:900,
            letterSpacing:"3px",textShadow:"0 0 40px #ef444444"}}>GAME OVER</h1>
          <p style={{color:"#374151",margin:"0 0 24px",fontSize:"0.82rem"}}>
            {lv?.name} &nbsp;·&nbsp; {char?.name} ({char?.role})
          </p>

          <div style={{background:"#0a0a0a",borderRadius:"20px",padding:"28px",
            marginBottom:"18px",border:"1px solid #ef44441a"}}>
            <p style={{color:"#1f2937",margin:"0 0 4px",fontSize:"0.65rem",letterSpacing:"2px",textTransform:"uppercase"}}>Your Score</p>
            <p style={{fontSize:"5rem",fontWeight:900,color:"#ef4444",margin:0,lineHeight:1,
              textShadow:"0 0 30px #ef444455"}}>{endScore.toLocaleString()}</p>
            {g.highScore > 0 && (
              <p style={{color:"#f59e0b",margin:"6px 0 0",fontSize:"0.68rem",fontWeight:700}}>
                🏆 Best: {g.highScore.toLocaleString()}
              </p>
            )}

            {/* Stats row */}
            <div style={{display:"flex",justifyContent:"center",gap:"10px",margin:"16px 0 20px",flexWrap:"wrap"}}>
              {[
                ["⚡ Wave Reached", `${g.wave}`],
                ["⏱ Survived", timeStr],
              ].map(([label,val])=>(
                <div key={label} style={{background:"#111",borderRadius:"10px",padding:"10px 18px",border:"1px solid #1a1a1a"}}>
                  <div style={{color:"#ef4444",fontWeight:800,fontSize:"1.1rem"}}>{val}</div>
                  <div style={{color:"#374151",fontSize:"0.6rem",marginTop:"2px"}}>{label}</div>
                </div>
              ))}
            </div>

            {/* NDMA tip — what they should have known */}
            <div style={{background:"#050505",borderRadius:"12px",padding:"14px 16px",textAlign:"left"}}>
              <p style={{color:"#f59e0b",fontSize:"0.65rem",fontWeight:700,letterSpacing:"1.5px",margin:"0 0 10px",textTransform:"uppercase"}}>
                📖 NDMA TIP — {lv?.name}
              </p>
              {lv?.tip && (
                <div style={{display:"flex",gap:"10px",alignItems:"flex-start"}}>
                  <span style={{color:"#f59e0b",flexShrink:0,marginTop:"2px"}}>!</span>
                  <span style={{color:"#4b5563",fontSize:"0.78rem",lineHeight:1.55}}>{lv.tip}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{display:"flex",gap:"12px",justifyContent:"center"}}>
            <button onClick={()=>{stopGame();setScreen("game");setTimeout(()=>startGame(lv,char),80);}}
              style={{padding:"13px 28px",background:lv?.col,border:"none",borderRadius:"14px",
                color:"white",cursor:"pointer",fontWeight:800,fontSize:"0.92rem",letterSpacing:"1px",
                boxShadow:`0 6px 24px ${lv?.col}44`,transition:"transform 0.2s"}}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"}
              onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
              🔄 Try Again
            </button>
            <button onClick={()=>{stopGame();setScreen("menu");}}
              style={{padding:"13px 22px",background:"transparent",border:"1px solid #1a1a1a",
                borderRadius:"14px",color:"#4b5563",cursor:"pointer",fontSize:"0.92rem",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.color="white";e.currentTarget.style.borderColor="#444";}}
              onMouseLeave={e=>{e.currentTarget.style.color="#4b5563";e.currentTarget.style.borderColor="#1a1a1a";}}>
              🏠 Menu
            </button>
          </div>
        </div>
        <style>{`
          @keyframes fadeUp  {from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
          @keyframes floatBob{0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)}}
        `}</style>
      </div>
    );
  }

  return null;
}
