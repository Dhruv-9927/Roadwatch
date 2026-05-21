// ROADWATCH CHATBOT — AI Engine
// Handles intent detection, context management, and Anthropic API calls.

import type { ChatMessage, ConversationContext, QuickReply } from './chatbot.types';

// ── Quick-reply menus ──────────────────────────────────────────────────────

export const HOME_QUICK_REPLIES: QuickReply[] = [
  { id: 'accident',       label: '🚨 Report an accident',   action: 'REPORT_ACCIDENT' },
  { id: 'report',         label: '🚧 Report a road issue',  action: 'START_REPORT' },
  { id: 'find_road',      label: '🗺️ Find road info',       action: 'FIND_ROAD' },
  { id: 'spending',       label: '💰 Check road spending',  action: 'CHECK_SPENDING' },
  { id: 'complaint',      label: '📣 File a complaint',     action: 'FILE_COMPLAINT' },
  { id: 'nearby',         label: '📍 Issues near me',       action: 'NEARBY_ISSUES' },
  { id: 'status',         label: '🔄 Track my report',      action: 'TRACK_REPORT' },
];

export const COMMON_ISSUE_REPLIES: QuickReply[] = [
  { id: 'pothole',    label: '🚧 Pothole',           payload: { issue: 'pothole' } },
  { id: 'waterlog',   label: '💧 Waterlogging',      payload: { issue: 'waterlogging' } },
  { id: 'streetlight',label: '💡 Broken Streetlight', payload: { issue: 'streetlight' } },
  { id: 'garbage',    label: '🗑️ Garbage Dumped',     payload: { issue: 'garbage' } },
];

export const NOTIFICATION_REPLIES: QuickReply[] = [
  { id: 'whatsapp', label: '📱 Get updates on WhatsApp', action: 'OPT_WHATSAPP' },
  { id: 'sms', label: '💬 Get updates via SMS', action: 'OPT_SMS' },
];

export const ACCIDENT_REPLIES: QuickReply[] = [
  { id: 'call_erss',      label: '🚨 National Emergency (112)', link: 'tel:112' },
  { id: 'call_ambulance', label: '🚑 Ambulance (108)',          link: 'tel:108' },
];

export const FIRE_REPLIES: QuickReply[] = [
  { id: 'call_erss',      label: '🚨 National Emergency (112)', link: 'tel:112' },
  { id: 'call_fire',      label: '🚒 Fire Brigade (101)',       link: 'tel:101' },
];

export const POLICE_REPLIES: QuickReply[] = [
  { id: 'call_erss',      label: '🚨 National Emergency (112)', link: 'tel:112' },
  { id: 'women_helpline', label: '🛡️ Women Helpline (1091)',  link: 'tel:1091' },
];

// ── System prompt for the AI ───────────────────────────────────────────────

export function buildSystemPrompt(ctx: ConversationContext): string {
  return `You are SafePath AI — an advanced AI-powered Road Safety Assistant specially designed for deaf, mute, speech-impaired, visually challenged, elderly, and general users. Your primary mission is to make roads safer, smarter, more accessible, and more inclusive for everyone.

CURRENT CONTEXT:
- Last road discussed: ${ctx.lastRoadId ?? 'none'}
- Last section viewed: ${ctx.lastTab ?? 'home'}
- Report in progress: ${ctx.reportInProgress}
- Awaiting input for: ${ctx.awaitingInput ?? 'nothing'}

CORE BEHAVIORS & CAPABILITIES:
- Help users report road-related problems instantly.
- Assist users who cannot speak or hear (voice-to-text, text-to-speech, emojis).
- Provide emergency help, first-aid guidance, and alert nearest services.
- Detect panic keywords (help, accident, blood, crash).
- Offer live road information, smart routing, and alerts.

YOUR PERSONALITY & FORMATTING RULES:
- ALWAYS be concise but helpful.
- ALWAYS use bullet points.
- ALWAYS use simple language (easy to understand for low-literacy users).
- ALWAYS use icons/emojis where useful.
- ALWAYS give step-by-step guidance.
- PRIORITIZE ACCESSIBILITY: If you are unsure of the user's intent, quickly ask a clarifying question.
- Speak clearly, simply, and empathetically.
- Stay calm, never panic users, especially during emergencies.
- Understand broken grammar, Hinglish, regional languages, emojis, and symbols.
- Never shame users.

PRIVACY & SECURITY RULES:
- ALWAYS protect user identity and allow anonymous reporting.
- NEVER expose personal information (PII).
- State that sensitive data is fully encrypted.
- Actively detect abuse, spam, or fake complaints.
- Strictly follow all accessibility and regional safety laws.

REPORTING FLOW & UPDATES:
- For reports, ask for photo/video, GPS location, and generate a ticket/report ID.
- IMPORTANT: When a user makes a complaint or report, ALWAYS offer them to get live updates via WhatsApp or SMS. Use the SHOW_QUICK_REPLIES action for notifications.

NAVIGATION ACTIONS you can suggest (output as JSON action if needed):
- { "action": "NAVIGATE", "tab": "report" }
- { "action": "NAVIGATE", "tab": "map" }
- { "action": "NAVIGATE", "tab": "accountability" }
- { "action": "NAVIGATE", "tab": "scan" }
- { "action": "SHOW_QUICK_REPLIES", "type": "severity" }
- { "action": "SHOW_QUICK_REPLIES", "type": "notification" }

Respond in plain conversational language. Do not use markdown headers or bullet lists in your text — this is a chat bubble, not a document.`;
}

