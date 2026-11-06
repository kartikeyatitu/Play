// TRIQ Mind & Performance C1: the mental-skills library.
// Plain-English skills training written for TRIQ. Not therapy, not diagnosis, not treatment.
// Every exercise must be reviewed by a qualified sports psychologist before launch (release gate C1).
import type { Exercise, Skill, SkillId } from "./types";

const focus: Exercise[] = [
  {
    id: "focus-cue-word",
    skill: "focus",
    title: "One cue word",
    summary: "Pick one short word that pulls your attention back to the job.",
    minutes: 3,
    when: ["training", "during"],
    levels: {
      guided: {
        intro: "A cue word is a tiny reminder, like a bookmark for your attention.",
        steps: [
          "Choose one happy, simple word together, like \"watch\" or \"smooth\".",
          "In practice, say the word quietly before each go.",
          "If your mind wanders, say the word again and look at the ball or target.",
        ],
        tip: "Let the child choose the word. Practise it in easy drills before using it in a game.",
      },
      teen: {
        intro: "When your head drifts, a single word can bring it back faster than a long talk to yourself.",
        steps: [
          "Pick one word linked to what you want to do, such as \"early\", \"low\" or \"eyes\".",
          "Use it in training before each rep so it becomes automatic.",
          "In a match, when you notice your mind has wandered, say the word and lock onto your next action.",
        ],
      },
      adult: {
        intro: "A cue word is a compressed instruction. It works because it points attention at a task rather than at worry or the score.",
        steps: [
          "Choose a word that describes the action you want (\"tall\", \"through\", \"quick feet\"), not the result you want.",
          "Pair it with a physical anchor in training, such as a breath out or touching your strings, for a few weeks.",
          "In competition, use the cue the moment you notice drift, then commit to the very next action without judging the lapse.",
        ],
      },
    },
  },
  {
    id: "focus-wide-to-narrow",
    skill: "focus",
    title: "Wide to narrow",
    summary: "Take in the whole scene, then shrink your attention down to one target.",
    minutes: 3,
    when: ["training", "pre-match"],
    levels: {
      guided: {
        intro: "Our eyes and ears can look at lots of things or just one thing. This game practises both.",
        steps: [
          "Look around and name three things you can see and two things you can hear.",
          "Now pick one small thing, like the logo on the ball, and look only at that.",
          "Count three slow breaths while you keep looking at it.",
          "Now look up and around again, ready to play.",
        ],
        tip: "Make it a game and keep it light. A minute or two is plenty.",
      },
      teen: {
        intro: "Good players can switch between seeing the whole game and focusing on one detail.",
        steps: [
          "Stand still and take in everything around you: crowd, noise, team-mates, court or pitch.",
          "Slowly narrow down to one zone, such as where you want the ball to go.",
          "Narrow again to one point within that zone and hold it for three breaths.",
          "Open back up to wide before you start play.",
        ],
      },
      adult: {
        intro: "Attention has width and direction. Practising the switch on purpose makes it easier to control under pressure.",
        steps: [
          "Go broad and external: notice the space, sounds and movement around you for about 20 seconds.",
          "Go broad and internal: notice your breathing, muscle tension and energy without trying to change them.",
          "Go narrow and internal: settle on one simple plan for the next action.",
          "Go narrow and external: fix on a precise target, then perform.",
        ],
      },
    },
  },
  {
    id: "focus-between-points",
    skill: "focus",
    title: "Between-points routine",
    summary: "A short four-part routine for the gaps between rallies, balls or plays.",
    minutes: 0.5,
    when: ["during", "training"],
    levels: {
      guided: {
        intro: "Between points we get a little rest. This routine helps you use it well.",
        steps: [
          "Let it go: turn away and shake out your hands.",
          "Breathe: take one big slow breath out.",
          "Plan: think of one thing you will do next.",
          "Go: say your cue word and get ready.",
        ],
        tip: "Practise this in training until it feels normal, so it is there on match day.",
      },
      teen: {
        intro: "The time between points decides a lot. Use the same short routine every time.",
        steps: [
          "Release: turn away from the last point and do a small physical reset like fixing your grip.",
          "Breathe: one slow breath, longer out than in.",
          "Plan: pick one simple tactic for the next point.",
          "Commit: say your cue and get into your ready position.",
        ],
      },
      adult: {
        intro: "A consistent routine between points stops the last point and the scoreboard from running the next one.",
        steps: [
          "Respond: allow a brief natural reaction to the last point, then physically turn away from it.",
          "Recover: a slow breath out and a loosening of the shoulders and hands.",
          "Plan: choose one tactical intention based on what you see, not on fear of losing the point.",
          "Ritual: a short, repeatable pre-action routine with your cue word, then play.",
        ],
      },
    },
  },
  {
    id: "focus-park-it",
    skill: "focus",
    title: "Park it",
    summary: "Notice a distraction, name it, and leave it parked until later.",
    minutes: 2,
    when: ["training", "pre-match"],
    levels: {
      guided: {
        intro: "Sometimes our heads fill up with other thoughts. We can park them like a bicycle and come back later.",
        steps: [
          "Notice a thought that is not about the game, like school or who is watching.",
          "Imagine putting it in a parking spot at the side of the field.",
          "Tell yourself, \"I'll get it after the game\", and look back at your coach or the ball.",
        ],
        tip: "Afterwards, ask if they want to talk about anything they parked. Do not push if they say no.",
      },
      teen: {
        intro: "You cannot stop distracting thoughts from showing up. You can decide not to follow them right now.",
        steps: [
          "When a distraction appears, name it in two or three words, like \"exam stress\" or \"selector watching\".",
          "Picture leaving it outside the playing area, or touch your bag as if you are leaving it there.",
          "Bring your attention back to one thing you can see or feel right now.",
        ],
      },
      adult: {
        intro: "Distractions are normal. The skill is noticing quickly and returning without a fight.",
        steps: [
          "Label the distraction briefly and without judgement (\"planning\", \"worrying\", \"replaying\").",
          "Make a deliberate choice to return to it at a set time after the session.",
          "Re-anchor on a present-moment sensation or target, and restart your routine.",
        ],
      },
    },
  },
];

