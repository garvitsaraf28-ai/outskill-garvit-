# Bootcamp Session — AI Image and Video Generation

### AI Image & Video
### Generation
Becoming an AI Director: tools, prompting
& production workflows — comprehensive session notes
Generative AI Mastermind · Outskill
⏱ Session: AI Image & Video Generation — from prompting frameworks to a full
commercial production workflow
✎ What's inside: The model landscape (updated June 2026), image & video prompting
frameworks, credit-saving strategies, aggregators, and an end-to-end ad production
walkthrough
✦ How to use: Skim once end-to-end, pick one image tool and one video tool, and
produce your first 10-second clip this week

1. The AI-First Creative Landscape
The economic reality driving adoption of AI image and video tools is simple: in 2026, companies are
tightening budgets and asking why they should pay an agency thousands of dollars when an ad can be
produced for under $50. The takeaway is stark — you are either being replaced by AI, or you are
running the AI. This session is about becoming the person who runs it: the AI Director.
1.1 The timeline of generative visual AI
2022 — The ChatGPT moment. LLMs become a household word overnight.
2023 — AI images take off. Midjourney gains mass adoption as the first major AI image generator.
2024 — AI video arrives. Runway leads as one of the first major video generation tools.
2025 — The AI Director era. Creators begin using multi-tool workflows to produce full AI films and
commercial content; integrated sound arrives in video models.
2026 — Production-ready. Native 4K output, synchronized dialogue, multi-shot sequences and sub-
$50 ad production become reality.
2. The Model Landscape
A central theme of the session: there is no single "best" model for everything. Different models excel
at different use cases. The right approach is to maintain a small personal toolkit of favourites.
### The camera analogy
Think of AI diffusion models as the new cameras. In the physical world, a filmmaker picks a few
favourites — a Canon, a Sony, an iPhone, a drone, a GoPro — and sticks with them, without
worrying about every camera brand in existence. Same with AI models: pick a few, learn them
well, and add new ones only when they offer something your current stack can't do.
2.1 Top AI image models (updated June 2026)
Model 	Company 	Notes
GPT Image 2 / 1.5 	OpenAI 	GPT Image 2 currently tops the blind-vote arenas;
the family is excellent for text-in-images and
precise, instruction-following edits
•
•
•
•
•
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 2

Model 	Company 	Notes
### Nano Banana Pro
(Gemini 3 Pro Image)
Google 	A favourite of many pros — top-tier quality and
photorealism, slower and pricier per generation
Nano Banana 2 	Google 	Fast and cheap, with a generous free tier on
Gemini — best for high-volume generation
Seedream 4.5 	ByteDance 	Strong quality at very low credit cost — ideal for
testing prompts before switching to a premium
model
Flux 2 (Pro / Max) 	Black Forest Labs 	The leading open-weight family; cost-effective, can
be run locally and fine-tuned on your own data
Midjourney (v7/v8) 	Midjourney 	Famous for its dreamy, artistic aesthetic; closed
source, accessible only via its own platform
Hunyuan Image 3.0 	Tencent 	A specialist pick for anime and stylised character
art
Krea 1 	Krea AI 	Krea's own model — and the platform also
aggregates most of the models above in one
interface
2.2 Top AI video models (updated June 2026)
Model 	Company 	Notes
Seedance 2.0 	ByteDance 	Currently #1 on the Artificial Analysis with-audio
leaderboard; multi-shot storytelling with
synchronized audio from a single generation
Kling 3.0 / v3 	Kuaishou 	A top overall pick: native 4K at 60fps, 15-second
clips, integrated sound with multilingual lip-sync,
start/end frames, camera presets
Veo 3.1 	Google 	Best-in-class native audio — the only model
generating 48kHz synchronized dialogue; strong
scene consistency
HappyHorse-1.0 	Alibaba 	The newest leaderboard climber (April 2026) —
joint audio-video generation with lip-sync in seven
languages
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 3