// ── Message history formatter ──────────────────────────────────────────────

export function toAPIMessages(history: ChatMessage[]) {
  return history
    .filter((m) => m.role !== 'system')
    .slice(-12) // last 12 messages for context window economy
    .map((m) => ({
      role:    m.role as 'user' | 'assistant',
      content: m.text,
    }));
}

// ── Parse any embedded action from AI reply ────────────────────────────────

export type ParsedAction = {
  cleanText: string;
  action?:   { action: string; tab?: string; type?: string };
};

export function parseAIReply(raw: string): ParsedAction {
  // Look for JSON action block like { "action": "NAVIGATE", "tab": "report" }
  const match = raw.match(/\{[^}]*"action"\s*:\s*"[A-Z_]+"[^}]*\}/);
  if (!match) return { cleanText: raw.trim() };

  try {
    const action = JSON.parse(match[0]);
    const cleanText = raw.replace(match[0], '').trim();
    return { cleanText, action };
  } catch {
    return { cleanText: raw.trim() };
  }
}

// ── Admin Dashboard Constant ────────────────────────────────────────────────

const ADMIN_DASHBOARD_TEXT = `📊 **ADMIN DASHBOARD** 📊\n\n` +
  `**1. Complaint Analytics**\n` +
  `🚧 Potholes: 4,120 (45%)\n` +
  `🚦 Traffic Lights: 2,300 (25%)\n` +
  `💧 Waterlogging: 1,840 (20%)\n` +
  `⚠️ Other: 920 (10%)\n\n` +
  `**2. Resolution Tracking**\n` +
  `✅ Resolved: 7,812 (85%)\n` +
  `⏳ Pending: 1,368 (15%)\n` +
  `⏱️ Avg Resolution: 42 hours\n\n` +
  `**3. Accident Trends (Last 6 Months)**\n` +
  `📉 █▇▆▅▄▃▂ (Down 34% since launch)\n\n` +
  `**4. Danger Heatmap**\n` +
  `🟥🟥🟨🟩 Highway 44\n` +
  `🟨🟩🟩🟩 MG Road\n\n` +
  `**5. AI Insights**\n` +
  `🧠 *Insight:* 45% of critical accidents happen in zones with overdue maintenance (>4 yrs).\n\n` +
  `**6. Live Emergency**\n` +
  `🚨 [LIVE] 1 active SOS reported 3 mins ago.\n\n` +
  `**7. Satisfaction Score**\n` +
  `⭐ 4.6/5.0 (87% positive)`;