const confidence: Exercise[] = [
  {
    id: "confidence-preparation-proof",
    skill: "confidence",
    title: "Preparation proof",
    summary: "Remind yourself of the real work you have already done.",
    minutes: 4,
    when: ["pre-match", "training"],
    levels: {
      guided: {
        intro: "Confidence grows when we remember all the practice we have done.",
        steps: [
          "Together, think of three things you practised this week.",
          "Say each one out loud: \"I practised my serve.\"",
          "Finish with: \"I am ready to try my best.\"",
        ],
        tip: "Keep it about effort and practice, not about winning.",
      },
      teen: {
        intro: "Confidence that rests on preparation holds up better than confidence that rests on hope.",
        steps: [
          "Think back over the last few weeks of training.",
          "Pick three specific things you have worked on and can do.",
          "Before the match, run through them in your head as proof you are prepared.",
        ],
      },
      adult: {
        intro: "Self-belief is strongest when it is tied to evidence you can check, rather than to how you feel on the day.",
        steps: [
          "Recall concrete preparation: sessions completed, skills repeated, situations you have handled before.",
          "Pick the three most relevant to this match and state them to yourself in plain terms.",
          "When doubt shows up, return to these facts instead of arguing with the feeling.",
        ],
      },
    },
  },
  {
    id: "confidence-strengths-spotlight",
    skill: "confidence",
    title: "Strengths spotlight",
    summary: "Name what you did well before you look at what to fix.",
    minutes: 3,
    when: ["after", "training"],
    levels: {
      guided: {
        intro: "Every practice has some good bits. Let us find them first.",
        steps: [
          "Ask: \"What is one thing you did really well today?\"",
          "Ask: \"What is another thing you tried hard at?\"",
          "Say thank you for the effort and give a high five.",
        ],
        tip: "Let the child answer first. Notice effort and kindness as well as skill.",
      },
      teen: {
        intro: "Athletes often skip straight to mistakes. Starting with strengths gives a fairer picture.",
        steps: [
          "After a session, think of two things that went well and why they went well.",
          "Think of one thing to work on next time.",
          "Keep the order: strengths first, then the fix.",
        ],
      },
      adult: {
        intro: "Balanced review builds durable confidence and keeps learning specific.",
        steps: [
          "Identify two strengths you showed today, with the behaviour that produced them.",
          "Identify one priority for improvement, phrased as an action.",
          "Note how a strength can help you work on that priority.",
        ],
      },
    },
  },
  {
    id: "confidence-coach-voice",
    skill: "confidence",
    title: "Talk to yourself like a good coach",
    summary: "Swap harsh self-talk for short, useful instructions.",
    minutes: 3,
    when: ["training", "during"],
    levels: {
      guided: {
        intro: "The words we say inside our heads matter. We can choose kind and helpful ones.",
        steps: [
          "Think of something you sometimes say to yourself when it goes wrong, like \"I'm rubbish\".",
          "Ask: \"What would a kind coach say instead?\"",
          "Practise the new words, like \"Next one, watch the ball\".",
        ],
        tip: "Model this yourself. Children copy how adults talk about mistakes.",
      },
      teen: {
        intro: "If you would not say it to a team-mate, do not say it to yourself.",
        steps: [
          "Notice one phrase you say to yourself under pressure that does not help.",
          "Rewrite it as an instruction: what should you do next?",
          "Practise the new phrase in training until it comes out on its own.",
        ],
      },
      adult: {
        intro: "Self-talk works best when it is instructional and specific, rather than a judgement of your worth.",
        steps: [
          "Catch the critical statement as it happens and notice what it is trying to protect.",
          "Replace it with a task instruction (\"stay low\", \"see the release\") or a calm prompt (\"reset\").",
          "Rehearse replacements in training so they are available when stress narrows your thinking.",
        ],
      },
    },
  },
  {
    id: "confidence-picture-it",
    skill: "confidence",
    title: "Picture it going well",
    summary: "A short visualisation of preparing and performing calmly.",
    minutes: 5,
    when: ["pre-match", "training"],
    levels: {
      guided: {
        intro: "Imagining is like a practice run inside your head.",
        steps: [
          "Sit comfortably and close your eyes if you like.",
          "Picture arriving at the game, putting on your kit and warming up.",
          "Imagine playing one good shot or move, and how happy it feels.",
          "Open your eyes, wiggle your fingers and toes, and smile.",
        ],
        tip: "Read this slowly in a calm voice. Stop if the child feels uneasy and simply chat instead.",
      },
      teen: {
        intro: "Mental rehearsal helps your body and mind feel more familiar with what is coming.",
        steps: [
          "Sit or lie somewhere quiet and take a few slow breaths.",
          "Picture the venue in detail: the surface, the lights, the sounds.",
          "Rehearse your warm-up and the first few moments of play going well.",
          "Include a small mistake and see yourself reset calmly, then open your eyes.",
        ],
      },
      adult: {
        intro: "Rehearsal is most useful when it is vivid, uses several senses and includes recovering from problems.",
        steps: [
          "Settle with a few slow breaths and a relaxed posture.",
          "Build the scene with sight, sound and feel, from your own point of view.",
          "Run your routines and key actions at real speed, performing them well.",
          "Rehearse a setback and your planned response, then finish on a successful action and return to the room.",
        ],
      },
    },
  },
];