Model 	Company 	Notes
Runway Gen-4.5 	Runway 	The original pioneer; no longer top of the
leaderboard but still the best control surface
(motion brushes, scene consistency) — the pro-
workflow choice
Hailuo 2.3 	MiniMax 	Great for wide landscape shots and motion physics
Grok Imagine 	xAI 	Newer entrant — already competitive from its first
full release
Wan 2.6 	Alibaba 	The leading open-source video option — can be run
on your own hardware
PixVerse V4.5 	PixVerse 	Strong contender; a specialist for anime and
stylised video content
⚠ This space moves monthly. OpenAI's Sora 2, a 2025 leader, is being discontinued through 2026 — a reminder not
to build your whole workflow on a single model. Always check the live leaderboard (§2.4) before committing.
The Seedance controversy — and the one hard rule
ByteDance's Seedance 2.0 is so high-quality that it unsettled both Hollywood and AI filmmakers:
it can produce multi-shot short films from a single prompt, and a viral fight scene between two
A-list Hollywood actors forced ByteDance to restrict image-to-video prompting over copyright
and likeness concerns.
✔ Key rule: never use someone's image or likeness without their consent.
2.3 Integrated sound — the breakthrough
Until recently, creators had to lip-sync audio separately — a time-consuming and expensive step. Models
like Veo 3.1, Kling 3.0 and Seedance 2.0 now generate audio natively with the video — dialogue,
ambient sound and music in a single generation — dramatically accelerating the production workflow.
2.4 The Artificial Analysis leaderboard
artificialanalysis.ai is the industry-standard benchmarking site. It shows two anonymous images or
videos side by side and lets users vote on which they prefer; rankings update continuously from this
crowd-sourced voting. It covers AI images, video, audio and LLMs. Check it whenever you're choosing a
model — the rankings reshuffle every few months.
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 4

3. The Image Prompting Framework
Image prompting is fundamentally different from video prompting. For images, you separate each
element with commas and use keywords rather than full sentences. Think like a creative director on a
physical set: what elements are in your scene?
3.1 The prompt elements
Element 	What to specify
Subject 	Who or what is the main focus — e.g. "a man sleeping in bed"
Action 	What the subject is doing — e.g. "reaching for the alarm clock"
Environment 	The setting — e.g. "ultra-modern bedroom, early morning"
Atmosphere / feel 	Mood and tone — e.g. "cinematic style, dramatic lighting"
Camera 	Changes the entire look: "shot on iPhone" = casual mobile feel; "shot on ARRI
Alexa" or "RED" = Hollywood-grade cinematic look
Lens (optional) 	Focal length (100mm for extreme close-up, 15–20mm wide angle) or lens
brands (Zeiss, G lens)
Lighting 	Natural, studio, bioluminescent, tungsten, golden hour — dramatically affects
the image
Style reference 	Upload a screenshot from a film with the look you want and ask the model to
replicate that visual style
### The priority rule
Whatever you place closer to the front of your prompt gets more emphasis in the output. If the
alarm clock is the focal point, put "alarm clock on nightstand showing 6 AM" before "man
sleeping in bed". If the subject should dominate, lead with the subject.
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 5

Practice image prompt (comma-separated keywords)
✔ Prompt:
"Alarm clock on a nightstand showing 6 AM, a man sleeping in bed, sports-car painting above the bed,
side angle shot, ultra-modern bedroom, early morning, ultra-realistic, cinematic style."
3.2 Camera angle cheat sheet
Dutch angle — tilted, chaotic feel (horror, tension)
Low angle — looking up; makes the subject feel powerful (the "power shot")
Cowboy shot — torso up, classic framing
100mm lens — extreme close-up, tight on the subject
15–20mm lens — wide shot, great for real estate and landscapes
Leading lines composition — lines in the scene draw the eye to a focal point
Critical keyword: "ultra-realistic"
✘ Without explicit style instructions, the model may output a cartoon, a 3D render, or a random
aesthetic.
✔ Always include: "ultra-realistic, cinematic style" for professional, photorealistic results.
3.3 Editing images instead of regenerating
Modern image models support iterative editing — upload an image and describe the change, rather than
regenerating the whole scene from scratch:
Practice editing prompts
✔ Prompt 1:
"Remove the blinds at the back of the room."
✔ Prompt 2:
"Add a stainless steel coffee machine on the kitchen island."
•
•
•
•
•
•
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 6