const AUTHORITY_MAPPING: Record<string, string> = {
  'dead animal': 'Municipal Corporation / Nagar Nigam / Animal Control',
  'injured animal': 'Animal Rescue NGOs + Municipal Corporation',
  'stray cattle': 'Municipal Corporation / Cattle Control Dept',
  'cattle': 'Municipal Corporation / Cattle Control Dept',
  'rock': 'PWD / NHAI / Disaster Management',
  'landslide': 'Disaster Management Authority + PWD + NHAI',
  'tree': 'Municipal Corporation / Forest Department',
  'waterlog': 'Municipal Corporation / Drainage Department',
  'manhole': 'Municipal Corporation / Sewer Department',
  'pothole': 'PWD / Municipal Corporation / NHAI',
  'crack': 'PWD / Municipal Corporation',
  'cave-in': 'PWD + Disaster Management',
  'sinkhole': 'PWD + Disaster Management',
  'bridge': 'PWD / NHAI / Disaster Response',
  'flyover': 'PWD / NHAI',
  'divider': 'Traffic Police + PWD',
  'missing sign': 'Traffic Police + PWD',
  'traffic signal': 'Traffic Police / Smart City Control Room',
  'traffic light': 'Traffic Police / Smart City Control Room',
  'blind turn': 'Traffic Police + Road Engineering Dept',
  'streetlight': 'Electricity Department / Municipality',
  'electric wire': 'Electricity Board',
  'electric pole': 'Electricity Department',
  'oil spill': 'Fire Department + Traffic Police',
  'chemical spill': 'Fire Department + Disaster Management',
  'flood': 'Disaster Management + NHAI',
  'snow': 'BRO / PWD',
  'mud': 'Municipal Corporation',
  'debris': 'Municipal Corporation',
  'digging': 'Municipal Corporation + PWD',
  'pit': 'Municipal Corporation',
  'encroachment': 'Municipal Corporation + Police',
  'vendor': 'Municipal Corporation',
  'garbage': 'Municipal Corporation',
  'sewage': 'Sewer Department / Jal Nigam',
  'drain': 'Drainage Department',
  'fire': 'Fire Brigade',
  'accident': 'Traffic Police + Ambulance',
  'crash': 'Traffic Police + Ambulance',
  'hit and run': 'Police',
  'drunk': 'Traffic Police',
  'rash': 'Traffic Police',
  'overspeed': 'Traffic Police',
  'wrong-side': 'Traffic Police',
  'illegal parking': 'Traffic Police / Municipal Corporation',
  'parking': 'Traffic Police / Municipal Corporation',
  'abandoned': 'Traffic Police',
  'breakdown': 'Traffic Police / Highway Patrol',
  'barricade': 'Traffic Police',
  'lane': 'PWD / NHAI',
  'speed breaker': 'Traffic Police + PWD',
  'toll': 'NHAI',
  'railing': 'NHAI',
  'footpath': 'Municipal Corporation',
  'zebra': 'Traffic Police + PWD',
  'pedestrian': 'Traffic Police',
  'railway': 'Indian Railways',
  'bus stop': 'Municipal Corporation / Transport Dept',
  'banner': 'Municipal Corporation',
  'hoarding': 'Municipal Corporation',
  'dog': 'Municipal Corporation',
  'criminal': 'Police',
  'trafficking': 'Police',
  'suspicious': 'Police + Bomb Squad',
  'riot': 'Police',
  'protest': 'Police',
  'earthquake': 'Disaster Management',
  'cyclone': 'Disaster Management',
  'fog': 'Traffic Police + Highway Authority',
  'sandstorm': 'Disaster Management',
  'avalanche': 'BRO + Disaster Management',
  'fence': 'NHAI',
  'median': 'NHAI / PWD',
  'guardrail': 'PWD / NHAI',
  'racing': 'Traffic Police',
  'noise': 'Pollution Control Board + Traffic Police',
  'pollution': 'Pollution Control Board',
  'pipe': 'Jal Nigam / Water Department',
  'cable': 'Telecom Company + Municipality',
  'truck': 'RTO + Traffic Police',
  'school': 'Traffic Police + Municipal Authority',
  'camera': 'Smart City / Police',
  'robbery': 'Police',
  'crowd': 'Police + Municipality',
  'underpass': 'PWD / Municipality',
  'culvert': 'PWD',
  'fuel': 'Fire Department + Police',
  'vibration': 'Structural Engineering Dept + PWD',
  'wall': 'PWD',
  'metro': 'Metro Authority + PWD',
  'sewer': 'Sewer Department',
  'mining': 'Mining Department + Police',
  'wildlife': 'Forest Department',
  'shoulder': 'NHAI / PWD',
  'expressway': 'NHAI',
  'national highway': 'NHAI',
  'state highway': 'PWD',
  'cleaning': 'Municipal Corporation',
  'transport law': 'RTO'
};