const anxiety: Exercise[] = [
  {
    id: "anxiety-long-exhale",
    skill: "competitive-anxiety",
    title: "Longer breath out",
    summary: "Breathe out a little longer than you breathe in to settle your body.",
    minutes: 2,
    when: ["pre-match", "during", "training"],
    levels: {
      guided: {
        intro: "Slow breathing out is like letting air out of a balloon gently.",
        steps: [
          "Breathe in through your nose while you count to three.",
          "Breathe out slowly through your mouth while you count to four or five.",
          "Do this five times, nice and slow.",
        ],
        tip: "Breathe along with the child. If counting feels hard, just say \"slow in, slower out\".",
      },
      teen: {
        intro: "Nerves speed your breathing up. A longer out-breath helps you take back control.",
        steps: [
          "Breathe in gently through your nose for about four counts.",
          "Breathe out through your mouth for about six counts.",
          "Repeat five or six times, keeping your shoulders down.",
        ],
      },
      adult: {
        intro: "Extending the exhale is a simple way to bring arousal down to a workable level before or during play.",
        steps: [
          "Sit or stand tall and breathe in through the nose for roughly four seconds, into the lower ribs.",
          "Exhale slowly for roughly six seconds, letting the shoulders and jaw soften.",
          "Continue for one to two minutes, or use a single breath as a reset during play.",
        ],
      },
    },
  },
  {
    id: "anxiety-ready-energy",
    skill: "competitive-anxiety",
    title: "Nerves are ready energy",
    summary: "Notice the butterflies and treat them as your body getting ready.",
    minutes: 2,
    when: ["pre-match"],
    levels: {
      guided: {
        intro: "Funny tummy feelings before a game are normal. They mean your body is getting ready to play.",
        steps: [
          "Point to where you feel the wobbly feeling.",
          "Say: \"That's my body getting ready.\"",
          "Do five big star jumps or a little jog to use some of the energy.",
        ],
        tip: "Tell the child you feel nervous before big things too. It helps them feel normal.",
      },
      teen: {
        intro: "A racing heart and butterflies feel the same whether you are scared or excited. You can choose how to read them.",
        steps: [
          "Notice where you feel the nerves: stomach, hands, chest.",
          "Say to yourself, \"This is energy for the match.\"",
          "Put that energy into your warm-up and your first action.",
        ],
      },
      adult: {
        intro: "Pre-competition activation is expected. How you interpret it affects how it influences performance.",
        steps: [
          "Name the physical signs you notice, without trying to make them disappear.",
          "Reframe them as readiness (\"my body is preparing\") rather than as a warning.",
          "Direct the energy into a purposeful warm-up and a clear first task.",
        ],
      },
    },
  },
  {
    id: "anxiety-release-scan",
    skill: "competitive-anxiety",
    title: "Tense and release",
    summary: "Squeeze and let go, part by part, to loosen tight muscles.",
    minutes: 4,
    when: ["pre-match", "training"],
    levels: {
      guided: {
        intro: "We will squeeze like a lemon, then let go like jelly.",
        steps: [
          "Squeeze your hands into fists for three seconds, then let them go floppy.",
          "Lift your shoulders up to your ears, hold, then drop them down.",
          "Scrunch your face, hold, then let it go soft.",
          "Push your toes into the floor, hold, then relax.",
        ],
        tip: "Keep the squeezes gentle. Stop with any part that hurts or is injured.",
      },
      teen: {
        intro: "Tension creeps into your body when you are nervous. This helps you find it and let it go.",
        steps: [
          "Clench your hands and forearms for about five seconds, then release and notice the difference.",
          "Do the same with your shoulders and neck.",
          "Then your face and jaw.",
          "Finish with your legs and feet, then take one slow breath.",
        ],
      },
      adult: {
        intro: "Brief muscle tensing followed by release helps you recognise and reduce unnecessary tension.",
        steps: [
          "Tense hands and forearms moderately for five seconds, then release for ten, noticing the contrast.",
          "Repeat for shoulders and upper back.",
          "Repeat for face and jaw.",
          "Repeat for legs and feet, finishing with a long exhale. Skip any area that is injured.",
        ],
      },
    },
  },
  {
    id: "anxiety-control-circle",
    skill: "competitive-anxiety",
    title: "In my control",
    summary: "Sort worries into what you can and cannot control, then act on the first group.",
    minutes: 4,
    when: ["pre-match", "training"],
    levels: {
      guided: {
        intro: "Some things we can change and some we cannot. We will think about the ones we can.",
        steps: [
          "Name one thing you cannot change, like the weather or who you are playing.",
          "Name two things you can choose, like trying hard and being a good team-mate.",
          "Pick one of those to focus on today.",
        ],
        tip: "Do this out loud, together. Nothing needs to be written down.",
      },
      teen: {
        intro: "A lot of match worry is about things you cannot control. Moving your attention to what you can control is calmer and more useful.",
        steps: [
          "List in your head what is worrying you about the match.",
          "Split it into \"not mine to control\" (referee, opponent, weather) and \"mine\" (effort, preparation, attitude).",
          "Pick one thing from \"mine\" and make it your focus.",
        ],
      },
      adult: {
        intro: "Separating controllables from uncontrollables turns diffuse worry into a short action list.",
        steps: [
          "Identify the main concerns you have about this event.",
          "Sort them into what you control, what you can influence, and what you cannot affect.",
          "Choose one or two controllable actions as your focus for the day, and consciously let the rest sit.",
        ],
      },
    },
  },
];

