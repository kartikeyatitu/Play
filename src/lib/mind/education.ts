// TRIQ Mind & Performance C1: parent and coach education.
// General guidance in plain English. Not clinical advice. Needs sports-psychologist and
// safeguarding review before launch.

export interface EducationTopic {
  id: string;
  title: string;
  summary: string;
  /** Things to do. */
  do: string[];
  /** Things to avoid. */
  avoid: string[];
}

export const PARENT_TOPICS: readonly EducationTopic[] = [
  {
    id: "supporting",
    title: "Supporting a young athlete",
    summary: "Children stay in sport longer when it feels like theirs, it is fun, and the adults around them are calm and warm.",
    do: [
      "Ask what they enjoyed before asking how they did.",
      "Praise effort, attitude and improvement more than results.",
      "Let the coach coach. Your job on the sideline is to encourage.",
      "Make sure sport sits alongside sleep, school, friends and rest.",
    ],
    avoid: [
      "Shouting instructions from the side during play.",
      "Comparing them with siblings, team-mates or other children.",
      "Making love, treats or approval depend on how they played.",
    ],
  },
  {
    id: "pressure",
    title: "Managing expectations and pressure",
    summary: "A bit of challenge helps children grow. Too much pressure from adults can take the joy out of sport and push them away from it.",
    do: [
      "Talk about goals your child chooses and controls, like trying a new skill.",
      "Keep your own reactions calm, especially in close matches.",
      "Ask your child how much pressure they feel, and really listen to the answer.",
    ],
    avoid: [
      "Talking about money spent on fees or kit as something they owe back in results.",
      "Treating every match as a big test of their future.",
      "Signing them up for more sessions or events than they want.",
    ],
  },
  {
    id: "losses",
    title: "Handling losses",
    summary: "Losing is part of every sport. How the adults react teaches children how to treat themselves when things go wrong.",
    do: [
      "Give a cool-down gap before any talk about the match.",
      "Start with something simple and warm: \"I loved watching you play.\"",
      "Help them find one thing they learned when they are ready.",
    ],
    avoid: [
      "Going through every mistake in the car home.",
      "Blaming the referee, coach or team-mates in front of them.",
      "Showing more disappointment than they do.",
    ],
  },
  {
    id: "motivation",
    title: "Supporting motivation",
    summary: "Motivation that comes from enjoyment and personal progress lasts longer than motivation from rewards or fear.",
    do: [
      "Notice and name the progress they make over months, not just days.",
      "Let them have a say in which sport, how often, and what goals.",
      "Accept that interest can change, and that taking a break is allowed.",
    ],
    avoid: [
      "Paying or rewarding for wins or goals scored.",
      "Using guilt to keep them going.",
    ],
  },
  {
    id: "distress",
    title: "Noticing when something is wrong",
    summary: "You know your child best. Changes that last, rather than one bad day, are worth paying attention to. This is not about diagnosing anything; it is about noticing and getting help.",
    do: [
      "Notice lasting changes in sleep, eating, mood, friendships or interest in things they used to enjoy.",
      "Notice if they start dreading training, keep feeling unwell before sessions, or want to quit suddenly.",
      "Ask gently and listen without fixing. Let them know they are not in trouble.",
      "Speak to your family doctor or a qualified mental health professional if changes go on for more than a couple of weeks or are getting worse.",
      "Treat any talk of self-harm or not wanting to be alive as urgent: stay with them and use the contacts on the support page.",
    ],
    avoid: [
      "Waiting for things to become very serious before asking for help.",
      "Promising to keep something secret if it could put them at risk.",
    ],
  },
  {
    id: "healthy",
    title: "Encouraging healthy participation",
    summary: "The aim is a long, healthy relationship with sport, whatever level your child reaches.",
    do: [
      "Make sure there is enough rest and sleep, especially in busy seasons.",
      "Encourage trying more than one sport when they are young.",
      "Speak up if you see unsafe or humiliating practices at any academy.",
    ],
    avoid: [
      "Pushing them to train through pain or injury.",
      "Encouraging dieting or weight loss for sport. Any weight concerns belong with a doctor or registered dietitian.",
    ],
  },
];