4. Video Prompting
Video prompting is quite different: instead of comma-separated keywords, you describe the scene in
natural language using full sentences, because video models need to understand motion, timing and
narrative sequence.
Practice video prompt (natural language)
✔ Prompt:
"The man walks into the kitchen from the hallway on the right. He is dead tired and walking very
slowly. After he turns the corner, he stumbles and falls to his knees, then quickly gets back up and
continues walking to the coffee machine."
4.1 Image-to-video, not text-to-video
Professionals use image-to-video prompting. With text-to-video you're playing a slot machine — a
random output with no visual anchor. With image-to-video, you upload a reference image that serves as
the first frame, giving the model a concrete starting point. This produces vastly more controlled and
consistent results.
4.2 Start frame and end frame
An even more powerful technique: provide both a start frame and an end frame, and the model creates
the transition between them. Example — start frame: a man in pyjamas looking tired, holding coffee. End
frame: the same man in a suit, smiling, ready for work. The model generates the transformation in
between.
4.3 Camera movement presets & timing
Tools like Kling offer camera presets you can apply with a click (or type into the prompt):
Handheld device filming — realistic, slightly shaky feel, as if someone is physically there with a
camera
Camera zooms in — great for drawing attention to a subject or moment
Camera zooms out — ideal for ending shots, pulling away to reveal context
Speed control — specify slow or fast camera motion
You can also add timestamps in your prompt (e.g. "3 seconds in, he stumbles") to control when specific
actions occur — though models don't always follow timing precisely.
•
•
•
•
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 7

5. Cost, Credits & Pricing Strategy
Time to debunk the "free tier fantasy" — and learn to spend credits like a professional.
5.1 The free tier: what it really gets you
Free trials exist on Kling, Krea, Hailuo and Higgsfield — but they come with watermarks, limited
generations and longer queue times.
Google's Nano Banana 2 is a landmark exception: available with a generous free tier on Gemini — the
best free option for high-volume image generation.
⚠ Free accounts typically do not grant copyright ownership of generated content.
5.2 The professional budget
For serious content creation, expect to spend roughly $30–50 per month across 2–3 platforms. This
gets you clean exports (no watermarks), high-quality outputs up to native 4K, faster queues and full
features. Costs escalate quickly when producing short films or high volumes of client ads — which is why
credit discipline matters.
5.3 Credit-saving strategies
Start at the lowest resolution (720p for video, 1K for images). Only upgrade to 1080p/4K once
you're happy with the prompt — a wrong take at 720p costs a fraction of the same mistake at 1080p.
Generate one output at a time when testing. Multiple simultaneous variations burn credits you may
not need.
Use cheaper models for testing. On an aggregator, a Seedream generation can cost ~6 credits versus
~100 for Nano Banana Pro. Validate the prompt on the cheap model, then switch to the premium
model for the final.
Plan everything before generating. Write your full scene breakdown and storyboard before burning
a single credit.
Combine free trials across platforms (Hailuo, Higgsfield, Krea) to extend your free usage while
learning.
Crop watermarks by slightly expanding your video frame so the watermark falls outside the visible
area.
•
•
•
•
•
•
•
•
•
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 8