const emotion: Exercise[] = [
  {
    id: "emotion-mistake-routine",
    skill: "emotional-regulation",
    title: "Mistake routine",
    summary: "A short routine to move on from an error before the next play.",
    minutes: 0.5,
    when: ["during", "training"],
    levels: {
      guided: {
        intro: "Everyone makes mistakes, even the best players. We can have a plan for what to do next.",
        steps: [
          "Notice: \"Oops, that was a mistake.\"",
          "Brush it off: wipe your hand on your shirt like brushing away dust.",
          "Breathe: one slow breath out.",
          "Next: \"Next ball!\"",
        ],
        tip: "Praise the routine, not just the next good shot. Never tease mistakes.",
      },
      teen: {
        intro: "The mistake is already over. What matters is the next action.",
        steps: [
          "Acknowledge it in one word (\"miss\") instead of replaying it.",
          "Do a physical flush: wipe your hands, fix your socks, or tap your racket.",
          "Breathe out slowly.",
          "Say your cue for the next action and go.",
        ],
      },
      adult: {
        intro: "A planned response stops one error from spreading into a run of errors.",
        steps: [
          "Acknowledge the error briefly and factually.",
          "Use a physical release action you have practised, which signals the end of that play.",
          "Take one controlled breath to lower your arousal.",
          "Refocus on the next task with a process cue, saving any analysis for after the match.",
        ],
      },
    },
  },
  {
    id: "emotion-traffic-lights",
    skill: "emotional-regulation",
    title: "Traffic lights",
    summary: "Check whether you are green, amber or red, and know what to do for each.",
    minutes: 2,
    when: ["training", "during"],
    levels: {
      guided: {
        intro: "Our feelings can be like traffic lights. Knowing our colour helps us choose what to do.",
        steps: [
          "Green means calm and ready: keep going.",
          "Amber means getting cross or wobbly: take a slow breath.",
          "Red means very upset: tell your coach or grown-up and take a short break.",
        ],
        tip: "Agree a simple signal for red with the coach. This check stays in the child's head; nothing is recorded.",
      },
      teen: {
        intro: "Spotting frustration early is easier than calming down once it has taken over.",
        steps: [
          "Green: focused and in control. Keep doing what you are doing.",
          "Amber: tight shoulders, faster breathing, snappy thoughts. Use your breath and your mistake routine.",
          "Red: about to lose control. Use the next break to step away, breathe, and reset before you return.",
        ],
      },
      adult: {
        intro: "Knowing your early warning signs lets you act while you still have options.",
        steps: [
          "Learn your green signs: how your body and thoughts feel when you play well.",
          "Learn your amber signs and pair them with a quick strategy such as a long exhale or reset cue.",
          "Learn your red signs and plan a stronger response for natural breaks, such as moving away, a breathing set and a single task focus.",
        ],
      },
    },
  },
  {
    id: "emotion-cool-down-gap",
    skill: "emotional-regulation",
    title: "Cool-down gap",
    summary: "Leave some time before you talk through a match, especially a hard one.",
    minutes: 10,
    when: ["after"],
    levels: {
      guided: {
        intro: "After a game, our feelings can be big. A quiet break helps before we talk.",
        steps: [
          "Drink some water and have a snack.",
          "Do something calm for a few minutes, like stretching or sitting together.",
          "Only then ask: \"Did you enjoy playing?\"",
        ],
        tip: "In the car home, a simple \"I loved watching you play\" goes a long way. Save coaching for another time.",
      },
      teen: {
        intro: "Talking about a match while you are still heated rarely goes well.",
        steps: [
          "Give yourself at least ten minutes before going over the match.",
          "Use the time to cool down your body: water, stretching, changing.",
          "When you feel calmer, decide whether you want to talk about it now or later.",
        ],
      },
      adult: {
        intro: "Strong emotion narrows thinking. A short gap leads to more useful reflection.",
        steps: [
          "Agree with your coach or team a short cool-down period before any debrief.",
          "Use it for physical recovery and to let your heart rate and emotions settle.",
          "Start the review with what happened, before moving to judgements about it.",
        ],
      },
    },
  },
];