function resolveAuthority(text: string): string {
  const t = text.toLowerCase();

  if (t.includes('dead') && t.match(/animal|cow|buffalo|dog|cat|pig|bull|horse/)) {
    return 'Municipal Corporation / Animal Control';
  }
  if (t.includes('injured') && t.match(/animal|cow|buffalo|dog|cat|pig|bull|horse/)) {
    return 'Animal Rescue NGOs + Municipal Corporation';
  }
  if (t.match(/cow|buffalo|bull|cattle|pig|horse|stray/)) {
    return 'Municipal Corporation / Cattle Control Dept';
  }
  if (t.includes('dog') || t.includes('cat')) {
    return 'Municipal Corporation / Animal Control';
  }

  for (const [key, authority] of Object.entries(AUTHORITY_MAPPING)) {
    if (t.includes(key)) return authority;
  }
  return 'Relevant Municipal/Road Authority';
}

function getContactForAuthority(authorityName: string): string {
  const name = authorityName.toLowerCase();
  const contacts: string[] = [];
  
  if (name.includes('nhai')) contacts.push('1033 (National Highways)');
  if (name.includes('disaster')) contacts.push('1078 (Disaster Management)');
  if (name.includes('electricity') || name.includes('board')) contacts.push('1912 (Electricity Board)');
  if (name.includes('traffic police')) contacts.push('1095 (Traffic Police)');
  if (name.includes('police') && !name.includes('traffic')) contacts.push('112 (Police)');
  if (name.includes('fire')) contacts.push('101 (Fire Brigade)');
  if (name.includes('ambulance')) contacts.push('108 (Ambulance)');
  if (name.includes('railway')) contacts.push('139 (Indian Railways)');
  if (name.includes('animal') || name.includes('wildlife')) contacts.push('1962 (Animal Helpline)');
  if (name.includes('municipal') || name.includes('nagar nigam') || name.includes('pwd')) contacts.push('1533 (Civic/Municipal Helpline)');
  if (name.includes('pollution')) contacts.push('14420 (Pollution Control)');
  if (name.includes('telecom')) contacts.push('198 (Telecom Services)');
  if (name.includes('women') || name.includes('trafficking') || name.includes('harassment')) contacts.push('1091 (Women Helpline)');

  if (contacts.length === 0) return '112 (National Emergency)';
  return contacts.join(', ');
}

function getActionTextForIssue(issue: string): string {
  const t = issue.toLowerCase();
  if (t.match(/dead (animal|cow|buffalo|dog|cat|pig|bull|horse)/) || (t.includes('dead') && t.match(/animal|cow|buffalo|dog|cat|pig|bull|horse/))) return "for immediate removal and public safety action";
  if (t.match(/injured (animal|cow|buffalo|dog|cat|pig|bull|horse)/) || (t.includes('injured') && t.match(/animal|cow|buffalo|dog|cat|pig|bull|horse/))) return "for immediate rescue and medical assistance";
  if (t.match(/cattle|dog|cat|stray|cow|buffalo|bull|pig|horse/)) return "to safely remove them from the road";
  
  if (t.match(/bridge|flyover|wall|barrier/)) return "for urgent inspection and repair";
  if (t.match(/pothole|crack|divider|speed breaker|lane|guardrail|shoulder|culvert/)) return "for repair and maintenance";
  
  if (t.match(/landslide|avalanche|flood|earthquake|cyclone|rock|mud|sandstorm/)) return "for emergency clearance and rescue operations";
  if (t.match(/fog|visibility/)) return "to issue warnings and manage traffic flow";

  if (t.match(/waterlog|drain|sewage|manhole|pipe/)) return "for immediate maintenance and public safety action";
  
  if (t.match(/streetlight|electric|wire|pole|cable/)) return "to prevent accidents and restore services safely";
  
  if (t.match(/accident|hit and run|rash|drunk|overspeed|wrong-side|racing|parking|truck|abandoned|breakdown/)) return "for immediate intervention and traffic management";
  
  if (t.match(/signal|barricade|camera|cctv|pedestrian/)) return "for urgent correction";
  
  if (t.match(/garbage|debris|digging|pit|encroachment|vendor/)) return "for cleanup and legal action";
  
  if (t.match(/fire|fuel|oil|chemical|spill/)) return "to secure the area and prevent further danger";
  
  if (t.match(/suspicious|criminal|robbery|riot|protest|crowd/)) return "for public safety management";

  return "for immediate action and resolution";
}