export const COACH_TOPICS: readonly EducationTopic[] = [
  {
    id: "positive-coaching",
    title: "Positive coaching",
    summary: "Athletes learn best in an environment that is demanding and supportive at the same time.",
    do: [
      "Catch players doing things right and say so specifically.",
      "Give feedback as a short sandwich: what worked, one thing to change, encouragement.",
      "Set high standards for effort and attitude, and model them yourself.",
    ],
    avoid: [
      "Only speaking to players when they make a mistake.",
      "Praising talent (\"you're a natural\") more than effort and learning.",
    ],
  },
  {
    id: "communication",
    title: "Communication",
    summary: "Clear, calm communication helps athletes understand, trust and perform.",
    do: [
      "Use athletes' names and keep instructions short.",
      "Check understanding by asking them to explain it back.",
      "Make time for quieter athletes, not just the loudest ones.",
    ],
    avoid: [
      "Long talks straight after a loss when emotions are high.",
      "Discussing one athlete's problems in front of the group.",
    ],
  },
  {
    id: "confidence-and-mistakes",
    title: "Managing confidence and mistakes",
    summary: "How a coach reacts to mistakes decides whether athletes take risks and learn, or play scared.",
    do: [
      "Treat mistakes in training as information, and say so out loud.",
      "Teach a mistake routine and praise athletes for using it.",
      "Give athletes specific evidence of their progress.",
    ],
    avoid: [
      "Substituting a player straight after every mistake as punishment.",
      "Sarcasm or mocking about errors.",
    ],
  },
  {
    id: "no-humiliation",
    title: "Avoiding humiliating and abusive practices",
    summary: "Shaming, humiliation and abuse do not build toughness. They harm young people and drive them out of sport. Some of these practices are also safeguarding issues.",
    do: [
      "Correct behaviour privately and calmly.",
      "Use fair, consistent and proportionate consequences.",
      "Follow your academy's safeguarding policy and report concerns about any adult's behaviour.",
    ],
    avoid: [
      "Using exercise, such as extra running, as a punishment.",
      "Shouting abuse, name-calling, or comments about bodies or weight.",
      "Public ranking or shaming, such as making the losers do a forfeit in front of others.",
      "Withholding water, rest or food.",
      "Any physical punishment.",
    ],
  },
  {
    id: "burnout",
    title: "Recognising burnout",
    summary: "Too much training with too little rest or enjoyment can wear athletes down physically and mentally.",
    do: [
      "Watch for lasting tiredness, falling performance, irritability and loss of enjoyment.",
      "Plan rest days and lighter weeks into the season.",
      "Talk with the athlete and their family about workload across all their sports and school.",
    ],
    avoid: [
      "Reading low energy as laziness without asking what is going on.",
      "Adding more training as the answer to a dip in form.",
    ],
  },
  {
    id: "injury",
    title: "Supporting athletes after injury",
    summary: "Injured athletes can feel left out, frustrated or worried about their place. Staying connected helps.",
    do: [
      "Keep injured athletes involved with the team in ways that are safe.",
      "Follow the return-to-play plan set by the qualified medical professional.",
      "Acknowledge that coming back can bring nerves, and allow time.",
    ],
    avoid: [
      "Deciding yourself that an athlete is fit to return. That decision belongs to a qualified professional.",
      "Pressuring athletes to play through pain.",
    ],
  },
  {
    id: "when-to-refer",
    title: "Knowing when to suggest a professional",
    summary: "Coaches are not therapists and are not expected to be. Your role is to notice, listen, and help the athlete and their family reach the right support.",
    do: [
      "Notice lasting changes in mood, behaviour, eating, sleep, or withdrawal from team-mates.",
      "Listen calmly, thank them for telling you, and do not promise to keep secrets that could put them at risk.",
      "For a minor, involve the parent or guardian and your academy's safeguarding lead, as your policy says.",
      "Suggest the family speak to a doctor or a qualified mental health professional.",
      "If an athlete talks about harming themselves or is in immediate danger, treat it as an emergency and use the contacts on the support page.",
    ],
    avoid: [
      "Trying to diagnose or treat a problem yourself.",
      "Discussing what an athlete told you with other athletes or parents.",
      "Asking about mental health in front of the group.",
    ],
  },
];