const resilience: Exercise[] = [
  {
    id: "resilience-three-questions",
    skill: "resilience",
    title: "Three-question review",
    summary: "What went well, what can I learn, what will I do next?",
    minutes: 5,
    when: ["after"],
    levels: {
      guided: {
        intro: "After every game, win or lose, we can ask three questions.",
        steps: [
          "What was fun or good today?",
          "What is one thing we learned?",
          "What do we want to practise next?",
        ],
        tip: "Talk, do not lecture. These are questions to think about, not a test.",
      },
      teen: {
        intro: "A quick, honest review helps you learn from every match without getting stuck on it.",
        steps: [
          "What went well, and why?",
          "What did not go to plan, and what can I learn from it?",
          "What is one thing I will do in my next training session?",
        ],
      },
      adult: {
        intro: "A structured review separates the performance from the result and turns it into next steps.",
        steps: [
          "What did I execute well, and what made that possible?",
          "Where did performance drop, and what was happening at the time?",
          "What single change will I make in preparation or training before the next event?",
        ],
      },
    },
  },
  {
    id: "resilience-comeback-memory",
    skill: "resilience",
    title: "Your comeback story",
    summary: "Remember a time you bounced back, and what helped.",
    minutes: 4,
    when: ["training", "after"],
    levels: {
      guided: {
        intro: "You have already got better at hard things before. Let us remember one.",
        steps: [
          "Think of something that used to be hard, like riding a bike or a tricky skill.",
          "Talk about what helped you keep trying.",
          "Remind yourself: \"I can get better at this too.\"",
        ],
        tip: "Share one of your own comeback stories.",
      },
      teen: {
        intro: "Setbacks feel permanent when they happen. Looking back shows they usually are not.",
        steps: [
          "Remember a past setback in sport or school that you got through.",
          "Think about what you did and who helped you.",
          "Pick one of those things you can use now.",
        ],
      },
      adult: {
        intro: "Recalling how you have recovered before is a practical source of resilience.",
        steps: [
          "Identify a significant setback you have come through.",
          "Note the actions, support and attitudes that helped you recover.",
          "Choose which of these apply to your current situation and how you will use them.",
        ],
      },
    },
  },
  {
    id: "resilience-feedback-filter",
    skill: "resilience",
    title: "Feedback filter",
    summary: "Find the useful part of criticism and leave the rest.",
    minutes: 3,
    when: ["after", "training"],
    levels: {
      guided: {
        intro: "When someone tells us how to do better, we can look for the helpful bit.",
        steps: [
          "Listen to what the coach said.",
          "Ask: \"What is the one thing I can try next time?\"",
          "Say it back to the coach to check you understood.",
        ],
        tip: "If feedback was unkind or upsetting, that is something for adults to sort out, not the child.",
      },
      teen: {
        intro: "Criticism can sting. Finding the useful part keeps you improving without taking it personally.",
        steps: [
          "Notice your first reaction and let it settle before you respond.",
          "Ask yourself what specific action the feedback points to.",
          "If it is unclear, ask the coach one question to understand it better.",
        ],
      },
      adult: {
        intro: "Separating the message from its delivery lets you use feedback without carrying unnecessary weight.",
        steps: [
          "Allow the initial reaction, then pause before replying.",
          "Extract the actionable point and set aside tone or delivery for now.",
          "Clarify with a question if needed, then decide what you will do with it.",
        ],
      },
    },
  },
];