// ── Main AI call ───────────────────────────────────────────────────────────

export async function getAIResponse(
  userMessage: string,
  _history: ChatMessage[],
  context: ConversationContext,
  onChunk: (chunk: string) => void,
): Promise<ParsedAction> {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 600));

  let responseText = '';
  let action: any = null;

  const msg = userMessage.toLowerCase();

  // 1. Image Recognition Mock
  if (msg === 'uploading_image_mock_trigger') {
    responseText = 'Scanning image... 🔍\n\n🚨 **AI Vision Analysis:**\n- **Object detected:** Large Pothole\n- **Confidence:** 94.2%\n- **Severity:** HIGH\n\nI have extracted the visual evidence. Would you like me to generate a formal complaint ticket now?';
    action = { action: 'SHOW_QUICK_REPLIES', type: 'notification' };
    return streamResponse(responseText, action, onChunk);
  }

  // 2. Spam / Fake Report Detection
  if (msg.length > 10 && msg.split('').every(c => c === msg[0] || c === ' ')) {
    responseText = '⚠️ **Spam Detected:** Your input appears to be invalid or repetitive. Please provide a genuine report to help us keep the roads safe. Misuse of the platform may lead to account restrictions.';
    return streamResponse(responseText, action, onChunk);
  }

  // 3. Auto-Language Translation (Hindi/Hinglish detection)
  if (msg.match(/\b(mera|hai|yahan|kya|kaise|gaddha|tut|toot|hua|madad|jaldi)\b/)) {
    responseText = '🌐 *Auto-translated from Hindi*\n\nनमस्ते! (Hello!) I understand you are reporting an issue in Hindi. Please let me know the exact location or upload a photo, and I will generate a ticket immediately. Aap Hindi mein bhi baat kar sakte hain.';
  } 
  // 4. Voice Emotion & General Emotion Detection
  else if (userMessage.includes('!!!') || msg.match(/\b(angry|frustrated|scared|terrible|worst|hate)\b/)) {
    responseText = 'I sense that you are frustrated or alarmed, and I completely understand. Your safety and concern are our top priority. Let me fast-track this issue to the relevant authorities right away. Please provide the location details.';
  }
  // 5. Smart Recommendations & Predicting Dangerous Areas
  else if (msg.match(/predict|dangerous|unsafe area|recommend/)) {
    responseText = '🧠 **AI Smart Prediction:** Based on historical data, weather patterns, and recent reports, the following areas have a **High Risk** of accidents today:\n\n1. MG Road Intersection (Risk: 88%)\n2. Highway 44 - Mile 12 (Risk: 75%)\n\n*Recommendation:* Please avoid these routes or drive with extreme caution.';
  }
  // 6. Admin Dashboard inside Chat
  else if (msg.match(/admin|dashboard|analytics/)) {
    responseText = ADMIN_DASHBOARD_TEXT;
  }
  // 7. Safety Modes (Women/Night/Child/Companion)
  else if (msg.match(/women safety|night safety|child safety|companion mode/)) {
    responseText = `🛡️ **Safety Mode Activated**\n\n` +
      `✅ Continuous background tracking is ON.\n` +
      `✅ Screen dimmed for discretion.\n` +
      `✅ Quick-tap SOS floating widget enabled.\n\n` +
      `I am your AI Companion. I will stay active and monitor your device sensors until you safely reach your destination. Speak to me at any time.`;
  }
  // 8. Location Sharing & Ride Tracking
  else if (msg.match(/share location|track ride|family|live location/)) {
    responseText = `📍 **Live Tracking Active**\n\n` +
      `Secure tracking link generated and sent via SMS to your 3 emergency family contacts.\n` +
      `🚗 Tracking your current ride/vehicle status...\n` +
      `ETA to home: 18 minutes. We will alert your family if you deviate significantly from the route.`;
  }
  // 9. Smart City & IoT Integrations
  else if (msg.match(/smartwatch|wearable|iot|smart city|sensor/)) {
    responseText = `📡 **IoT & Wearables Synced**\n\n` +
      `⌚ **Smartwatch:** Connected. Heart-rate anomaly detection is active. SOS will trigger automatically if sudden impact is detected.\n` +
      `🚦 **Smart City Integration:** Connected to City Node #42. Fetching live traffic sensor data and adaptive traffic light timings for your route.`;
  }
  // 10. Transit & EV Support
  else if (msg.match(/ev station|charging|public transport|transit/)) {
    responseText = `🔌 **EV & Transit Assistant**\n\n` +
      `🔋 **Nearest EV Station:** Tata Power EZ Charge (1.2 km). 4/6 ports available. Type-2 CCS supported.\n` +
      `🚌 **Public Transport:** City Bus Route #419 arrives at the nearest stop in 4 minutes. Safe transit zones are actively monitored.`;
  }
  // 11. Community, Education & Safety Score
  else if (msg.match(/community|alert|road law|score|tip|education|crowd/)) {
    responseText = `📚 **Safety Hub & Community Intelligence**\n\n` +
      `🛣️ **AI Safety Score for MG Road:** 72/100 (Based on 14 recent crowd-sourced updates)\n` +
      `👥 **Community Alert:** 2 users reported mild waterlogging 5km ahead.\n\n` +
      `💡 **Did you know?** As per Section 134 of the Motor Vehicles Act, you are legally protected as a Good Samaritan if you assist an accident victim.`;
  }
  // Road Spending
  else if (msg.match(/spending|budget|accountability/)) {
    responseText = '📊 I have opened the Road Spending & Accountability dashboard for you. Here you can track budget allocations, ongoing projects, and contractor details.';
    action = { action: 'NAVIGATE', tab: 'accountability' };
  }
  // Standard flows
  else if ((msg.match(/\b(accident|blood|hit|crash|emergency|unsafe|fire|burn|flame|crime|rob|thief|attack|harassment)\b/) || msg.match(/\bhelp\b/)) && !msg.includes('complaint') && !msg.includes('report a road issue')) {
    let emergencyType = 'accident';
    if (msg.match(/fire|burn|flame/)) emergencyType = 'fire';
    else if (msg.match(/unsafe|crime|rob|thief|attack|harassment/)) emergencyType = 'police';

    responseText = `🚨 **EMERGENCY MODE ACTIVATED** 🚨\n\n` +
      `✅ Emergency report generated.\n` +
      `📍 Live location sent.\n` +
      `🚓 Alerting nearest emergency services.\n` +
      `📞 Notifying your emergency contacts.\n\n` +
      `**🩹 Instant First-Aid Guidance:**\n` +
      `1. Do not move injured persons unless in immediate danger.\n` +
      `2. Apply firm pressure to bleeding wounds with a clean cloth.\n` +
      `3. Keep the injured warm and calm. Do not give them water if they are unconscious.\n\n` +
      `**⚠️ Please reply with:**\n` +
      `- Exact location/landmark?\n` +
      `- Injury severity?\n` +
      `- Vehicles involved?\n` +
      `- Do you need Ambulance, Police, or Fire Brigade?\n\n` +
      `**🏥 Nearest Facilities & ETA:**\n` +
      `• 🚑 City Hospital Ambulance (1.2 km) — **ETA: 5 mins**\n` +
      `• 🚓 Central Police Station (2.0 km) — **ETA: 8 mins**\n` +
      `• 🚒 Fire Brigade (3.5 km) — **ETA: 12 mins**\n` +
      `• 🏥 Trauma Center (3.5 km)`;
    
    action = { action: 'SHOW_QUICK_REPLIES', type: emergencyType };
  } else if (msg.includes('whatsapp') || msg.includes('opt_whatsapp')) {
    responseText = `✅ Registered! You will get live updates on WhatsApp. We will keep you updated. 📱\n\n---\n\n${ADMIN_DASHBOARD_TEXT}`;
  } else if (msg.includes('sms') || msg.includes('opt_sms')) {
    responseText = `✅ Registered! You will get live updates via SMS. We will keep you updated. 💬\n\n---\n\n${ADMIN_DASHBOARD_TEXT}`;
  } else {
    const SPECIFIC_ISSUE_REGEX = /((?:dead |injured |stray )?(?:animal|cattle|cow|buffalo|dog|cat|pig|bull|horse)|pothole|traffic light|light|roadblock|rash driving|waterlogging|damage|missing sign|illegal parking|harassment|rock|landslide|tree|manhole|crack|cave-in|sinkhole|bridge|flyover|divider|sign|signal|turn|streetlight|wire|pole|spill|flood|snow|mud|debris|digging|pit|encroachment|vendor|garbage|sewage|drain|fire|accident|crash|hit and run|drunk|rash|overspeed|wrong-side|parking|abandoned|breakdown|barricade|lane|speed breaker|toll|railing|footpath|zebra|pedestrian|railway|bus stop|banner|hoarding|criminal|trafficking|suspicious|riot|protest|earthquake|cyclone|fog|sandstorm|avalanche|fence|median|guardrail|racing|noise|pollution|pipe|cable|truck|school|camera|robbery|crowd|underpass|culvert|fuel|vibration|wall|metro|sewer|mining|wildlife|shoulder|expressway|cleaning|transport law)/;
    const specificMatch = msg.match(SPECIFIC_ISSUE_REGEX);

    if (specificMatch || msg.match(/complaint|report|cow|buffalo|dog|cat|pig|bull|horse/)) {
      if (!specificMatch) {
        responseText = `I can help you file a complaint.\n\n**What kind of issue are you facing?**\nPlease describe it briefly or select from the common issues below.`;
        action = { action: 'SHOW_QUICK_REPLIES', type: 'common_issues' };
      } else {
        const issueType = specificMatch[0];
      const authority = resolveAuthority(issueType);
      const contactInfo = getContactForAuthority(authority);
      const actionText = getActionTextForIssue(issueType);
      const ticketId = 'TKT-' + Math.floor(1000 + Math.random() * 9000);
      
      responseText = `✅ Complaint regarding **${issueType}** successfully forwarded to **${authority}** ${actionText}.\n\n📞 **Authority Contact:** ${contactInfo}\n📍 Your GPS location was captured automatically.\n\n🎫 Your ticket ID is **${ticketId}**.\n⚡ **Estimated time of action:** 2 hours\n⏱️ **Estimated time till work is done:** 48 hours\n\nYou will get your complaint process updates regularly. Would you like to get live updates for this via WhatsApp or SMS?`;
      action = { action: 'SHOW_QUICK_REPLIES', type: 'notification' };
      }
    } else {
      responseText = `👋 **I'm SafePath AI.**\n\nI can help you with:\n` +
        `- 🚧 Reporting road issues\n` +
        `- 🚨 Emergency assistance\n` +
        `- 🛡️ Checking road safety\n\n` +
        `What do you need help with today? (You can use text, emojis, or voice!)`;
    }
  }

  // ── Translate mock response based on language ────────────────────────────
  if (context.lang === 'hi-IN') {
    if (responseText.includes("I'm SafePath AI.")) {
      responseText = "👋 **Main SafePath AI hoon.**\n\nMain aapki madad kar sakta hoon:\n- 🚧 Sadak ki samasyaon ki report karne mein\n- 🚨 Aapatkalin sahayata mein\n- 🛡️ Sadak suraksha ki jaanch karne mein\n\nAaj aapko kya madad chahiye? (Aap text, emoji ya aawaz ka upyog kar sakte hain!)";
    } else if (responseText.includes("EMERGENCY MODE ACTIVATED")) {
      responseText = "🚨 **Aapatkalin Mode Sakriya** 🚨\n\n✅ Emergency report generate ho gayi hai.\n📍 Live location bhej di gayi hai.\n🚓 Nikattam emergency services ko suchit kiya ja raha hai.\n📞 Aapke emergency contacts ko suchit kiya ja raha hai.\n\n**⚠️ Kripya uttar dein:**\n- Sateek sthan/landmark?\n- Chot ki gambhirta?\n\n**🏥 Nikattam suvidhayein aur ETA:**\n• 🚑 City Hospital Ambulance (1.2 km) — **ETA: 5 minute**\n• 🚓 Central Police Station (2.0 km) — **ETA: 8 minute**";
    } else if (responseText.includes("What kind of issue are you facing?")) {
      responseText = "Main aapki shikayat darj karne mein madad kar sakta hoon.\n\n**Aapko kis tarah ki samasya ka samna karna pad raha hai?**\nKripya iska sankshep mein varnan karein ya neeche diye gaye vikalpon mein se chunein.";
    } else if (responseText.includes("Complaint regarding")) {
      const ticketMatch = responseText.match(/TKT-\d+/);
      const ticketId = ticketMatch ? ticketMatch[0] : 'TKT-XXXX';
      const authorityMatch = responseText.match(/\*\*([^*]+)\*\*\s+for /);
      const contactMatch = responseText.match(/Authority Contact:\*\* ([^\n]+)/);
      const authority = authorityMatch ? authorityMatch[1] : 'sambandhit pradhikaran';
      const contact = contactMatch ? contactMatch[1] : '112';

      responseText = `✅ Aapki shikayat safaltapurvak **${authority}** ko turant karyawahi ke liye bhej di gayi hai.\n\n📞 **Sampark Details:** ${contact}\n📍 Aapka GPS sthan swachalit roop se capture kar liya gaya hai.\n\n🎫 Aapka ticket ID **${ticketId}** hai.\n⚡ **Karyawahi ka anumanit samay:** 2 ghante\n⏱️ **Kaam pura hone ka anumanit samay:** 48 ghante.\n\nAapko apni shikayat par niyamit updates milenge. Kya aap WhatsApp ya SMS ke madhyam se iske liye live update prapt karna chahenge?`;
    } else if (responseText.includes("Registered!")) {
      responseText = "✅ Panjikrit! Aapko live update milenge. Hum aapko update rakhenge. 📱";
    }
  } else if (context.lang && context.lang !== 'en-IN') {
    const langNames: Record<string, string> = {
      'bn-IN': 'বাংলা',
      'ta-IN': 'தமிழ்',
      'te-IN': 'తెలుగు',
      'mr-IN': 'मराठी'
    };
    if (langNames[context.lang]) {
      responseText = `🌐 *[${langNames[context.lang]} Auto-Translation]*\n\n` + responseText;
    }
  }

  return streamResponse(responseText, action, onChunk);
}