⚠ Copyright considerations
Copyright policies vary by platform and pricing tier. In many cases free-tier users do not own
the rights to their generated content, while paid users do. Review each platform's specific terms
before using generated content commercially.
6. Aggregator Platforms
The biggest cost concern — subscriptions to many models — is solved by aggregator platforms that
bundle dozens of models into one subscription. Inside Krea, for example, you can access models from
Google (Nano Banana Pro, Nano Banana 2), ByteDance (Seedream), Alibaba (Qwen), Black Forest Labs
(Flux) and OpenAI (GPT Image) — all from a single interface, switching models with one click.
Pay-per-use aggregators 	Monthly subscription aggregators
FAL, Replicate 	Freepik, Krea
Cheaper per generation 	More expensive overall
Less user-friendly, developer-style interfaces 	Beautiful, pleasant UX
Best for: high-volume users who want to minimise
cost
Best for: most users who want ease of use and a
smooth creative experience
For most people the monthly subscription aggregators win despite the higher cost, because the creative
experience is significantly better.
6.1 Open source vs. closed source
Open source models (Flux, Wan, Stable Diffusion) can be downloaded and run locally on your own
hardware, and trained with custom data. Closed source models (like Midjourney) can only be accessed
through their own platforms, with no API or local access. Think Mac vs. Windows: Mac is closed and curated;
Windows is open and customisable.
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 9