const motivation: Exercise[] = [
  {
    id: "motivation-process-goals",
    skill: "motivation",
    title: "Goals you control",
    summary: "Set a goal about what you do, not only about the result.",
    minutes: 5,
    when: ["training", "pre-match"],
    levels: {
      guided: {
        intro: "Good goals are about things we can do, like trying hard or practising a skill.",
        steps: [
          "Choose one thing to practise this week.",
          "Make it small, like \"bend my knees when I hit\".",
          "At the end of the week, talk about how it went.",
        ],
        tip: "Keep goals fun and about effort. Avoid goals about beating other children.",
      },
      teen: {
        intro: "Winning is a fine dream, but goals you control keep you moving forward.",
        steps: [
          "Think of a bigger result you want this season.",
          "Work out what performance would make that more likely.",
          "Set one weekly goal about an action you control, such as practising your serve for ten minutes after training.",
        ],
      },
      adult: {
        intro: "Outcome goals give direction; performance and process goals give you something to act on daily.",
        steps: [
          "Set one outcome goal for the season or block.",
          "Link it to one or two performance targets that would support it.",
          "Turn each into a weekly process goal that is specific and fully within your control, and review it regularly.",
        ],
      },
    },
  },
  {
    id: "motivation-remember-why",
    skill: "motivation",
    title: "Remember why",
    summary: "Reconnect with the reasons you play.",
    minutes: 3,
    when: ["training"],
    levels: {
      guided: {
        intro: "Let us remember what we love about our sport.",
        steps: [
          "Ask: \"What is your favourite part of playing?\"",
          "Ask: \"Who do you like playing with?\"",
          "Agree to do a bit more of the favourite part this week.",
        ],
        tip: "If a child no longer enjoys their sport, listen. Enjoyment matters more than any result.",
      },
      teen: {
        intro: "On flat days, remembering why you started can help you keep going.",
        steps: [
          "Think of three reasons you play: fun, friends, challenge, health, competing.",
          "Pick the one that matters most right now.",
          "Plan one thing this week that connects to it.",
        ],
      },
      adult: {
        intro: "Motivation lasts longer when it comes from reasons you value, not only pressure from outside.",
        steps: [
          "Identify what you personally value about your sport.",
          "Notice which pressures are external (expectations, rankings, money) and which reasons are your own.",
          "Build one regular moment into your week that connects to your own reasons.",
        ],
      },
    },
  },
  {
    id: "motivation-habit-link",
    skill: "motivation",
    title: "Habit link",
    summary: "Attach a small new habit to something you already do every day.",
    minutes: 2,
    when: ["training"],
    levels: {
      guided: {
        intro: "New habits are easier when we join them to old ones.",
        steps: [
          "Pick a tiny habit, like five ball bounces or a stretch.",
          "Join it to something you always do, like after brushing your teeth.",
          "Try it every day this week.",
        ],
        tip: "Celebrate trying. If a day is missed, simply start again; there is nothing to make up.",
      },
      teen: {
        intro: "Consistency comes from small habits that are easy to start.",
        steps: [
          "Choose a small habit that helps your sport, like a five-minute mobility routine.",
          "Attach it to an existing routine: \"After I get home from school, I…\"",
          "Keep it small enough that you can do it even on a busy day.",
        ],
      },
      adult: {
        intro: "Linking a new habit to an established cue reduces the effort of remembering it.",
        steps: [
          "Define a small, specific behaviour that supports your training.",
          "Anchor it to a reliable daily cue with an \"after I…, I will…\" plan.",
          "Keep the starting version short, and only grow it once it is automatic.",
        ],
      },
    },
  },
];