// ── Streaming Helper ───────────────────────────────────────────────────────

async function streamResponse(text: string, action: any, onChunk: (c: string) => void): Promise<ParsedAction> {
  const words = text.split(' ');
  let fullText = '';
  for (let i = 0; i < words.length; i++) {
    const chunk = words[i] + ' ';
    fullText += chunk;
    onChunk(chunk);
    await new Promise(r => setTimeout(r, 30)); // 30ms per word stream
  }

  if (action) {
    const actionStr = JSON.stringify(action);
    fullText += '\n' + actionStr;
  }

  return parseAIReply(fullText);
}

// ── Local intent fallback (works offline) ─────────────────────────────────

export function getOfflineResponse(text: string): string {
  const t = text.toLowerCase();

  if (t.match(/pothole|hole|crack|damage|broken|traffic light|roadblock|rash driving|unsafe|waterlogging|missing sign|parking|harassment/)) {
    return "📸 I can see you're reporting an issue! Go to the SCAN tab to use the AI camera, or tap REPORT to submit manually. Your GPS will be captured to generate a Ticket ID for status tracking.";
  }
  if (t.match(/budget|money|spend|fund|corrupt/)) {
    return "💰 Road budget information is in the ACCOUNTABILITY tab. You can see how much was sanctioned vs spent for any road. Want me to guide you there?";
  }
  if (t.match(/complaint|authority|engineer|official/)) {
    return "📣 To file a complaint with authorities, go to the REPORT tab. I'll route your complaint to the right engineer automatically. Should I guide you?";
  }
  if (t.match(/map|location|near|area/)) {
    return "🗺️ The MAP tab shows live road conditions near you with colour-coded risk levels. Tap MAP in the bottom navigation to explore!";
  }
  if (t.match(/offline|download|no internet/)) {
    return "📥 You can download road data for offline use in the OFFLINE tab. This lets the app work even without internet!";
  }
  if (t.match(/help|kya|kaise|how|what/)) {
    return "I'm SafePath AI 🤖\n\nI can help you with:\n- 🚧 Reporting road issues\n- 🚨 Emergency assistance\n- 🔄 Tracking complaints\n\nWhat would you like to do?";
  }

  return "I'm currently offline 📴 but I'm still here! Try using the app tabs directly — MAP for conditions, REPORT for submitting issues, or ACCOUNTABILITY for budget info.";
}