7. Worked Example: Producing a Coffee
### Commercial
The second half of the session was a hands-on, end-to-end production of a complete coffee commercial
using a multi-tool workflow. Use the same recipe for your own first ad.
7.1 The storyboard
The ad concept: a man wakes up, stumbles into the kitchen like a zombie, makes coffee, takes a sip, gets
struck by a supernatural lightning-whirlwind effect, and is instantly transformed — wearing a suit, hair
slicked back, ready for work. Tagline: "That is the best coffee I've ever had."
Step 1 — Generate reference images (Krea)
All reference images were generated in Krea, starting with the bedroom scene using the comma-
separated framework from §3. A cheap model (Seedream, ~6 credits) was used to validate the prompt,
then the same prompt was re-run on a premium model (Nano Banana Pro, ~100 credits) for an
immediate, dramatic quality jump. Individual images were then refined with editing prompts ("remove
the blinds…", "add a stainless steel coffee machine…") instead of regenerating from scratch.
Step 2 — Character consistency
To keep the same character across all scenes, upload the same headshot as an image reference in
every prompt — the model recognises "the man" from the reference and applies the likeness (use your
own photo, or one you have consent to use). Two discipline rules:
Specify clothing explicitly ("white t-shirt", not just "white shirt").
Keep wardrobe descriptions identical across every prompt in a scene to avoid continuity errors.
Step 3 — Generate video clips (Kling)
Each shot was produced with the image-to-video technique: upload a start frame (and sometimes an
end frame), then describe the scene in natural language. The iterative reality of professional AI
production, as it happened:
First attempt: the character entered the kitchen from the wrong side (through the window). Cost: 60
credits at 720p.
The fix: adding "from the hallway on the right" to the prompt and regenerating — exactly why you test
at low resolution first.
Camera presets: "camera zooms in, slow" for the alarm-clock wake-up shot.
Integrated sound: Kling 3.0 generated audio natively along with the video.
•
•
•
•
•
•
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 10

Step 4 — Post-production
All clips were assembled in editing software — Adobe Premiere Pro, with CapCut as an excellent free
alternative. Shots were produced out of order, which is normal in any production workflow: you shoot in
whatever order is efficient, then edit the sequence together in post. The final result: a polished
commercial with consistent character, environment, wardrobe and atmosphere, a supernatural VFX
transition, and integrated sound.
### The professional reality
Pros go through hundreds of prompts before they get the right output. The "one prompt,
amazing result in 5 minutes" story is misinformation. The process is iterative: prompt → output →
refine prompt → new output → repeat until satisfied. It's identical to LLM prompting — except
each iteration costs credits, which is why the discipline in §5 matters.
8. Key Takeaways
1. AI diffusion models are the new cameras. Pick a few favourites and master them — you don't
need to learn every model, just the ones that fit your use case and style.
2. Image prompting uses comma-separated keywords. Think like a creative director: subject,
action, environment, atmosphere, camera, lighting. Put the most important element first.
3. Video prompting uses natural language. Full sentences. Use image-to-video (not text-to-video)
for professional results; use start and end frames for controlled transitions.
4. Always include "ultra-realistic, cinematic style". Without explicit style instructions, models may
output cartoons, 3D renders or random aesthetics.
5. Use aggregators. Krea and Freepik give you dozens of models on a single subscription — no
separate accounts everywhere.
6. Test cheap, finish expensive. Validate at 720p/1K and on low-credit models; upgrade to 1080p/
4K and premium models only for the final generation.
7. Iteration is the professional workflow. Expect hundreds of prompt iterations, not one-shot
perfection. Budget credits accordingly.
8. Integrated sound changes everything. Kling 3.0, Veo 3.1 and Seedance 2.0 generate video with
native audio, eliminating the expensive lip-sync step.
9. Character consistency requires discipline. Same reference image in every prompt; clothing
specified explicitly and consistently across the scene.
10. Never use someone's likeness without consent. The one hard ethical and legal rule of AI visual
content.
•
•
•
•
•
•
•
•
•
•
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 11

9. Tool & Resource Directory
Tool 	Use case 	Website
Krea 	Subscription aggregator for image (and video)
generation — Nano Banana, Seedream, Flux,
GPT Image and more in one interface
krea.ai
Kling 	Video generation: start/end frames, camera
presets, native 4K/60fps, integrated sound with
multilingual lip-sync
klingai.com
Artificial Analysis 	Industry-standard, continuously updated
leaderboard for AI image, video, audio and LLM
models
artificialanalysis.ai
### Gemini (Nano
### Banana Pro / 2)
Google's top image models — Pro for highest
quality, 2 for fast, high-volume generation with a
generous free tier
gemini.google.com
Veo 3.1 	Google's video model — best-in-class 48kHz
synchronized dialogue; available via Gemini and
aggregators
deepmind.google/models/
veo
### Seedream /
### Seedance
ByteDance's image and video models —
Seedream for cheap, high-quality testing;
Seedance 2.0 for multi-shot storytelling with
audio (via aggregators)
seed.bytedance.com
Runway 	The pioneer video platform; Gen-4.5 offers the
best creative control surface (motion brushes,
scene consistency)
runwayml.com
Hailuo 	MiniMax's video model — wide landscape shots
and motion physics; free trial available
hailuoai.video
Midjourney 	Closed-source image model famous for dreamy,
artistic aesthetics
midjourney.com
### Flux (Black Forest
### Labs)
Leading open-weight image family — run locally,
fine-tune on custom data
bfl.ai
Freepik 	Subscription aggregator with access to many
image and video models
freepik.com
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 12

Tool 	Use case 	Website
FAL 	Pay-per-use aggregator — cheaper per
generation, developer-style interface
fal.ai
Replicate 	Pay-per-use aggregator for running many open
and closed models
replicate.com
Higgsfield 	Video generation platform with free trial — useful
for extending free usage while learning
higgsfield.ai
CapCut 	Free video editing software — the recommended
no-cost alternative to Premiere Pro
capcut.com
### Adobe Premiere
Pro
Professional video editing for assembling and
finishing your shots
adobe.com/products/
premiere
Magnific 	AI upscaling for increasing image resolution and
detail
magnific.ai
Topaz Labs 	AI upscaling and enhancement for images and
video
topazlabs.com
ElevenLabs 	AI audio generation — voiceover, dialogue and
music for your edits
elevenlabs.io
⚠ Model names, availability and leaderboard positions change monthly in this space — verify on artificialanalysis.ai
before committing to a stack.
10. Your Next Step
### Become the AI Director
Don't try to learn every model. Pick one image tool and one video tool from the directory above,
write a three-shot storyboard for something simple — a product you love, a morning routine, a
before/after — and produce it this week using the test-cheap-finish-expensive workflow. Your
first hundred prompts are the tuition; the skill compounds from there.
See you in the next session. — Team Outskill
Generative AI Mastermind Session Notes — AI Image & Video Generation
Page 13