const team: Exercise[] = [
  {
    id: "team-clear-calls",
    skill: "team",
    title: "Clear, kind calls",
    summary: "Short, specific, positive communication on the field.",
    minutes: 3,
    when: ["pre-match", "during", "training"],
    levels: {
      guided: {
        intro: "Team-mates play better when we use clear and kind words.",
        steps: [
          "Use names: \"Riya, pass!\" instead of shouting.",
          "Say what to do: \"Go wide!\"",
          "Cheer good tries: \"Nice try, keep going!\"",
        ],
        tip: "Notice and praise children who encourage others.",
      },
      teen: {
        intro: "Good calls help the team decide faster and feel more together.",
        steps: [
          "Agree a few simple calls as a team before the match.",
          "Make calls early, loud and short, with a name.",
          "Follow a mistake with encouragement or an instruction, never blame.",
        ],
      },
      adult: {
        intro: "Effective in-game communication is brief, specific and constructive under pressure.",
        steps: [
          "Agree shared terms for key situations before the match.",
          "Communicate with name, action and timing, as early as possible.",
          "After errors, use task-focused language that helps the next play, and save critique for the debrief.",
        ],
      },
    },
  },
  {
    id: "team-two-and-one",
    skill: "team",
    title: "Two good, one help",
    summary: "Give team-mates two pieces of praise and one helpful idea.",
    minutes: 5,
    when: ["after", "training"],
    levels: {
      guided: {
        intro: "We can help our friends get better by being kind and helpful.",
        steps: [
          "Tell a team-mate two things they did well.",
          "Share one idea to help them next time.",
          "Say thank you when someone does it for you.",
        ],
        tip: "Supervise this so it stays kind. No one should be singled out.",
      },
      teen: {
        intro: "Teams that give honest, supportive feedback trust each other more.",
        steps: [
          "In pairs, each person names two specific things the other did well.",
          "Each offers one practical suggestion for next time.",
          "Listen without arguing, then say thanks.",
        ],
      },
      adult: {
        intro: "Structured peer feedback builds trust and keeps standards high without personal attacks.",
        steps: [
          "Pair up and give two specific, behaviour-based positives.",
          "Offer one improvement framed as an action the person can take.",
          "Receive feedback openly, ask a clarifying question if needed, and agree one thing to try.",
        ],
      },
    },
  },
  {
    id: "team-shared-focus",
    skill: "team",
    title: "One team focus",
    summary: "Agree one thing the whole team will focus on today.",
    minutes: 4,
    when: ["pre-match"],
    levels: {
      guided: {
        intro: "When everyone works on the same thing, the team feels strong.",
        steps: [
          "The coach asks: \"What shall we all try hard at today?\"",
          "Choose one idea together, like \"help each other\" or \"run back fast\".",
          "Put your hands in and say it together.",
        ],
        tip: "Choose effort or teamwork focuses, never results.",
      },
      teen: {
        intro: "A shared focus helps a team stick together when things get tough.",
        steps: [
          "Before the match, each player suggests one thing the team should focus on.",
          "Agree on one that everyone can do, like \"talk on defence\".",
          "Remind each other of it at breaks.",
        ],
      },
      adult: {
        intro: "A single shared process focus aligns a team and gives a rallying point under pressure.",
        steps: [
          "Collect suggestions from the group, including quieter players.",
          "Agree one observable, controllable team behaviour for the match.",
          "Revisit it at natural breaks and in the debrief, regardless of the score.",
        ],
      },
    },
  },
];

export const SKILLS: readonly Skill[] = [
  {
    id: "focus",
    title: "Focus and concentration",
    tagline: "Pay attention to the right thing at the right time.",
    about: "Focus is a skill, not a personality trait. These exercises help you notice when attention has drifted and bring it back quickly.",
    exercises: focus,
  },
  {
    id: "confidence",
    title: "Confidence",
    tagline: "Build belief on preparation, not luck.",
    about: "Confidence goes up and down for everyone. These exercises tie it to things you have actually done and the way you talk to yourself.",
    exercises: confidence,
  },
  {
    id: "competitive-anxiety",
    title: "Competitive nerves",
    tagline: "Handle pressure and pre-match nerves.",
    about: "Feeling nervous before competing is normal and can even help. These exercises help you keep nerves at a level you can play with. If worry is affecting daily life away from sport, talk to a trusted adult or a qualified professional.",
    exercises: anxiety,
  },
  {
    id: "emotional-regulation",
    title: "Emotional control",
    tagline: "Handle frustration, anger and mistakes.",
    about: "Strong feelings are part of sport. These exercises help you notice them early and choose what to do next.",
    exercises: emotion,
  },
  {
    id: "resilience",
    title: "Resilience",
    tagline: "Bounce back from defeats and setbacks.",
    about: "Every athlete loses, gets dropped or has bad days. These exercises help you learn from them and keep going.",
    exercises: resilience,
  },
  {
    id: "motivation",
    title: "Motivation",
    tagline: "Keep showing up for the long run.",
    about: "Motivation is easier to keep when your goals are in your control and your reasons are your own.",
    exercises: motivation,
  },
  {
    id: "team",
    title: "Team psychology",
    tagline: "Communicate, trust and pull together.",
    about: "Teams play better when people talk clearly, support each other and share a focus.",
    exercises: team,
  },
];

export const SKILL_IDS: readonly SkillId[] = SKILLS.map((s) => s.id);

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

export const ALL_EXERCISES: readonly Exercise[] = SKILLS.flatMap((s) => s.exercises);

export function getExercise(id: string): Exercise | undefined {
  return ALL_EXERCISES.find((e) => e.id === id);
}

/** Human-friendly duration, e.g. "30 sec" or "4 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} sec`;
  return `${Math.round(minutes)} min`;
}
